import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import Payment from '../models/Payment.js';


dotenv.config();

const API_VERSION = '2026-01-01';
type CashfreePayment = { cf_payment_id?: string | number; payment_status?: string; payment_completion_time?: string; payment_time?: string; payment_amount?: number; payment_currency?: string };
type CashfreeOrder = { order_status?: string; order_amount?: number; order_currency?: string; cf_order_id?: string };
function environment(): 'sandbox' | 'production' {
  const value = (process.env.CASHFREE_ENV || 'sandbox').trim().toLowerCase();
  if (value !== 'sandbox' && value !== 'production') throw new Error('CASHFREE_ENV must be sandbox or production');
  return value;
}
function baseUrl() { return environment() === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg'; }
function headers(idempotencyKey?: string) {
  const id = process.env.CASHFREE_APP_ID?.trim();
  const secret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!id || !secret) throw new Error('Cashfree credentials are not configured');
  return { 'x-client-id': id, 'x-client-secret': secret, 'x-api-version': API_VERSION, 'content-type': 'application/json', ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}) };
}
async function cashfreeJson<T>(path: string, init?: RequestInit): Promise<T> {
  const requestHeaders = new Headers(headers());
  new Headers(init?.headers).forEach((value, key) => requestHeaders.set(key, value));
  const response = await fetch(`${baseUrl()}${path}`, { ...init, headers: requestHeaders });
  console.info('Cashfree HTTP response', { httpStatus: response.status, endpoint: path.split('?')[0] });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorData = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
    const cashfreeCode = typeof errorData.code === 'string' ? errorData.code : undefined;
    console.error('Cashfree API error', { httpStatus: response.status, code: cashfreeCode });
    const message = typeof errorData.message === 'string' ? errorData.message : 'Cashfree API request failed.';
    throw new Error(cashfreeCode ? `${message} (Cashfree code: ${cashfreeCode})` : message);
  }
  return data as T;
}
function validEmail(value: unknown): value is string { return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const country = value.trim().replace(/\s+/g, ' ');
  return country.length >= 2 && country.length <= 80 && /^[\p{L} .'-]+$/u.test(country) ? country : null;
}



export async function createPaymentOrder(req: Request, res: Response) {
  try {
    const { customerName, customerEmail, country } = req.body ?? {};
    const rawPhone = req.body?.customerPhone ?? req.body?.customer_phone;
    const amount = Number(req.body?.amount);

    const name =
      typeof customerName === 'string'
        ? customerName.trim().replace(/\s+/g, ' ')
        : '';

    const normalizedCountry = normalizeCountry(country);

    if (name.length < 2 || name.length > 100 ||
        !/^[\p{L} .'-]+$/u.test(name)) {
      return res.status(400).json({ message: 'Enter a valid customer name.' });
    }

    if (!validEmail(customerEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    if (!normalizedCountry) {
      return res.status(400).json({ message: 'Enter a valid country.' });
    }

    if (!Number.isFinite(amount) || amount < 1 ||
        amount > 10000000 ||
        Math.round(amount * 100) !== amount * 100) {
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

    const returnUrl = `${
      process.env.CLIENT_URL?.split(',')[0]?.trim() ||
      'https://ganagalaseafoodexporters.com'
    }/checkout?order_id=${encodeURIComponent(orderId)}`;

    const data = await cashfreeJson<{
      cf_order_id?: string;
      payment_session_id?: string;
    }>('/orders', {
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
    console.error('Create payment order failed:', error);

    return res.status(502).json({
      message: error instanceof Error ? error.message : 'Unable to create the Cashfree payment order.'
    });
  }
}


async function verifyAndUpdate(orderId: string) {
  const payment = await Payment.findOne({ orderId });
  if (!payment) return null;
  const [order, attempts] = await Promise.all([
    cashfreeJson<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`),
    cashfreeJson<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`),
  ]);
  if (Number(order.order_amount) !== payment.amount || order.order_currency !== payment.currency) throw new Error('Cashfree order amount/currency did not match the stored order');
  const successfulAttempt = attempts.find((attempt) => attempt.cf_payment_id != null && attempt.payment_status === 'SUCCESS' && Number(attempt.payment_amount) === payment.amount && attempt.payment_currency === payment.currency);
  if (order.order_status === 'PAID' && successfulAttempt) {
    // Atomic guarded update keeps payment confirmation idempotent and records only verified captures.
    await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: { status: 'PAID', rawStatus: 'PAID', cashfreePaymentId: String(successfulAttempt.cf_payment_id ?? ''), paymentDate: successfulAttempt.payment_completion_time ? new Date(successfulAttempt.payment_completion_time) : successfulAttempt.payment_time ? new Date(successfulAttempt.payment_time) : new Date() } });
  } else if (order.order_status === 'EXPIRED') {
    await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: { status: 'CANCELLED', rawStatus: order.order_status } });
  } else if (order.order_status === 'ACTIVE' || order.order_status === 'PAID') {
    const latestAttempt = [...attempts].sort((a, b) => Date.parse(b.payment_time ?? '') - Date.parse(a.payment_time ?? ''))[0];
    const nextStatus = latestAttempt?.payment_status === 'FAILED' ? 'FAILED' : 'PENDING';
    if (payment.status !== 'PAID') await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: { status: nextStatus, rawStatus: latestAttempt?.payment_status ?? order.order_status } });
  } else {
    await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: { status: 'FAILED', rawStatus: order.order_status } });
  }
  return Payment.findOne({ orderId }).select('orderId status amount currency paymentDate');
}

