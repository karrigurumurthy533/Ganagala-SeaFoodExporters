import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import Payment from '../models/Payment.js';

const CASHFREE_API_VERSION = '2026-01-01';

type CashfreeEnv = 'sandbox' | 'production';

type CashfreeRawResponse<T = Record<string, unknown>> = {
  status: number;
  ok: boolean;
  data: T;
};

type CashfreeCreateOrderResponse = Record<string, unknown> & {
  cf_order_id?: string | number;
  order_id?: string;
  payment_session_id?: string;
  order_amount?: number;
  order_currency?: string;
  order_status?: string;
};

type CashfreeOrderStatus = Record<string, unknown> & {
  cf_order_id?: string | number;
  order_id?: string;
  order_status?: string;
  order_amount?: number;
  order_currency?: string;
};

type CashfreePaymentAttempt = {
  cf_payment_id?: string | number;
  payment_status?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_completion_time?: string;
  payment_time?: string;
};

function getCashfreeEnv(): CashfreeEnv {
  const value = (process.env.CASHFREE_ENV || 'sandbox').trim().toLowerCase();
  if (value !== 'sandbox' && value !== 'production') {
    throw new Error('CASHFREE_ENV must be sandbox or production');
  }
  return value;
}

function getCashfreeBaseUrl(): string {
  return getCashfreeEnv() === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

function getCashfreeHeaders(): Record<string, string> {
  const clientId = process.env.CASHFREE_APP_ID?.trim();
  const clientSecret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('Cashfree credentials are not configured.');
  }

  return {
    'Content-Type': 'application/json',
    'x-api-version': CASHFREE_API_VERSION,
    'x-client-id': clientId,
    'x-client-secret': clientSecret,
  };
}

async function cashfreeRequest<T>(path: string, init?: RequestInit): Promise<CashfreeRawResponse<T>> {
  const response = await fetch(`${getCashfreeBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...getCashfreeHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, ok: response.ok, data };
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

function normalizeCustomerId(value: unknown): string {
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/[^A-Za-z0-9_-]/g, '');
    if (cleaned.length >= 3 && cleaned.length <= 50) return cleaned;
  }
  return `cust_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

/**
 * Create a Cashfree order via POST /pg/orders and return the raw Cashfree response.
 */
export async function createPaymentOrder(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const nestedCustomer =
      typeof body.customer_details === 'object' && body.customer_details !== null
        ? (body.customer_details as Record<string, unknown>)
        : {};

    const amount = Number(body.amount ?? body.order_amount);
    if (
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > 10000000 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      return res.status(400).json({ message: 'Enter a valid amount.' });
    }

    const currencyRaw = body.currency ?? body.order_currency ?? 'INR';
    const orderCurrency =
      typeof currencyRaw === 'string' && /^[A-Za-z]{3}$/.test(currencyRaw.trim())
        ? currencyRaw.trim().toUpperCase()
        : 'INR';

    const rawSuppliedPhone =
      body.customerPhone ?? body.customer_phone ?? nestedCustomer.customer_phone;
    const suppliedPhone = normalizePhone(rawSuppliedPhone);
    if (rawSuppliedPhone !== undefined && rawSuppliedPhone !== '' && !suppliedPhone) {
      return res.status(400).json({ message: 'Enter a valid mobile number.' });
    }

    const customerPhone = suppliedPhone ?? normalizePhone(process.env.CASHFREE_MERCHANT_PHONE);
    if (!customerPhone) {
      return res.status(400).json({
        message: 'A valid customer phone number (or CASHFREE_MERCHANT_PHONE) is required.',
      });
    }

    const customerId = normalizeCustomerId(
      body.customerId ?? body.customer_id ?? nestedCustomer.customer_id,
    );

    const cashfreePayload = {
      order_currency: orderCurrency,
      order_amount: amount,
      customer_details: {
        customer_id: customerId,
        customer_phone: customerPhone,
      },
    };

    const cfResponse = await cashfreeRequest<CashfreeCreateOrderResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify(cashfreePayload),
    });

    if (!cfResponse.ok) {
      return res.status(cfResponse.status).json(cfResponse.data);
    }

    const data = cfResponse.data;
    const orderId = typeof data.order_id === 'string' ? data.order_id.trim() : '';

    if (orderId) {
      const customerName =
        typeof body.customerName === 'string' && body.customerName.trim()
          ? body.customerName.trim()
          : undefined;
      const customerEmail =
        typeof body.customerEmail === 'string' && body.customerEmail.trim()
          ? body.customerEmail.trim().toLowerCase()
          : undefined;
      const country =
        typeof body.country === 'string' && body.country.trim() ? body.country.trim() : undefined;

      await Payment.create({
        orderId,
        cfOrderId: data.cf_order_id != null ? String(data.cf_order_id) : undefined,
        customerName,
        customerEmail,
        customerPhone,
        country,
        amount: Number(data.order_amount ?? amount),
        currency: typeof data.order_currency === 'string' ? data.order_currency : orderCurrency,
        status: 'PENDING',
        rawStatus: typeof data.order_status === 'string' ? data.order_status : 'ACTIVE',
      });
    }

    return res.status(cfResponse.status).json(data);
  } catch (error) {
    console.error('Cashfree create order failed:', error);
    return res.status(502).json({
      message: error instanceof Error ? error.message : 'Unable to create Cashfree order.',
    });
  }
}

