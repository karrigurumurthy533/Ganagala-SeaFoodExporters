import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

type PolicyKind = "refund" | "terms" | "privacy" | "shipping";
type PolicySection = { heading: string; content: ReactNode };
type PolicyContent = { title: string; effectiveDate: string; intro?: ReactNode; sections: PolicySection[] };
const contactEmail = "ganagalaseafoodexporters@gmail.com";
const contactPhone = "+91 9110395281";
const emailLink = <a className="font-semibold text-sky-700 underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>;
const phoneLink = <a className="font-semibold text-sky-700 underline underline-offset-2" href="tel:+919110395281">{contactPhone}</a>;
const siteLink = <a className="font-semibold text-sky-700 underline underline-offset-2" href="https://ganagalaseafoodexporters.com">ganagalaseafoodexporters.com</a>;

const policies: Record<PolicyKind, PolicyContent> = {
  refund: {
    title: "Refund & Cancellation Policy",
    effectiveDate: "November 25, 2026",
    sections: [
      { heading: "Cancellation Timeline & Channels", content: <>Orders can be cancelled within 2 hours of placing the order (or before dispatch/packing starts). Once packed or handed over to delivery/logistics, orders cannot be cancelled. To cancel, email {emailLink} or call/WhatsApp {phoneLink} with your Order ID.</> },
      { heading: "Return / Replacement / Refund", content: "Due to perishable food-safety rules, opened or non-defective seafood items cannot be returned. Replacement or refund applies only if you receive the wrong item/quantity or damaged/spoiled goods upon delivery." },
      { heading: "Reporting TAT", content: "Issues must be reported within 24 hours of delivery with your Order ID and clear photos/videos." },
      { heading: "Refund Mode & Timeline", content: "Approved refunds are reviewed within 2–3 business days and credited back to the original payment method within 5–7 business days." },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    effectiveDate: "November 25, 2026",
    intro: <>By using {siteLink} or placing an order, you agree to these Terms & Conditions:</>,
    sections: [
      { heading: "Company's Legal Terms", content: "Ganagala Seafood Exporters is a registered proprietorship operating under FSSAI Registration 22026038000140 and IEC CIYPC8532P. All orders are subject to stock/seasonal availability, address verification, and payment confirmation." },
      { heading: "Governing Law", content: "These Terms are governed by the laws of India, with exclusive jurisdiction of courts in Ganjam District, Odisha." },
      { heading: "Termination", content: "We reserve the right to suspend access or cancel orders in cases of suspected fraud, unauthorized activity, or breach of these Terms." },
      { heading: "Intellectual Property", content: "All website text, images, logos, and content belong to Ganagala Seafood Exporters and may not be copied or reused without written permission." },
      { heading: "Limitation of Liability", content: "To the extent permitted by Indian law, our maximum liability for any order is limited to the amount paid for that specific order, and we are not liable for indirect or consequential losses." },
      { heading: "Ganagala Seafood Exporters", content: "Ganagala Seafood Exporters - Premium quality seafood delivered to global markets." },
    ],
  },
  shipping: {
    title: "Shipping & Delivery Policy",
    effectiveDate: "November 26, 2026",
    sections: [
      { heading: "Cold-Chain Dispatch", content: "Ganagala Seafood Exporters dispatches fresh, chilled, and frozen seafood in insulated cold-chain packaging in compliance with FSSAI standards." },
      { heading: "Processing Time", content: "Orders are processed and dispatched within 24\u201348 hours of payment confirmation, excluding Sundays and holidays, and subject to catch availability." },
      { heading: "Estimated Delivery Time", content: <>Odisha, Andhra Pradesh &amp; Telangana: 1\u20133 business days.<br />Other serviceable Indian cities: 2\u20135 business days.<br />International exports (IEC CIYPC8532P): as per the air/sea freight schedule in the commercial invoice.</> },
      { heading: "Shipping Charges", content: "Shipping charges are calculated based on weight, packaging, and destination pincode, and are shown clearly at checkout before payment." },
      { heading: "Perishable Delivery Rule", content: "Buyers must be available at the delivery address to receive the shipment on time. We are not responsible for spoilage caused by incorrect addresses, unreachable phone numbers, or missed delivery attempts." },
      { heading: "Tracking & Support", content: <>Tracking details are sent via SMS, WhatsApp, or email upon dispatch. For help, contact {emailLink} or {phoneLink}.</> },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    effectiveDate: "November 25, 2026",
    sections: [
      { heading: "Privacy Commitment", content: <>Ganagala Seafood Exporters ("we," "our," "us") respects your privacy and processes personal data in accordance with Indian laws, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.</> },
      { heading: "Information Collection & Use", content: "We collect your name, phone number, email, shipping/billing address, and order details to process orders, arrange delivery, provide customer support, and meet legal/tax obligations. Payment card/UPI details are processed securely via authorized payment gateways; we do not store full payment credentials." },
      { heading: "Third-Party Disclosure", content: "We do not sell personal data. Information is shared only with trusted payment gateways, logistics/courier partners, IT hosting providers, or government authorities when required by law." },
      { heading: "Information Protection", content: "We use HTTPS encryption, access controls, and standard security safeguards to protect your data." },
      { heading: "User Rights", content: <>You may request access, correction, deletion of your personal data, withdraw consent, or raise a privacy grievance by contacting us at {emailLink} or {phoneLink}.</> },
      { heading: "Cookie Policy", content: "We use essential cookies for cart/checkout functionality and basic analytics cookies to improve site performance. You can manage cookies in your browser settings." },
      { heading: "Policy Changes", content: "Updates to this policy will be posted on this page with a revised effective date." },
    ],
  },
};

export default function PolicyPage({ policy }: { policy: PolicyKind }) {
  const content = policies[policy];
  return (
    <section className="min-h-[70vh] bg-gradient-to-br from-ice-50 via-white to-sky-50 px-5 py-12 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-ocean-900 transition hover:text-sky-600"><ArrowLeft size={16} /> Back to home</Link>
        <header className="mt-8 rounded-3xl bg-ocean-950 px-6 py-10 text-white shadow-xl shadow-blue-950/10 sm:px-10">
          <p className="text-xs font-extrabold tracking-[.2em] text-sky-300">GANAGALA SEAFOOD EXPORTERS</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{content.title}</h1>
          <p className="mt-4 text-sm text-blue-100/80">Effective Date: {content.effectiveDate}</p>
          {content.intro && <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100/80">{content.intro}</p>}
        </header>
        <div className="mt-6 grid gap-4">
          {content.sections.map((section) => (
            <article key={section.heading} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-extrabold text-ocean-950">{section.heading}</h2>
              <div className="mt-3 text-sm leading-7 text-blue-950/70">{section.content}</div>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-ocean-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><ShieldCheck className="shrink-0 text-sky-600" size={20} /><span>Need help with an order or payment?</span></div>
          <Link to="/contact" className="inline-flex items-center gap-2 font-bold text-sky-700 hover:text-ocean-950">Contact our team <ArrowRight size={15} /></Link>
        </div>
      </div>
    </section>
  );
}