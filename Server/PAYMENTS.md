# PayGlocal hosted card checkout

This server starts PayGlocal PayCollect hosted checkout. The customer enters card details on PayGlocal, so card number, expiry, and CVV never reach this website. PayCollect can accept major debit and credit cards, including international cards when card acceptance and the relevant currencies are enabled for this merchant MID. Confirm enablement and test cards with PayGlocal before production; integration code cannot turn on card brands or countries that are disabled on the MID.

## Configuration

Copy `.env.example` to `.env` and configure:

- `MONGODB_URI`
- `CLIENT_URL` (one or more comma-separated frontend origins)
- `PAYGLOCAL_ENV=uat` until PayGlocal confirms production access
- `PAYGLOCAL_MERCHANT_ID`
- `PAYGLOCAL_PRIVATE_KEY_ID` and `PAYGLOCAL_PRIVATE_KEY`
- `PAYGLOCAL_PUBLIC_KEY_ID` and `PAYGLOCAL_PUBLIC_KEY`
- `PAYGLOCAL_CALLBACK_URL=https://<api-host>/api/payments/callback`

MID, key IDs, keys, and certificates are environment-specific. Use UAT credentials from the UAT GCC dashboard for UAT, and separate production credentials only after approval. Keep secrets in a server-side secret store; never put them in Vite variables or commit `.env`.

The official Node SDK (`payglocal-js-client`) creates the JWE and JWS. For initiation, the server sends the JWE as the raw request body with `Content-Type: text/plain`, and the JWS in `x-gl-token-external`, to `/gl/v1/payments/initiate/paycollect`.

The order payload follows the PayCollect SaaS shape and includes this seafood exporter's invoice amount, currency, and billing contact. The sample in the email references a travel-specific payload not included in the attachment, so no travel-only fields are invented here. ISO country and currency codes, permitted amounts, billing fields, and currency availability should be confirmed with PayGlocal for this MID.

## Payment flow

1. `POST /api/payments/orders` validates the billing request, stores a pending order, initiates PayCollect, and returns its HTTPS hosted checkout URL.
2. The browser navigates to PayGlocal. Card entry stays on PayGlocal.
3. PayGlocal posts an `x-gl-token` to `/api/payments/callback`; the server decodes its payload, checks MID/order/amount/currency, updates the record, and redirects the browser to `/checkout?order_id=...`.
4. If PayGlocal registers `/api/payments/webhook` for server-to-server notifications, the endpoint acknowledges delivery. It decodes `x-gl-token` notifications and reconciles matching order details.
5. `GET /api/payments/orders/:orderId` returns the locally reconciled state for the checkout page.

Only `SENT_FOR_CAPTURE` is paid. `AUTHORIZED` remains pending. Declines, cancellation, abandonment, and request errors are failures. A paid order cannot be downgraded by a duplicate or late notification.

## Routes

- `POST /api/payments/orders`
- `GET /api/payments/orders/:orderId`
- `POST /api/payments/callback` (signed browser payment response)
- `POST /api/payments/webhook` (separate server-to-server notification)

Use PayGlocal UAT payment instruments for end-to-end testing. Do not switch to production until PayGlocal has enabled international card processing and confirmed the merchant's production MID, credentials, currencies, and webhook format.