export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const orderId = String(req.params.orderId ?? '');
    if (!/^sf_[A-Za-z0-9_-]{10,80}$/.test(orderId)) return res.status(400).json({ message: 'Invalid order id.' });
    if (!await Payment.exists({ orderId })) return res.status(404).json({ message: 'Order not found.' });
    const payment = await verifyAndUpdate(orderId);
    return res.json({ orderId: payment?.orderId, status: payment?.status, amount: payment?.amount, currency: payment?.currency, paymentDate: payment?.paymentDate ?? null });
  } catch (error) {
    console.error('Payment status verification failed:', error);
    return res.status(502).json({ message: 'Unable to verify payment status with Cashfree.' });
  }
}

export async function handleCashfreeWebhook(req: Request, res: Response) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const signature = req.header('x-webhook-signature');
  const timestamp = req.header('x-webhook-timestamp');
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!signature || !timestamp || !secret || !rawBody) return res.status(400).json({ message: 'Missing webhook signature, timestamp, secret, or raw body.' });
  const expected = createHmac('sha256', secret).update(timestamp + rawBody).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64'); } catch { return res.status(401).json({ message: 'Invalid webhook signature.' }); }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(401).json({ message: 'Invalid webhook signature.' });
  try {
    const event = JSON.parse(rawBody) as { type?: string; data?: { order?: { order_id?: string }; payment?: { cf_payment_id?: string | number; payment_status?: string } } };
    const orderId = event?.data?.order?.order_id;
    const eventId = `${event.type ?? 'UNKNOWN'}:${event.data?.payment?.cf_payment_id ?? 'none'}:${event.data?.payment?.payment_status ?? 'none'}`;
    if (!orderId) return res.status(400).json({ message: 'Webhook order id is missing.' });
    const payment = await Payment.findOne({ orderId });
    if (!payment) return res.status(200).json({ received: true });
    if (payment.processedWebhookEvents.includes(eventId)) return res.status(200).json({ received: true, duplicate: true });
    // Treat signed events as a prompt to reconcile with Cashfree; webhook fields alone never mark PAID.
    await verifyAndUpdate(orderId);
    await Payment.updateOne({ orderId }, { $addToSet: { processedWebhookEvents: eventId }, $set: { lastWebhookEvent: event.type ?? 'UNKNOWN' } });
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Cashfree webhook processing failed:', error);
    return res.status(400).json({ message: 'Invalid or unprocessable webhook payload.' });
  }
}







