import type { Request, Response } from 'express';
import { createHash, createPublicKey, createSign, createVerify, randomBytes, X509Certificate } from 'node:crypto';
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
  // dotenv values are sometimes pasted as one uninterrupted PEM line. Restore
  // the line breaks required by Node's key parser before passing them to jose.
  const pemParts = pem.match(/^-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----$/);
  if (pemParts) {
    const encoded = pemParts[2].replace(/\s/g, '');
    const lines = encoded.match(/.{1,64}/g) ?? [];
    pem = `-----BEGIN ${pemParts[1]}-----\n${lines.join('\n')}\n-----END ${pemParts[1]}-----`;
  }
  if (!pem.includes('-----BEGIN')) {
    const decoded = Buffer.from(pem, 'base64').toString('utf8').trim();
    if (decoded.includes('-----BEGIN')) pem = decoded;
  }
  return pem;
}

function payglocalPublicKey(value: string) {
  const pem = normalizePem(value);
  if (pem.includes('-----BEGIN CERTIFICATE-----')) {
    return new X509Certificate(pem).publicKey.export({ type: 'spki', format: 'pem' }).toString();
  }
  if (pem.includes('-----BEGIN RSA PUBLIC KEY-----')) {
    return createPublicKey(pem).export({ type: 'spki', format: 'pem' }).toString();
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
    publicKey: payglocalPublicKey(required('PAYGLOCAL_PUBLIC_KEY')),
    baseUrl: mode === 'production' ? 'https://api.payglocal.in' : 'https://api.uat.payglocal.in',
  };
}

function decodeAndVerifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string, unknown>;
    if (header.alg !== 'RS256') return null;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    if (!verifier.verify(config().publicKey, Buffer.from(parts[2], 'base64url'))) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function responseToken(req: Request) {
  const body = req.body as Record<string, unknown> | string | undefined;
  const token = (body && typeof body === 'object' ? body['x-gl-token'] : undefined) ??
    req.get('x-gl-token') ?? req.query['x-gl-token'];
  return typeof token === 'string' ? token : '';
}

