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

MID, key IDs, and keys are environment-specific. Use UAT credentials from the UAT GCC dashboard for UAT, and separate production credentials only after approval. Keep secrets in a server-side secret store; never put them in Vite variables or commit `.env`.

The official Node SDK (`payglocal-js-client`) creates the JWE and JWS. For initiation, the server sends the JWE as the raw request body with `Content-Type: text/plain`, and the JWS in `x-gl-token-external`, to `/gl/v1/payments/initiate/paycollect`.

The order payload uses `merchantTxnId`, invoice amount/currency, and only the available customer name, email, calling code, and phone number. Card entry takes place on PayGlocal's hosted page. To make the hosted experience card-only, enable only cards for this MID in PayGlocal's merchant configuration; the public PayCollect request documentation does not specify a request field that restricts methods. Confirm card brands, permitted amounts, and currencies for this MID with PayGlocal.

## Payment flow

1. `POST /api/payments/orders` validates the billing request, stores a pending order, initiates PayCollect, and returns its HTTPS hosted checkout URL.
2. The browser navigates to PayGlocal. Card entry stays on PayGlocal.
3. PayGlocal returns the browser to `/api/payments/callback`; the server verifies a signed `x-gl-token` when provided and redirects to `/checkout?order_id=...`.
4. The checkout page calls `GET /api/payments/orders/:orderId`. While the record is pending, the server calls PayGlocal `GET /gl/v1/payments/{gid}/status`, signs the empty GET request using the merchant private key, and sends `x-gl-token-external`, `x-gl-merchantid`, and `x-gl-kid`.
5. The server validates any transaction identifiers, amount, and currency returned by PayGlocal, saves the status, and returns the updated order. The checkout page shows the success popup only after the saved status is `PAID` (`SENT_FOR_CAPTURE`).

Only `SENT_FOR_CAPTURE` is paid. `AUTHORIZED` remains pending. Declines, cancellation, abandonment, and request errors are failures. A paid order cannot be downgraded by a duplicate or late notification. The installed SDK provides JWE/JWS creation, but no callback verification or payment-status helper; callback verification uses Node's RS256 verifier, and the status endpoint returns the locally reconciled database state. Confirm with PayGlocal that the downloaded public key is the appropriate key for verifying callback signatures.

## Routes

- `POST /api/payments/orders`
- `GET /api/payments/orders/:orderId`
- `POST /api/payments/callback` (signed browser payment response)

Use PayGlocal UAT payment instruments for end-to-end testing. Do not switch to production until PayGlocal has enabled international card processing and confirmed the merchant's production MID, credentials, and currencies.
