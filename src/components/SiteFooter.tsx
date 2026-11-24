
import {
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  Phone,
} from "lucide-react";
import { Link } from "react-router-dom";

const footerLinks = [
  ["/", "Home"],
  ["/about", "About Us"],
  ["/products", "Our Products"],
  ["/processing-quality", "Processing & Quality"],
  ["/infrastructure", "Infrastructure"],
  ["/export-markets", "Export Markets"],
  ["/contact", "Contact Us"],
] as const;

export default function SiteFooter() {
  return (
    <footer className="bg-[#06264a] text-white">
      <div className="mx-auto grid max-w-[1440px] gap-9 px-[6%] py-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr] lg:gap-14 lg:py-14">
        <div>
          <Link to="/" className="inline-block">
            <img
              src="/images/logo.png"
              alt="Ganagala Seafood Exporters"
              className="h-14 w-auto object-contain"
            />
          </Link>

          <p className="mt-4 max-w-sm text-sm leading-relaxed text-blue-100/75">
            Premium quality seafood, carefully processed and delivered to global
            markets.
          </p>

          <div className="mt-5 flex gap-3">
            <a
              href="https://www.facebook.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="rounded-full border border-white/20 p-2.5 transition hover:bg-white/10"
            >
              <Facebook size={17} />
            </a>

            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="rounded-full border border-white/20 p-2.5 transition hover:bg-white/10"
            >
              <Instagram size={17} />
            </a>

            <a
              href="https://www.linkedin.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="rounded-full border border-white/20 p-2.5 transition hover:bg-white/10"
            >
              <Linkedin size={17} />
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[.16em] text-sky-300">
            Quick Links
          </h2>

          <nav className="mt-4 grid gap-3 text-sm text-blue-100/80">
            {footerLinks.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="w-fit transition hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[.16em] text-sky-300">
            Enquiries
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-blue-100/75">
            For product details, pricing, or export partnerships, contact our
            team.
          </p>

          <a
            href="tel:+919110395281"
            className="mt-4 flex items-center gap-2 text-sm text-blue-100/90 hover:text-white"
          >
            <Phone size={15} /> +91 9110395281
          </a>

          <a
            href="mailto:ganagalaseafoodexportesr@gmail.com"
            className="mt-3 flex items-center gap-2 text-sm text-blue-100/90 hover:text-white"
          >
            <Mail size={15} /> ganagalaseafoodexportesr@gmail.com
          </a>

          <Link
            to="/contact"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-bold transition hover:bg-sky-400"
          >
            Send an Enquiry <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-[6%] py-4 text-xs text-blue-100/55 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Ganagala Seafood Exporters</span>
          <span>Premium Quality | Global Standards</span>
        </div>
      </div>
    </footer>
  );
}
