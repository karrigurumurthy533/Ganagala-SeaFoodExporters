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
    const { customerName, customerEmail, country } = req.body ?? {};
    const rawPhone = req.body?.customerPhone ?? req.body?.customer_phone;
    const amount = Number(req.body?.amount);

    const name =
      typeof customerName === 'string'
        ? customerName.trim().replace(/\s+/g, ' ')
        : '';

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

    const customerPhone =
      normalizePhone(body.customerPhone ?? body.customer_phone ?? nestedCustomer.customer_phone) ??
      normalizePhone(process.env.CASHFREE_MERCHANT_PHONE);

    if (!customerPhone) {
      return res.status(400).json({
        message: 'Enter a valid amount.'
      });
    }

    const suppliedPhone =
      typeof rawPhone === 'string' || typeof rawPhone === 'number'
        ? String(rawPhone).replace(/\D/g, '')
        : '';

    if (rawPhone !== undefined && rawPhone !== '' && !/^\d{10,15}$/.test(suppliedPhone)) {
      return res.status(400).json({ message: 'Enter a valid mobile number.' });
    }

    const fallbackPhone = process.env.CASHFREE_MERCHANT_PHONE?.replace(/\D/g, '');
    const customerPhone = suppliedPhone || fallbackPhone;

    if (!customerPhone || !/^\d{10,15}$/.test(customerPhone)) {
      return res.status(400).json({
        message: 'Enter a valid customer mobile number.'
      });
    }

    const orderId = `sf_${Date.now()}_${randomUUID()
      .replaceAll('-', '').slice(0, 16)}`;

    const payment = await Payment.create({
      orderId,
      amount,
      currency: 'INR',
      customerName: name,
      customerEmail,
      customerPhone,
      country: normalizedCountry,
      status: 'CREATED'
    });

    const cfResponse = await cashfreeRequest<CashfreeCreateOrderResponse>('/orders', {
      method: 'POST',
      headers: {
        'x-idempotency-key': randomUUID()
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: `web_${orderId}`,
          customer_name: name,
          customer_email: customerEmail,
          customer_phone: customerPhone
        },
        order_meta: {
          return_url: returnUrl,
          payment_methods: 'cc,dc'
        }
      })
    });

    const paymentSessionId = typeof data.payment_session_id === 'string'
      ? data.payment_session_id.trim()
      : '';
    console.info('Cashfree order created', {
      orderId,
      cfOrderId: data.cf_order_id ?? null,
      paymentSessionIdPresent: paymentSessionId.length > 0
    });
    if (!paymentSessionId) {
      throw new Error('Cashfree created the order but returned an empty payment_session_id.');
    }

    payment.cfOrderId = data.cf_order_id;
    payment.status = 'PENDING';

    await payment.save();

    return res.status(201).json({
      orderId,
      paymentSessionId,
      amount,
      currency: 'INR',
      cashfreeMode: environment()
    });

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
