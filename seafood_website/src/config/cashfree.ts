export type CashfreeMode = "sandbox" | "production";

const rawMode = import.meta.env.VITE_CASHFREE_ENV?.trim().toLowerCase();

export const cashfreeConfig = {
  ordersApi: (import.meta.env.VITE_PAYMENTS_API_URL || "/api/payments/orders").replace(/\/$/, ""),
  sdkUrl: (import.meta.env.VITE_CASHFREE_SDK_URL || "https://sdk.cashfree.com/js/v3/cashfree.js").trim(),
  mode: (rawMode === "production" ? "production" : "sandbox") as CashfreeMode,
} as const;
