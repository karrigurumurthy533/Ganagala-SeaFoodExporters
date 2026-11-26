# Cashfree Payments

The payment flow is integrated into the existing React/Vite site and TypeScript/Express API. It uses Cashfree Hosted Checkout; card number, expiry, and CVV are handled only by Cashfree.

## Environment

Copy `.env.example` to `.env` and configure MongoDB, Cashfree credentials, `CASHFREE_ENV`, `CASHFREE_MERCHANT_PHONE`, and `CLIENT_URL`. For the production site, use `CLIENT_URL=https://ganagalaseafoodexporters.com`. The merchant phone is sent to Cashfree because its Create Order API requires `customer_phone`; it is not collected from the website form or saved in MongoDB.

Use sandbox credentials with `CASHFREE_ENV=sandbox` for testing. For live use production credentials and `CASHFREE_ENV=production`. The backend selects the corresponding Cashfree API host and returns its mode to the frontend, ensuring checkout is initialized in the matching environment.

## Start

From `Server`, run `npm install` and `npm run dev` during development, or `npm start` for the compiled server. From `seafood_website`, run `npm install` and `npm run dev`. The Vite proxy to `http://localhost:5000` is only for local development; production payment returns to the URL in `CLIENT_URL`.

## Payment and verification

`POST /api/payments/orders` creates a unique Cashfree order and returns `paymentSessionId` and `cashfreeMode`. The frontend validates the session and passes that exact ID to Cashfree Checkout. `GET /api/payments/orders/:orderId` and the signed webhook reconcile payment status with Cashfree. MongoDB is marked `PAID` only when Cashfree confirms the order is `PAID` and a successful payment attempt matches the stored amount and currency. Card data is never stored.

Configure Cashfree webhook events at `https://ganagalaseafoodexporters.com/api/payments/webhook`. Use HTTPS and whitelist the production website domain in the Cashfree dashboard. Enable card payments in the merchant dashboard.
