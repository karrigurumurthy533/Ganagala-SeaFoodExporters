import { Mail, MapPin, Phone } from "lucide-react";
import ContactForm from "../components/ContactForm";
export default function ContactPage() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-white via-ice-50 to-sky-100">
      <div className="absolute inset-y-0 right-0 w-[42%] max-[800px]:w-full max-[800px]:opacity-20">
        <img
          src="/images/contact-scene.png"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/50 to-transparent" />
      </div>
      <div className="relative mx-auto grid max-w-[1440px] grid-cols-[.8fr_1.2fr] items-center gap-12 px-[6%] py-16 lg:min-h-[540px] max-[800px]:grid-cols-1 max-[800px]:gap-8 max-[800px]:py-12">
        <div className="relative z-10">
          <p className="mb-3 text-xs font-extrabold tracking-[.18em] text-ocean-900">
            GET IN TOUCH
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ocean-950 lg:text-6xl">
            Contact Us
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-blue-950/80 lg:text-base">
            We are here to assist you. Reach out to us for inquiries, quotes and
            partnership opportunities.
          </p>
          <div className="mt-7 grid gap-4 text-sm font-semibold text-ocean-950">
            <a className="flex items-center gap-3 hover:text-sky-600" href="tel:+919110395281">
              <Phone size={17} className="text-sky-600" />
              +91 9110395281
            </a>
            <a
              className="flex items-center gap-3 hover:text-sky-600"
              href="mailto:ganagalaseafoodexportesr@gmail.com"
            >
              <Mail size={17} className="text-sky-600" />
              ganagalaseafoodexportesr@gmail.com
            </a>
            <span className="flex items-center gap-3">
              <MapPin size={17} className="shrink-0 text-sky-600" />
              Berhapur,Patisonnapur, odisha, India
            </span>
          </div>
        </div>
        <div className="relative z-10"><ContactForm /></div>
      </div>
    </section>
  );
}
