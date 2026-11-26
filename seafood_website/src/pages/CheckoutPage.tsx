import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, CircleHelp, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { cashfreeConfig, type CashfreeMode } from "../config/cashfree";

const fieldClass =
  "mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-ocean-950 outline-none transition placeholder:text-blue-950/35 focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
const labelClass = "block text-xs font-bold text-ocean-950";
const { ordersApi, sdkUrl: CASHFREE_SDK_URL } = cashfreeConfig;

type CashfreeCheckoutResult = {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
};
type CashfreeCheckout = {
  checkout(options: {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_modal";
    returnUrl?: string;
  }): Promise<CashfreeCheckoutResult | undefined>;
};
type PaymentStatus = "PAID" | "PENDING" | "CANCELLED" | "FAILED";

declare global {
  interface Window {
    Cashfree?: (options: { mode: CashfreeMode }) => CashfreeCheckout;
  }
}

let cashfreeSdkPromise: Promise<void> | null = null;

function loadCashfreeSdk() {
  if (window.Cashfree) return Promise.resolve();
  if (cashfreeSdkPromise) return cashfreeSdkPromise;

  cashfreeSdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CASHFREE_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        resolve();
      } else {
        cashfreeSdkPromise = null;
        reject(new Error("Cashfree checkout could not be initialized."));
      }
    };
    script.onerror = () => {
      script.remove();
      cashfreeSdkPromise = null;
      reject(new Error("Could not load Cashfree checkout. Please try again."));
    };
    document.body.appendChild(script);
  });

  return cashfreeSdkPromise;
}

async function readJson(response: Response) {
  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`Payment request failed (${response.status}).`);
      }
      throw new Error(
        `Payment API (${response.url || ordersApi}) returned non-JSON (${response.status}). Check VITE_PAYMENTS_API_URL or Vite /api proxy.`,
      );
    }
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload && payload.message
        ? String(payload.message)
        : `Payment request failed (${response.status}).`;
    throw new Error(message);
  }
  return (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
}

function resolveCashfreeMode(serverMode: unknown): CashfreeMode {
  if (serverMode === "sandbox" || serverMode === "production") {
    return serverMode;
  }
  return cashfreeConfig.mode;
}

function mapOrderStatus(rawStatus: unknown): PaymentStatus {
  const normalized = String(rawStatus ?? "").trim().toUpperCase();
  if (normalized === "PAID") return "PAID";
  if (normalized === "EXPIRED" || normalized === "CANCELLED") return "CANCELLED";
  if (normalized === "FAILED" || normalized === "TERMINATED" || normalized === "TERMINATION_REQUESTED") {
    return "FAILED";
  }
  return "PENDING";
}

