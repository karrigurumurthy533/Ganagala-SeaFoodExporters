# PayGlocal PayCollect

The checkout uses PayGlocal hosted PayCollect. Card and UPI credentials are entered on PayGlocal and never pass through this site.

## UAT configuration

Copy `.env.example` to `.env` on the server and configure `MONGODB_URI`, `CLIENT_URL`, `PAYGLOCAL_ENV=uat`, `PAYGLOCAL_MERCHANT_ID`, `PAYGLOCAL_PRIVATE_KEY_ID`, `PAYGLOCAL_PRIVATE_KEY`, `PAYGLOCAL_PUBLIC_KEY_ID`, `PAYGLOCAL_PUBLIC_KEY`, `PAYGLOCAL_PUBLIC_CERT`, and `PAYGLOCAL_CALLBACK_URL`. Use matching UAT MID/key material from the UAT GCC. The callback must be a public HTTPS URL ending in `/api/payments/callback`. Never put gateway secrets in the Vite frontend environment or commit `.env`.

The initiate request uses PayGlocal's official `payglocal-js-client` to encrypt the transaction JSON as a JWE using PayGlocal's public key and to sign its digest as a JWS using the merchant private key. The encrypted token is sent as the JSON request body and the JWS is sent in `x-gl-token-external`. The server verifies callback signatures with PayGlocal's public certificate. Ask PayGlocal support for the UAT MID, merchant private key/KID, PayGlocal encryption public key/KID, and callback verification certificate if any are missing.

## Flow

`POST /api/payments/orders` creates a random merchant transaction ID and a pending MongoDB payment, starts PayCollect, and returns the hosted `redirectUrl`. The browser navigates to that URL. PayGlocal posts `x-gl-token` to the callback endpoint; the callback verifies the signature, checks the order details, and the server then fetches status from PayGlocal before reconciling. `GET /api/payments/orders/:orderId` also polls PayGlocal and reconciles `PAID`, `FAILED`, and `PENDING` states. A conditional MongoDB update prevents duplicate callbacks from downgrading a paid payment.

Only `SENT_FOR_CAPTURE` is treated as paid. `AUTHORIZED` remains pending. Declines, abandonment, cancellation, and request errors are failed. Callback data alone is never treated as payment confirmation.

## Routes

- `POST /api/payments/orders`
- `POST /api/payments/callback` (PayGlocal callback)
- `GET /api/payments/orders/:orderId`

Use PayGlocal UAT test payment methods/cards from the merchant dashboard for end-to-end UAT. Switch to production only with production credentials and a production-approved MID.