/**
 * Fetch Cashfree order status, reconcile MongoDB, and return the raw Cashfree order response.
 */
export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const orderId = String(req.params.orderId ?? '').trim();
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(orderId)) {
      return res.status(400).json({ message: 'Invalid order id.' });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const [orderRes, attemptsRes] = await Promise.all([
      cashfreeRequest<CashfreeOrderStatus>(`/orders/${encodeURIComponent(orderId)}`),
      cashfreeRequest<CashfreePaymentAttempt[]>(`/orders/${encodeURIComponent(orderId)}/payments`),
    ]);

    if (!orderRes.ok) {
      return res.status(orderRes.status).json(orderRes.data);
    }

    const order = orderRes.data;
    const attempts = Array.isArray(attemptsRes.data) ? attemptsRes.data : [];

    const successfulAttempt = attempts.find(
      (attempt) =>
        attempt.cf_payment_id != null &&
        attempt.payment_status === 'SUCCESS' &&
        Number(attempt.payment_amount) === payment.amount &&
        attempt.payment_currency === payment.currency,
    );

    if (order.order_status === 'PAID' && successfulAttempt) {
      await Payment.updateOne(
        { orderId, status: { $ne: 'PAID' } },
        {
          $set: {
            status: 'PAID',
            rawStatus: 'PAID',
            cashfreePaymentId: String(successfulAttempt.cf_payment_id),
            paymentDate: successfulAttempt.payment_completion_time
              ? new Date(successfulAttempt.payment_completion_time)
              : successfulAttempt.payment_time
                ? new Date(successfulAttempt.payment_time)
                : new Date(),
          },
        },
      );
    } else if (order.order_status === 'EXPIRED') {
      await Payment.updateOne(
        { orderId, status: { $ne: 'PAID' } },
        { $set: { status: 'CANCELLED', rawStatus: order.order_status } },
      );
    } else if (order.order_status === 'ACTIVE' || order.order_status === 'PAID') {
      const latestAttempt = [...attempts].sort(
        (a, b) => Date.parse(b.payment_time ?? '') - Date.parse(a.payment_time ?? ''),
      )[0];
      const nextStatus = latestAttempt?.payment_status === 'FAILED' ? 'FAILED' : 'PENDING';
      await Payment.updateOne(
        { orderId, status: { $ne: 'PAID' } },
        {
          $set: {
            status: nextStatus,
            rawStatus: latestAttempt?.payment_status ?? order.order_status,
          },
        },
      );
    } else {
      await Payment.updateOne(
        { orderId, status: { $ne: 'PAID' } },
        { $set: { status: 'FAILED', rawStatus: order.order_status } },
      );
    }

    return res.status(orderRes.status).json(order);
  } catch (error) {
    console.error('Cashfree status check failed:', error);
    return res.status(502).json({ message: 'Unable to verify payment status with Cashfree.' });
  }
}
