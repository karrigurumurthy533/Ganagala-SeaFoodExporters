import type { Request, Response } from 'express';
import { createPrivateKey, createSign, createVerify, randomBytes, type KeyObject } from 'node:crypto';
import { createRequire } from 'node:module';
import Payment from '../models/Payment.js';

const require = createRequire(import.meta.url);
const { generateJWEAndJWS } = require('payglocal-js-client') as {
  generateJWEAndJWS(input: { payload: Record<string, unknown>; publicKey: string; privateKey: string; merchantId: string; privateKeyId: string; publicKeyId: string }): Promise<{ jweToken: string; jwsToken: string }>;
};

const API_PATH = '/gl/v1/payments';
const PAYCOLLECT_PATH = `${API_PATH}/initiate/paycollect`;
type GatewayStatus = Record<string, unknown> & { gid?: string; status?: string; data?: Record<string, unknown> };

function config() {
  const mid = process.env.PAYGLOCAL_MERCHANT_ID?.trim();
  const kid = process.env.PAYGLOCAL_PRIVATE_KEY_ID?.trim();
  const privateKeyValue = process.env.PAYGLOCAL_PRIVATE_KEY?.trim();
  const publicKeyValue = process.env.PAYGLOCAL_PUBLIC_KEY?.trim();
  const publicKid = process.env.PAYGLOCAL_PUBLIC_KEY_ID?.trim();
  if (!mid || !kid || !privateKeyValue || !publicKeyValue || !publicKid) throw new Error('PayGlocal credentials are not configured.');
  let pem = privateKeyValue.replace(/^\uFEFF/, '').replace(/^(['"])([\s\S]*)\1$/, '$2');
  pem = pem.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  if (!pem.includes('-----BEGIN')) {
    const decoded = Buffer.from(pem, 'base64').toString('utf8').trim();
    if (decoded.includes('-----BEGIN')) pem = decoded;
  }
  let privateKey: KeyObject;
  try {
    const passphrase = process.env.PAYGLOCAL_PRIVATE_KEY_PASSPHRASE;
    privateKey = createPrivateKey(passphrase ? { key: pem, format: 'pem', passphrase } : { key: pem, format: 'pem' });
    if (privateKey.asymmetricKeyType !== 'rsa' && privateKey.asymmetricKeyType !== 'rsa-pss') {
      throw new Error('unsupported asymmetric key type');
    }
  } catch {
    throw new Error('PAYGLOCAL_PRIVATE_KEY must be a valid RSA PEM key. Use escaped \\n line breaks, base64-encoded PEM, or configure its passphrase if encrypted.');
  }
  const mode = (process.env.PAYGLOCAL_ENV || 'uat').trim().toLowerCase();
  if (mode !== 'uat' && mode !== 'production') throw new Error('PAYGLOCAL_ENV must be uat or production.');
  let publicKey = publicKeyValue.replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').trim();
  if (!publicKey.includes('-----BEGIN')) {
    const decoded = Buffer.from(publicKey, 'base64').toString('utf8').trim();
    if (decoded.includes('-----BEGIN')) publicKey = decoded;
  }
  return { mid, kid, privateKey, publicKey, publicKid, baseUrl: mode === 'production' ? 'https://api.payglocal.in' : 'https://api.uat.payglocal.in' };
}

function payglocalPublicCertificate() {
  const certificate = process.env.PAYGLOCAL_PUBLIC_CERT?.replace(/\\n/g, '\n').trim();
  if (!certificate) throw new Error('PAYGLOCAL_PUBLIC_CERT is not configured.');
  return certificate;
}

function b64url(value: string | Buffer) { return Buffer.from(value).toString('base64url'); }
function signedToken(payload: unknown) {
  const { mid, kid, privateKey } = config();
  const header = b64url(JSON.stringify({ alg: 'RS256', kid, iss: mid, 'x-gl-enc': 'false', 'is-digested': 'false' }));
  const body = b64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(privateKey).toString('base64url')}`;
}

function verifyCallbackToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(payglocalPublicCertificate(), Buffer.from(parts[2], 'base64url'))) return null;
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function gatewayRequest<T>(path: string, method: 'GET' | 'POST', payload?: unknown) {
  const { mid, kid, privateKey, publicKey, publicKid, baseUrl } = config();
  const transactionPayload = payload as Record<string, unknown> | undefined;
  const auth = method === 'POST' && transactionPayload
    ? await generateJWEAndJWS({
      payload: transactionPayload,
      publicKey,
      privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      merchantId: mid,
      privateKeyId: kid,
      publicKeyId: publicKid,
    })
    : { jweToken: undefined, jwsToken: signedToken(payload ?? {}) };
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-gl-token-external': auth.jwsToken,
      'x-gl-merchantid': mid,
      'x-gl-kid': kid,
    },
    ...(method === 'POST' ? { body: JSON.stringify(auth.jweToken) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({})) as T;
  return { ok: response.ok, status: response.status, data };
}

function normalizePhone(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const digits = String(value).replace(/\D/g, '');
  return /^\d{10,15}$/.test(digits) ? digits : undefined;
}
function normalizeCountryCode(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const country = value.trim();
  if (/^[A-Za-z]{3}$/.test(country)) return country.toUpperCase();
  const codes: Record<string, string> = {
    india: 'IND', 'sri lanka': 'LKA', 'united kingdom': 'GBR', uk: 'GBR',
    'united states': 'USA', usa: 'USA', canada: 'CAN', australia: 'AUS',
    singapore: 'SGP', malaysia: 'MYS', maldives: 'MDV', 'united arab emirates': 'ARE', uae: 'ARE',
  };
  return codes[country.toLowerCase()];
}
function mapStatus(value: unknown): 'PAID' | 'FAILED' | 'PENDING' {
  const status = String(value ?? '').toUpperCase();
  if (status === 'SENT_FOR_CAPTURE') return 'PAID';
  if (['ISSUER_DECLINE', 'GENERAL_DECLINE', 'CUSTOMER_CANCELLED', 'ABANDONED', 'REQUEST_ERROR', 'FAILED'].includes(status)) return 'FAILED';
  return 'PENDING';
}
async function reconcile(orderId: string, result: GatewayStatus) {
  const payment = await Payment.findOne({ orderId });
  if (!payment) return null;
  const status = mapStatus(result.status ?? result.data?.status);
  const set: Record<string, unknown> = { rawStatus: String(result.status ?? 'INPROGRESS') };
  // A paid record is terminal; duplicate or late callbacks cannot downgrade it.
  if (payment.status !== 'PAID') {
    set.status = status;
    if (status === 'PAID') set.paymentDate = new Date();
  }
  if (typeof result.gid === 'string') set.payglocalGid = result.gid;
  await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: set });
  return { ...result, status: payment.status === 'PAID' ? 'SENT_FOR_CAPTURE' : result.status };
}

export async function createPaymentOrder(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000000 || Math.round(amount * 100) !== amount * 100) {
      return res.status(400).json({ message: 'Enter a valid amount.' });
    }
    const currency = typeof body.currency === 'string' && /^[A-Za-z]{3}$/.test(body.currency) ? body.currency.toUpperCase() : 'INR';
    const phone = normalizePhone(body.customerPhone);
    if (!phone) return res.status(400).json({ message: 'Enter a valid mobile number.' });
    const name = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 100) : '';
    const email = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase().slice(0, 254) : '';
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter valid customer details.' });
    const callbackUrl = process.env.PAYGLOCAL_CALLBACK_URL?.trim();
    if (!callbackUrl || !callbackUrl.startsWith('https://')) throw new Error('PAYGLOCAL_CALLBACK_URL must be a public HTTPS URL.');

    const orderId = `SFE${randomBytes(16).toString('hex')}`;
    const payment = await Payment.create({ orderId, customerName: name, customerEmail: email, customerPhone: phone,
      country: typeof body.country === 'string' ? body.country.trim().slice(0, 80) : undefined, amount, currency, status: 'PENDING', rawStatus: 'CREATED' });
    const payload = {
      merchantUniqueId: orderId,
      merchantTxnId: orderId,
      paymentData: { totalAmount: amount.toFixed(2), txnCurrency: currency },
      riskData: { billingData: { firstName: name.split(/\s+/)[0], lastName: name.split(/\s+/).slice(1).join(' ') || name,
        emailId: email, ...(normalizeCountryCode(body.country) ? { addressCountry: normalizeCountryCode(body.country) } : {}) } },
      merchantCallbackURL: callbackUrl,
    };
    const result = await gatewayRequest<GatewayStatus>(PAYCOLLECT_PATH, 'POST', payload);
    if (!result.ok) {
      await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: { status: 'FAILED', rawStatus: `INITIATE_HTTP_${result.status}` } });
      console.error('PayGlocal initiation rejected', { orderId, httpStatus: result.status });
      return res.status(502).json({ message: 'Unable to start payment with PayGlocal.' });
    }
    const redirectUrl = typeof result.data.data?.redirectUrl === 'string' ? result.data.data.redirectUrl : '';
    const gid = typeof result.data.gid === 'string' ? result.data.gid : '';
    if (!redirectUrl || !gid || new URL(redirectUrl).protocol !== 'https:') throw new Error('PayGlocal returned an invalid checkout response.');
    await Payment.updateOne({ orderId }, { $set: { payglocalGid: gid, rawStatus: String(result.data.status ?? 'INPROGRESS') } });
    console.info('PayGlocal checkout created', { orderId, gid });
    return res.status(201).json({ orderId, redirectUrl, status: 'PENDING', amount, currency });
  } catch (error) {
    console.error('PayGlocal initiation failed', { message: error instanceof Error ? error.message : 'unknown error' });
    return res.status(502).json({ message: 'Unable to start payment. Please try again.' });
  }
}

export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const orderId = String(req.params.orderId ?? '').trim();
    if (!/^[A-Za-z0-9]{4,50}$/.test(orderId)) return res.status(400).json({ message: 'Invalid order id.' });
    const payment = await Payment.findOne({ orderId });
    if (!payment) return res.status(404).json({ message: 'Order not found.' });
    if (payment.status !== 'PAID') {
      const result = await gatewayRequest<GatewayStatus>(`${API_PATH}/${encodeURIComponent(payment.payglocalGid || orderId)}/status`, 'GET');
      if (!result.ok) return res.status(502).json({ message: 'Unable to verify payment status with PayGlocal.' });
      const rawAmount = result.data.data?.Amount ?? result.data.data?.amount;
      const rawCurrency = result.data.data?.txnCurrency ?? result.data.data?.Currency;
      if (rawAmount == null || rawCurrency == null) {
        return res.status(502).json({ message: 'PayGlocal returned incomplete payment details.' });
      }
      const reportedAmount = Number(rawAmount);
      const reportedCurrency = String(rawCurrency).toUpperCase();
      if (Math.abs(reportedAmount - payment.amount) > 0.01 || reportedCurrency !== payment.currency) {
        console.error('PayGlocal status amount mismatch', { orderId, gid: payment.payglocalGid });
        return res.status(409).json({ message: 'Payment details did not match this order.' });
      }
      await reconcile(orderId, result.data);
    }
    const current = await Payment.findOne({ orderId });
    return res.json({ orderId, status: current?.status ?? 'PENDING', amount: current?.amount, currency: current?.currency, rawStatus: current?.rawStatus });
  } catch (error) {
    console.error('PayGlocal status verification failed', { message: error instanceof Error ? error.message : 'unknown error' });
    return res.status(502).json({ message: 'Unable to verify payment status.' });
  }
}

export async function paymentCallback(req: Request, res: Response) {
  try {
    const token = (req.body as Record<string, unknown> | undefined)?.['x-gl-token'];
    if (typeof token !== 'string') return res.status(400).send('Missing payment token.');
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(400).send('Invalid payment token.');
    // Callback fields only identify the order; payment state is confirmed server-to-server below.
    const callback = verifyCallbackToken(token);
    if (!callback) return res.status(401).send('Invalid payment signature.');
    const orderId = typeof callback.merchantTxnId === 'string' ? callback.merchantTxnId : '';
    if (!/^[A-Za-z0-9]{4,50}$/.test(orderId)) return res.status(400).send('Invalid transaction reference.');
    const payment = await Payment.findOne({ orderId });
    if (!payment) return res.status(404).send('Order not found.');
    const { mid } = config();
    const callbackMerchantId = String(callback.merchantId ?? callback['x-gl-merchantId'] ?? '');
    if (callbackMerchantId !== mid) return res.status(401).send('Merchant mismatch.');
    const callbackAmount = Number(callback.amount);
    const callbackCurrency = String(callback.currency ?? '').toUpperCase();
    if (!Number.isFinite(callbackAmount) || !callbackCurrency || Math.abs(callbackAmount - payment.amount) > 0.01 ||
        callbackCurrency !== payment.currency) return res.status(409).send('Payment details mismatch.');
    if (payment.status !== 'PAID') {
      const result = await gatewayRequest<GatewayStatus>(`${API_PATH}/${encodeURIComponent(payment.payglocalGid || orderId)}/status`, 'GET');
      if (result.ok) {
        const rawAmount = result.data.data?.Amount ?? result.data.data?.amount;
        const rawCurrency = result.data.data?.txnCurrency ?? result.data.data?.Currency;
        if (rawAmount != null && rawCurrency != null &&
            Math.abs(Number(rawAmount) - payment.amount) <= 0.01 && String(rawCurrency).toUpperCase() === payment.currency) {
          await reconcile(orderId, result.data);
        }
      }
    }
    const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim();
    if (!clientUrl) return res.status(200).send('Payment received. You may return to the website.');
    return res.redirect(303, `${clientUrl.replace(/\/$/, '')}/checkout?order_id=${encodeURIComponent(orderId)}`);
  } catch (error) {
    console.error('PayGlocal callback processing failed', { message: error instanceof Error ? error.message : 'unknown error' });
    return res.status(500).send('Unable to process payment callback.');
  }
}
