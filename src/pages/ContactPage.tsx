import { Mail, MapPin, Phone, ArrowRight } from "lucide-react";
import { useState } from "react";
function ContactForm() {
  const [sent, setSent] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="grid gap-2.5 rounded-xl border border-blue-100 bg-white/80 p-3 shadow-md shadow-blue-950/5 backdrop-blur sm:grid-cols-2 sm:p-4"
    >
      <label className="text-[9px] font-semibold text-blue-900">
        Your Name <span className="text-red-500">*</span>
        <input
          required
          placeholder="Your Name"
          className="mt-1.5 w-full rounded-lg border border-blue-100 bg-white/80 px-2.5 py-2 text-[10px] outline-none focus:border-sky-400"
        />
      </label>
      <label className="text-[9px] font-semibold text-blue-900">
        Your Email <span className="text-red-500">*</span>
        <input
          required
          type="email"
          placeholder="Your Email"
          className="mt-1.5 w-full rounded-lg border border-blue-100 bg-white/80 px-2.5 py-2 text-[10px] outline-none focus:border-sky-400"
        />
      </label>
      <label className="text-[9px] font-semibold text-blue-900 sm:col-span-2">
        Your Message <span className="text-red-500">*</span>
        <textarea
          required
          rows={3}
          placeholder="Your Message"
          className="mt-1.5 w-full resize-none rounded-lg border border-blue-100 bg-white/80 px-2.5 py-2 text-[10px] outline-none focus:border-sky-400"
        />
      </label>
      <button className="flex w-fit items-center gap-1.5 rounded-full bg-ocean-900 px-4 py-2 text-[10px] font-bold text-white hover:bg-sky-600">
        {sent ? "Message Ready" : "Send Message"}
        <ArrowRight size={12} />
      </button>
    </form>
  );
}
export default function ContactPage() {
  return (
    <section className="relative min-h-[268px] overflow-hidden bg-gradient-to-r from-white via-ice-50 to-sky-100 min-[900px]:min-h-[420px] lg:min-h-[520px]">
      <div className="absolute inset-y-0 right-0 w-[36%]">
        <img
          src="/images/contact-scene.png"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/15 to-transparent" />
      </div>
      <div className="relative mx-auto grid min-h-[268px] max-w-[1440px] grid-cols-[30%_45%_25%] items-center gap-4 px-[6%] min-[900px]:min-h-[420px] lg:min-h-[520px] max-[679px]:min-h-[720px] max-[679px]:grid-cols-1 max-[679px]:content-start max-[679px]:gap-4 max-[679px]:pt-7">
        <div className="relative z-10">
          <p className="mb-2 text-[9px] font-extrabold tracking-[.18em] text-ocean-900">
            GET IN TOUCH
          </p>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ocean-950 lg:text-5xl">
            Contact Us
          </h1>
          <p className="mt-2 max-w-[220px] text-[10px] leading-relaxed text-blue-950/90 lg:text-sm">
            We are here to assist you. Reach out to us for inquiries, quotes and
            partnership opportunities.
          </p>
          <div className="mt-3 grid gap-2 text-[9px] font-medium text-ocean-950 lg:text-xs">
            <a className="flex items-center gap-2" href="tel:+919110395281">
              <Phone size={13} />
              +91 9110395281
            </a>
            <a
              className="flex items-center gap-2"
              href="mailto:ganagalaseafoodexportesr@gmail.com"
            >
              <Mail size={13} />
              ganagalaseafoodexportesr@gmail.com
            </a>
            <span className="flex items-center gap-2">
              <MapPin size={13} />
              Berhapur,Patisonnapur, odisha, India
            </span>
          </div>
        </div>
        <ContactForm />
        <div className="max-[679px]:hidden" />
      </div>
    </section>
  );
}