function checkoutReturnUrl(params: Record<string, string> = {}) {
  const configured = (process.env.CLIENT_URL || '').split(',')[0].trim();
  let origin = 'https://ganagalaseafoodexporters.com';
  try {
    const parsed = new URL(configured);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') origin = parsed.origin;
  } catch {
    // A display name or malformed CLIENT_URL is not a usable redirect destination.
  }
  const url = new URL('/checkout', origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function callbackOrderId(req: Request) {
  const orderId = typeof req.query.merchantTxnId === 'string' ? req.query.merchantTxnId.trim() : '';
  return /^SFE[A-Fa-f0-9]{32}$/.test(orderId) ? orderId : '';
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
    // Status responses may report both cardholder txnCurrency and merchant
    // settlement Currency. This order is stored in the merchant currency.
    currency: result.currency ?? result.Currency ?? nested.currency ?? nested.Currency ?? nested.txnCurrency ?? result.txnCurrency,
    merchantId: result.merchantId ?? result['x-gl-merchantId'] ?? nested.merchantId ?? nested['x-gl-merchantId'],
    merchantTxnId: result.merchantTxnId ?? result['x-gl-orderId'] ?? nested.merchantTxnId ?? nested['x-gl-orderId'],
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
  if (String(fields.merchantId ?? '') !== merchantId) throw new Error('Merchant mismatch.');
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

function createStatusToken(settings: ReturnType<typeof config>) {
  // The status endpoint is a GET with no body. PayGlocal's JWS format signs
  // the SHA-256 digest of the request body (the empty string for this request).
  const now = Date.now();
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({
    alg: 'RS256',
    kid: settings.privateKeyId,
    iss: settings.merchantId,
    'x-gl-enc': 'false',
    'is-digested': 'true',
  });
  const payload = encode({
    digest: createHash('sha256').update('').digest('base64'),
    digestAlgorithm: 'SHA-256',
    exp: 300000,
    iat: String(now),
  });
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(settings.privateKey).toString('base64url')}`;
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

    const callbackBaseUrl = required('PAYGLOCAL_CALLBACK_URL');
    if (!validHttpsUrl(callbackBaseUrl)) throw new Error('PAYGLOCAL_CALLBACK_URL must be a public HTTPS URL.');
    // Validate required credential configuration before storing a new order.
    config();

    orderId = `SFE${randomBytes(16).toString('hex')}`;
    const callbackUrl = new URL(callbackBaseUrl);
    callbackUrl.searchParams.set('merchantTxnId', orderId);
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
          callingCode: phone.callingCode,
          phoneNumber: phone.phoneNumber,
        },
      },
      merchantCallbackURL: callbackUrl.toString(),
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
      console.error('PayGlocal response did not include a valid hosted checkout URL', {
        orderId,
        httpStatus: result.status,
        gatewayStatus: result.data.status,
        reasonCode: result.data.reasonCode,
        message: result.data.message,
        responseFields: Object.keys(result.data),
        dataFields: Object.keys(nested),
        hasGid: Boolean(gid),
        hasRedirectUrl: Boolean(redirectUrl),
      });
      throw new Error('PayGlocal returned an invalid hosted checkout response.');
    }
    const update: Record<string, unknown> = {
      payglocalGid: gid,
      rawStatus: String(result.data.status ?? 'INPROGRESS'),
    };
    await Payment.updateOne({ orderId }, { $set: update });
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

    if (payment.status === 'PENDING' && payment.payglocalGid) {
      try {
        const settings = config();
        const statusToken = createStatusToken(settings);
        const response = await fetch(`${settings.baseUrl}${API_PATH}/${encodeURIComponent(payment.payglocalGid)}/status`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'x-gl-token-external': statusToken,
            'x-gl-merchantid': settings.merchantId,
            'x-gl-kid': settings.privateKeyId,
          },
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const gatewayStatus = await response.json() as PaymentResult;
          const nested = gatewayStatus.data && typeof gatewayStatus.data === 'object'
            ? gatewayStatus.data as Record<string, unknown>
            : {};
          const fields = getResultFields(gatewayStatus);
          const receivedGids = [gatewayStatus.gid, nested.gid].filter((value): value is string => typeof value === 'string');
          const amount = Number(fields.amount);
          const currency = String(fields.currency ?? '').toUpperCase();
          const rawStatus = String(gatewayStatus.status ?? nested.status ?? 'UNKNOWN');
          const amountMatches = fields.amount === undefined ||
            (Number.isFinite(amount) && Math.abs(amount - payment.amount) <= 0.01);
          const currencyMatches = fields.currency === undefined || currency === payment.currency;
          const txnId = String(fields.merchantTxnId ?? '').trim();
          if ((receivedGids.length === 0 || receivedGids.includes(payment.payglocalGid)) &&
              (!txnId || txnId === payment.orderId) && amountMatches && currencyMatches) {
            const status = statusFor(rawStatus);
            const update: Record<string, unknown> = { status, rawStatus };
            if (status === 'PAID') update.paymentDate = new Date();
            await Payment.updateOne({ orderId, status: { $ne: 'PAID' } }, { $set: update });
          } else {
            console.error('PayGlocal status response did not match the pending order', { orderId, rawStatus });
          }
        } else {
          const responseText = await response.text();
          let gatewayError: Record<string, unknown> = {};
          try { gatewayError = responseText ? JSON.parse(responseText) as Record<string, unknown> : {}; } catch { /* Ignore non-JSON error text. */ }
          const errorDetails = gatewayError.errors && typeof gatewayError.errors === 'object'
            ? gatewayError.errors as Record<string, unknown>
            : {};
          console.warn('PayGlocal status check was not successful', {
            orderId,
            httpStatus: response.status,
            reasonCode: gatewayError.reasonCode,
            message: gatewayError.message,
            detailedMessage: errorDetails.detailedMessage,
          });
        }
      } catch (error) {
        console.warn('PayGlocal status check failed', {
          orderId,
          message: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }

    const currentPayment = await Payment.findOne({ orderId });
    if (!currentPayment) return res.status(404).json({ message: 'Order not found.' });
    return res.json({ orderId, status: currentPayment.status === 'CREATED' ? 'PENDING' : currentPayment.status,
      amount: currentPayment.amount, currency: currentPayment.currency, rawStatus: currentPayment.rawStatus });
  } catch (error) {
    console.error('PayGlocal status lookup failed', { message: error instanceof Error ? error.message : 'unknown error' });
    return res.status(500).json({ message: 'Unable to verify payment status.' });
  }
}

export async function paymentCallback(req: Request, res: Response) {
  try {
    const result = decodeAndVerifyToken(responseToken(req));
    if (!result) {
      const orderId = callbackOrderId(req);
      console.error('PayGlocal callback token could not be verified', {
        method: req.method,
        contentType: req.get('content-type'),
        hasToken: Boolean(responseToken(req)),
        tokenParts: responseToken(req).split('.').length,
        orderId: orderId || undefined,
      });
      return res.redirect(303, checkoutReturnUrl(orderId
        ? { order_id: orderId, payment: 'verification_failed' }
        : { payment: 'verification_failed' }));
    }
    const payment = await updatePaymentFromVerifiedResult(result);
    if (!payment) {
      const orderId = callbackOrderId(req);
      return res.redirect(303, checkoutReturnUrl(orderId
        ? { order_id: orderId, payment: 'order_not_found' }
        : { payment: 'order_not_found' }));
    }
    return res.redirect(303, checkoutReturnUrl({ order_id: payment.orderId }));
  } catch (error) {
    console.error('PayGlocal callback failed', { message: error instanceof Error ? error.message : 'unknown error' });
    const orderId = callbackOrderId(req);
    return res.redirect(303, checkoutReturnUrl(orderId
      ? { order_id: orderId, payment: 'verification_failed' }
      : { payment: 'verification_failed' }));
  }
}

// If the callback URL is opened directly in a browser, send the visitor back to the app.
export function paymentCallbackBrowserReturn(req: Request, res: Response) {
  if (responseToken(req)) return paymentCallback(req, res);
  const orderId = callbackOrderId(req);
  if (orderId) return res.redirect(303, checkoutReturnUrl({ order_id: orderId, payment: 'return_pending' }));
  return res.redirect(303, checkoutReturnUrl({ payment: 'return_pending' }));
}