export default function CheckoutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [verifiedAmount, setVerifiedAmount] = useState<{ amount: number; currency: string } | null>(null);
  const [amount, setAmount] = useState("");

  async function checkStatus(id: string) {
    setChecking(true);
    setError("");
    try {
      const payload = await readJson(
        await fetch(`${ordersApi}/${encodeURIComponent(id)}`, {
          headers: { Accept: "application/json" },
        }),
      );
      setStatus(mapOrderStatus(payload.order_status ?? payload.status));
      const orderAmount = Number(payload.order_amount ?? payload.amount);
      if (Number.isFinite(orderAmount) && orderAmount > 0) {
        const orderCurrency =
          typeof (payload.order_currency ?? payload.currency) === "string"
            ? String(payload.order_currency ?? payload.currency)
            : "INR";
        setVerifiedAmount({ amount: orderAmount, currency: orderCurrency });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify payment status.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (orderId) {
      void checkStatus(orderId);
    } else {
      setStatus("");
      setVerifiedAmount(null);
    }
  }, [orderId]);

  async function startPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const numericAmount = Number(values.get("amount"));
    const phoneInput = String(values.get("customerPhone") ?? "").trim();
    const phoneDigits = phoneInput.replace(/\D/g, "");

    try {
      if (!Number.isFinite(numericAmount) || numericAmount < 1) {
        throw new Error("Enter an amount of at least INR 1.");
      }
      if (!/^\d{10,15}$/.test(phoneDigits)) {
        throw new Error("Enter a valid phone number (10 to 15 digits).");
      }

      const data = await readJson(
        await fetch(ordersApi, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            customerName: values.get("customerName"),
            customerEmail: values.get("customerEmail"),
            customerPhone: phoneDigits,
            amount: numericAmount,
            currency: "INR",
            country: values.get("country"),
          }),
        }),
      );

      const nested =
        (typeof data.data === "object" && data.data !== null ? (data.data as Record<string, unknown>) : null) ??
        (typeof data.order === "object" && data.order !== null ? (data.order as Record<string, unknown>) : null);

      const rawSessionId =
        data.payment_session_id ??
        data.paymentSessionId ??
        nested?.payment_session_id ??
        nested?.paymentSessionId;
      const paymentSessionId = typeof rawSessionId === "string" ? rawSessionId.trim() : "";
      if (!paymentSessionId) {
        const returnedKeys = Object.keys(data).join(", ") || "none";
        throw new Error(
          `The payment server did not return a valid Cashfree payment session (keys: ${returnedKeys}).`,
        );
      }

      const rawOrderId = data.order_id ?? data.orderId ?? nested?.order_id ?? nested?.orderId;
      const createdOrderId = typeof rawOrderId === "string" ? rawOrderId.trim() : "";
      if (!createdOrderId) {
        throw new Error("The payment server did not return an order ID.");
      }

      const cashfreeMode = resolveCashfreeMode(data.cashfreeMode ?? nested?.cashfreeMode);
      await loadCashfreeSdk();
      const cashfree = window.Cashfree?.({ mode: cashfreeMode });
      if (!cashfree) {
        throw new Error("Cashfree checkout could not be initialized.");
      }

      const returnUrl = `${window.location.origin}/checkout?order_id=${encodeURIComponent(createdOrderId)}`;
      // Cashfree owns the checkout fields, including card number, expiry, and CVV.
      // Use the exact session returned by this backend order response, never the order ID.
      const result = await cashfree.checkout({
        paymentSessionId,
        redirectTarget: "_modal",
        returnUrl,
      });

      if (result?.error) {
        throw new Error(result.error.message || "Cashfree checkout could not be completed.");
      }

      if (!result?.redirect) {
        setBusy(false);
        setSearchParams({ order_id: createdOrderId });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start payment.");
      setBusy(false);
    }
  }

  const paid = status === "PAID";
  const failed = status === "FAILED" || status === "CANCELLED";
  const pending = !paid && !failed;
  const formattedTotal = verifiedAmount
    ? `${verifiedAmount.currency === "INR" ? "₹" : `${verifiedAmount.currency} `}${verifiedAmount.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : amount
      ? `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "Enter amount";

  return (
    <section className="min-h-[70vh] bg-gradient-to-br from-ice-50 via-white to-sky-50 px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm font-bold text-ocean-900 hover:text-sky-600">
          <ArrowLeft size={16} /> Back to products
        </Link>
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="text-xs font-extrabold tracking-[.2em] text-sky-600">SECURE CHECKOUT</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ocean-950 sm:text-5xl">
              Complete your payment
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-950/65">
              Pay securely through Cashfree. Your card and UPI details are entered directly in Cashfree Checkout.
            </p>
            {orderId ? (
              <div className="mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    paid
                      ? "bg-emerald-50 text-emerald-600"
                      : failed
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {paid ? <CheckCircle2 size={28} /> : failed ? <XCircle size={28} /> : <CircleHelp size={28} />}
                </div>
                <h2 className="mt-5 text-2xl font-extrabold text-ocean-950">
                  {paid ? "Payment successful" : failed ? "Payment failed" : "Payment pending"}
                </h2>
                <p role="status" className="mt-2 text-sm leading-6 text-blue-950/65">
                  {paid
                    ? "Cashfree confirmed your payment. Your payment record has been saved."
                    : failed
                      ? "Cashfree did not confirm a successful payment. You can return to checkout to retry."
                      : "We are checking your payment directly with Cashfree. This page will not treat a browser response as confirmation."}
                </p>
                <p className="mt-4 break-all text-xs text-blue-950/50">Order reference: {orderId}</p>
                {pending && (
                  <button
                    type="button"
                    disabled={checking}
                    onClick={() => void checkStatus(orderId)}
                    className="mt-5 rounded-xl bg-ocean-900 px-5 py-3 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-60"
                  >
                    {checking ? "Checking…" : "Check payment status"}
                  </button>
                )}
                {error && (
                  <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                    {error}
                  </p>
                )}
                {failed && (
                  <Link to="/checkout" className="mt-5 inline-block text-sm font-bold text-sky-700">
                    Try another payment
                  </Link>
                )}
              </div>
            ) : (
              <form
                onSubmit={startPayment}
                className="mt-6 rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-ocean-950">Billing details</h2>
                    <p className="mt-1 text-xs text-blue-950/55">Enter the details for your confirmed invoice.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-ice-50 px-3 py-2 text-xs font-bold text-ocean-900">
                    <LockKeyhole size={14} /> Secure
                  </div>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className={labelClass}>
                    Customer name
                    <input
                      className={fieldClass}
                      name="customerName"
                      autoComplete="name"
                      minLength={2}
                      maxLength={100}
                      placeholder="Full name"
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Email address
                    <input
                      className={fieldClass}
                      type="email"
                      name="customerEmail"
                      autoComplete="email"
                      maxLength={254}
                      placeholder="you@example.com"
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Phone number
                    <input
                      className={fieldClass}
                      type="tel"
                      name="customerPhone"
                      autoComplete="tel"
                      minLength={10}
                      maxLength={20}
                      placeholder="+91 9876543210"
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Country
                    <input
                      className={fieldClass}
                      name="country"
                      autoComplete="country-name"
                      minLength={2}
                      maxLength={80}
                      placeholder="Country"
                      required
                    />
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>
                    Amount (INR)
                    <input
                      className={fieldClass}
                      type="number"
                      name="amount"
                      min="1"
                      max="10000000"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Invoice amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <button
                  disabled={busy}
                  type="submit"
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ocean-900 px-6 py-4 text-sm font-extrabold text-white shadow-lg transition hover:bg-sky-600 disabled:cursor-wait disabled:opacity-60"
                >
                  <LockKeyhole size={16} />
                  {busy ? "Opening Cashfree Checkout…" : "Pay Now"}
                </button>
                {busy && (
                  <p role="status" className="mt-3 text-center text-xs text-blue-950/55">
                    Secure checkout is loading…
                  </p>
                )}
                {error && (
                  <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
          <aside className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-950/5 lg:sticky lg:top-8 lg:mt-36">
            <p className="text-xs font-extrabold tracking-[.18em] text-sky-600">PAYMENT SUMMARY</p>
            <h2 className="mt-2 text-2xl font-extrabold text-ocean-950">Export invoice</h2>
            <div className="mt-6 flex justify-between border-y border-blue-100 py-5 text-sm font-extrabold text-ocean-950">
              <span>Total</span>
              <span>{formattedTotal}</span>
            </div>
            <div className="mt-5 flex gap-3 rounded-2xl bg-ice-50 p-4 text-xs leading-5 text-ocean-900">
              <ShieldCheck size={19} className="shrink-0 text-sky-600" />
              Card number, expiry date and CVV are entered only on Cashfree's hosted checkout and are never sent to this
              website.
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
