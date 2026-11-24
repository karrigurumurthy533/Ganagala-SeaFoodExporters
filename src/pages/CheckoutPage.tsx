import { useState } from "react";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const fieldClass =
  "mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-ocean-950 outline-none transition placeholder:text-blue-950/35 focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
const labelClass = "block text-xs font-bold text-ocean-950";

export default function CheckoutPage() {
  const [notice, setNotice] = useState(false);

  return (
    <section className="min-h-[70vh] bg-gradient-to-br from-ice-50 via-white to-sky-50 px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm font-bold text-ocean-900 transition hover:text-sky-600">
          <ArrowLeft size={16} /> Back to products
        </Link>

        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="text-xs font-extrabold tracking-[.2em] text-sky-600">SECURE CHECKOUT</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ocean-950 sm:text-5xl">Complete your order</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-950/65">
              Enter billing details for your seafood export order. Final pricing and shipment terms are confirmed with our team.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                setNotice(true);
              }}
              className="mt-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-ocean-950">Payment details</h2>
                  <p className="mt-1 text-xs text-blue-950/55">Card payment</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-ice-50 px-3 py-2 text-xs font-bold text-ocean-900">
                  <LockKeyhole size={14} /> Secure checkout
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>
                  Cardholder name
                  <input className={fieldClass} name="cardholder" autoComplete="cc-name" placeholder="Name on card" required />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Card number
                  <input className={fieldClass} name="card-number" inputMode="numeric" autoComplete="cc-number" placeholder="1234  5678  9012  3456" maxLength={23} required />
                </label>
                <label className={labelClass}>
                  Expiration date
                  <input className={fieldClass} name="expiration" autoComplete="cc-exp" placeholder="MM / YY" maxLength={7} required />
                </label>
                <label className={labelClass}>
                  Security code
                  <input className={fieldClass} name="security-code" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" maxLength={4} required />
                </label>
              </div>

              <div className="mt-9 border-t border-blue-100 pt-7">
                <h2 className="text-xl font-extrabold text-ocean-950">Billing address</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <label className={labelClass}>
                    State / Province
                    <input className={fieldClass} name="region" autoComplete="address-level1" placeholder="State or province" required />
                  </label>
                  <label className={labelClass}>
                    Country
                    <select className={fieldClass} name="country" autoComplete="country-name" defaultValue="" required>
                      <option value="" disabled>Select country</option>
                      <option>India</option>
                      <option>United States</option>
                      <option>United Kingdom</option>
                      <option>Germany</option>
                      <option>Japan</option>
                      <option>Australia</option>
                      <option>Other</option>
                    </select>
                  </label>
                </div>
              </div>

              <button type="submit" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ocean-900 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-ocean-900/15 transition hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-200">
                <LockKeyhole size={16} /> Pay Now
              </button>
              {notice && (
                <p role="status" className="mt-4 rounded-xl bg-ice-50 p-4 text-sm leading-6 text-ocean-900">
                  Payment is not available in this preview. No details were submitted or saved. Please contact our team to confirm your order.
                </p>
              )}
            </form>
          </div>

          <aside className="w-full rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-950/5 lg:sticky lg:top-8 lg:mt-36">
            <p className="text-xs font-extrabold tracking-[.18em] text-sky-600">ORDER SUMMARY</p>
            <h2 className="mt-2 text-2xl font-extrabold text-ocean-950">Export order</h2>
            <div className="mt-6 space-y-4 border-y border-blue-100 py-5 text-sm">
              <div className="flex justify-between gap-4 text-blue-950/65"><span>Products</span><span>To be confirmed</span></div>
              <div className="flex justify-between gap-4 text-blue-950/65"><span>Shipping</span><span>To be confirmed</span></div>
              <div className="flex justify-between gap-4 font-extrabold text-ocean-950"><span>Total</span><span>Quote pending</span></div>
            </div>
            <div className="mt-5 flex gap-3 rounded-2xl bg-ice-50 p-4 text-xs leading-5 text-ocean-900">
              <ShieldCheck size={19} className="shrink-0 text-sky-600" />
              Your final invoice and delivery terms will be shared after the order is reviewed.
            </div>
            <Link to="/contact" className="mt-5 inline-flex text-sm font-bold text-sky-700 hover:text-ocean-950">Questions? Contact our team</Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
