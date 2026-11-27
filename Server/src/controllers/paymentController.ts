import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import Payment from '../models/Payment.js';

// PayGlocal's official Node SDK creates the encrypted JWE and signed JWS.
const require = createRequire(import.meta.url);
const { generateJWEAndJWS } = require('payglocal-js-client') as {
  generateJWEAndJWS(input: {
    payload: Record<string, unknown>;
    publicKey: string;
    privateKey: string;
    merchantId: string;
    privateKeyId: string;
    publicKeyId: string;
  }): Promise<{ jweToken: string; jwsToken: string }>;
};

const API_PATH = '/gl/v1/payments';
const TERMINAL_FAILURES = new Set([
  'ISSUER_DECLINE', 'GENERAL_DECLINE', 'CUSTOMER_CANCELLED', 'ABANDONED', 'REQUEST_ERROR', 'FAILED',
]);
type PaymentResult = Record<string, unknown> & { gid?: string; status?: string };

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function normalizePem(value: string) {
  let pem = value.replace(/^\uFEFF/, '').replace(/^(['"])([\s\S]*)\1$/, '$2')
    .replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n').trim();
  if (!pem.includes('-----BEGIN')) {
    const decoded = Buffer.from(pem, 'base64').toString('utf8').trim();
    if (decoded.includes('-----BEGIN')) pem = decoded;
  }
  return pem;
}

function config() {
  const mode = (process.env.PAYGLOCAL_ENV || 'uat').trim().toLowerCase();
  if (mode !== 'uat' && mode !== 'production') throw new Error('PAYGLOCAL_ENV must be uat or production.');
  return {
    merchantId: required('PAYGLOCAL_MERCHANT_ID'),
    privateKeyId: required('PAYGLOCAL_PRIVATE_KEY_ID'),
    privateKey: normalizePem(required('PAYGLOCAL_PRIVATE_KEY')),
    publicKeyId: required('PAYGLOCAL_PUBLIC_KEY_ID'),
    publicKey: normalizePem(required('PAYGLOCAL_PUBLIC_KEY')),
    baseUrl: mode === 'production' ? 'https://api.payglocal.in' : 'https://api.uat.payglocal.in',
  };
}

function decodeToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function responseToken(req: Request) {
  const body = req.body as Record<string, unknown> | undefined;
  const token = body?.['x-gl-token'] ?? req.get('x-gl-token');
  return typeof token === 'string' ? token : '';
}

function statusFor(raw: unknown): 'PAID' | 'FAILED' | 'PENDING' {
  const status = String(raw ?? '').trim().toUpperCase();
  if (status === 'SENT_FOR_CAPTURE') return 'PAID';
  if (TERMINAL_FAILURES.has(status)) return 'FAILED';
  return 'PENDING';
}

function getResultFields(result: PaymentResult) {
  const nested = result.data && typeof result.data === 'object'
    ? result.data as Record<string, unknown>
    : {};
  return {
    status: result.status ?? nested.status,
    gid: result.gid ?? nested.gid,
    amount: result.amount ?? nested.amount ?? nested.Amount ?? nested.totalAmount,
    currency: result.currency ?? nested.currency ?? nested.txnCurrency ?? nested.Currency,
    merchantId: result.merchantId ?? result['x-gl-merchantId'] ?? nested.merchantId,
    merchantTxnId: result.merchantTxnId ?? nested.merchantTxnId,
  };
}

async function updatePaymentFromVerifiedResult(result: PaymentResult) {
  const fields = getResultFields(result);
  const orderId = String(fields.merchantTxnId ?? '').trim();
  const payment = await Payment.findOne({ orderId });
  if (!payment) return null;

  const merchantId = config().merchantId;
  const amount = Number(fields.amount);
  const currency = String(fields.currency ?? '').toUpperCase();
  if (fields.merchantId != null && String(fields.merchantId) !== merchantId) throw new Error('Merchant mismatch.');
  if (!Number.isFinite(amount) || Math.abs(amount - payment.amount) > 0.01 || currency !== payment.currency) {
    throw new Error('Payment details do not match the order.');
  }

  const status = statusFor(fields.status);
  if (payment.status !== 'PAID') {
    const update: Record<string, unknown> = { status, rawStatus: String(fields.status ?? 'UNKNOWN') };
    if (status === 'PAID') update.paymentDate = new Date();
    if (typeof fields.gid === 'string') update.payglocalGid = fields.gid;
    await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: update });
  }
  return Payment.findOne({ orderId });
}

async function gatewayRequest<T extends Record<string, unknown>>(path: string, payload: Record<string, unknown>) {
  const settings = config();
  const tokens = await generateJWEAndJWS({
    payload,
    publicKey: settings.publicKey,
    privateKey: settings.privateKey,
    merchantId: settings.merchantId,
    privateKeyId: settings.privateKeyId,
    publicKeyId: settings.publicKeyId,
  });

  const response = await fetch(`${settings.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'text/plain',
      'x-gl-token-external': tokens.jwsToken,
    },
    body: tokens.jweToken,
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data: T = {} as T;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(`PayGlocal returned a non-JSON response (HTTP ${response.status}).`);
    }
  }
  return { ok: response.ok, status: response.status, data };
}

function countryCode(value: unknown) {
  if (typeof value !== 'string') return '';
  const input = value.trim();
  if (/^[A-Za-z]{2}$/.test(input)) return input.toUpperCase();
  if (/^[A-Za-z]{3}$/.test(input)) return input.toUpperCase();
  const aliases: Record<string, string> = {
    india: 'IN', 'sri lanka': 'LK', 'united kingdom': 'GB', uk: 'GB',
    'united states': 'US', usa: 'US', canada: 'CA', australia: 'AU',
    singapore: 'SG', malaysia: 'MY', maldives: 'MV', 'united arab emirates': 'AE', uae: 'AE',
  };
  return aliases[input.toLowerCase()] ?? '';
}

const callingCodes: Record<string, string> = {
  IN: '+91', LK: '+94', GB: '+44', US: '+1', CA: '+1', AU: '+61',
  SG: '+65', MY: '+60', MV: '+960', AE: '+971',
};

function phoneParts(value: unknown, isoCountry: string) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const input = String(value).trim();
  const digits = input.replace(/\D/g, '');
  const callingCode = callingCodes[isoCountry];
  if (!callingCode) return null;
  const prefixDigits = callingCode.slice(1);
  const phoneNumber = input.startsWith('+') && digits.startsWith(prefixDigits)
    ? digits.slice(prefixDigits.length)
    : digits.length > 10 && digits.startsWith(prefixDigits)
      ? digits.slice(prefixDigits.length)
      : digits;
  return /^\d{6,14}$/.test(phoneNumber) ? { callingCode, phoneNumber } : null;
}

function splitName(value: string) {
  const pieces = value.trim().split(/\s+/);
  return { firstName: pieces.shift() || '', lastName: pieces.join(' ') || 'Customer' };
}

function validHttpsUrl(value: string) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export async function createPaymentOrder(req: Request, res: Response) {
  let orderId = '';
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000000 || Math.round(amount * 100) !== amount * 100) {
      return res.status(400).json({ message: 'Enter a valid amount.' });
    }
    // PayCollect supports merchant-enabled currencies. Do not silently change the currency requested by checkout.
    const currency = typeof body.currency === 'string' && /^[A-Za-z]{3}$/.test(body.currency)
      ? body.currency.toUpperCase() : 'INR';
    const name = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 100) : '';
    const email = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase().slice(0, 254) : '';
    const country = typeof body.country === 'string' ? body.country.trim().slice(0, 80) : '';
    const isoCountry = countryCode(country);
    const phone = phoneParts(body.customerPhone, isoCountry);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !isoCountry) {
      return res.status(400).json({ message: 'Enter a valid name, email, phone number, and country.' });
    }

    const callbackUrl = required('PAYGLOCAL_CALLBACK_URL');
    if (!validHttpsUrl(callbackUrl)) throw new Error('PAYGLOCAL_CALLBACK_URL must be a public HTTPS URL.');
    // Validate required credential configuration before storing a new order.
    config();

    orderId = `SFE${randomBytes(16).toString('hex')}`;
    const payment = await Payment.create({
      orderId, customerName: name, customerEmail: email,
      customerPhone: `${phone.callingCode}${phone.phoneNumber}`, country,
      amount, currency, status: 'PENDING', rawStatus: 'CREATED',
    });
    const { firstName, lastName } = splitName(name);
    const payload: Record<string, unknown> = {
      merchantTxnId: orderId,
      paymentData: {
        totalAmount: amount.toFixed(2),
        txnCurrency: currency,
        billingData: {
          firstName,
          lastName,
          emailId: email,
          addressCountry: isoCountry,
          callingCode: phone.callingCode,
          phoneNumber: phone.phoneNumber,
        },
      },
      merchantCallbackURL: callbackUrl,
    };
    const result = await gatewayRequest<PaymentResult>(`${API_PATH}/initiate/paycollect`, payload);
    if (!result.ok) {
      await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: { status: 'FAILED', rawStatus: `INITIATE_HTTP_${result.status}` } });
      console.error('PayGlocal initiation rejected', { orderId, httpStatus: result.status, response: result.data });
      return res.status(502).json({ message: 'Unable to start payment with PayGlocal.' });
    }

    const nested = result.data.data && typeof result.data.data === 'object'
      ? result.data.data as Record<string, unknown> : {};
    const redirectUrl = String(nested.redirectUrl ?? result.data.redirectUrl ?? '');
    const gid = String(result.data.gid ?? nested.gid ?? '');
    if (!redirectUrl || !gid || !validHttpsUrl(redirectUrl)) {
      throw new Error('PayGlocal returned an invalid hosted checkout response.');
    }
    await Payment.updateOne({ orderId }, { $set: { payglocalGid: gid, rawStatus: String(result.data.status ?? 'INPROGRESS') } });
    return res.status(201).json({ orderId, redirectUrl, status: 'PENDING', amount, currency });
  } catch (error) {
    console.error('PayGlocal initiation failed', { orderId: orderId || undefined, message: error instanceof Error ? error.message : 'unknown error' });
    return res.status(502).json({ message: 'Unable to start payment. Please try again.' });
  }
}

export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const orderId = String(req.params.orderId ?? '').trim();
    if (!/^SFE[A-Fa-f0-9]{32}$/.test(orderId)) return res.status(400).json({ message: 'Invalid order id.' });
    const payment = await Payment.findOne({ orderId });
    if (!payment) return res.status(404).json({ message: 'Order not found.' });

    // Browser return is not proof of payment. Reconcile from the verified callback/webhook first;
    // optional status lookup can be enabled/configured with PayGlocal if the merchant endpoint is confirmed.
    return res.json({ orderId, status: payment.status === 'CREATED' ? 'PENDING' : payment.status,
      amount: payment.amount, currency: payment.currency, rawStatus: payment.rawStatus });
  } catch (error) {
    console.error('PayGlocal status lookup failed', { message: error instanceof Error ? error.message : 'unknown error' });
    return res.status(500).json({ message: 'Unable to verify payment status.' });
  }
}

export async function paymentCallback(req: Request, res: Response) {
  try {
    const result = decodeToken(responseToken(req));
    if (!result) return res.status(401).send('Invalid payment signature.');
    const payment = await updatePaymentFromVerifiedResult(result);
    if (!payment) return res.status(404).send('Order not found.');
    const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim();
    if (!clientUrl) return res.status(200).send('Payment response received.');
    return res.redirect(303, `${clientUrl.replace(/\/$/, '')}/checkout?order_id=${encodeURIComponent(payment.orderId)}`);
  } catch (error) {
    console.error('PayGlocal callback failed', { message: error instanceof Error ? error.message : 'unknown error' });
    return res.status(400).send('Unable to process payment response.');
  }
}

export async function paymentWebhook(req: Request, res: Response) {
  // Acknowledge promptly. The public webhook guide shows unsigned JSON but does not
  // document a verification mechanism; never update payment records from unsigned data.
  res.status(200).json({ received: true });
  const token = responseToken(req);
  if (!token) {
    console.error('PayGlocal webhook received without a signed x-gl-token; no payment state changed');
    return;
  }
  const event = decodeToken(token);
  if (!event) {
    console.error('PayGlocal webhook could not be verified or parsed');
    return;
  }
  void updatePaymentFromVerifiedResult(event).catch((error) => {
    console.error('PayGlocal webhook reconciliation failed', { message: error instanceof Error ? error.message : 'unknown error' });
  });
}
