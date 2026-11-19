import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import SiteFooter from "./SiteFooter";

const links = [
  ["/", "Home"],
  ["/about", "About Us"],
  ["/products", "Our Products"],
  ["/processing-quality", "Processing & Quality"],
  ["/export-markets", "Export Markets"],
  ["/contact", "Contact Us"],
] as const;
export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="relative mx-auto min-h-screen max-w-[1440px] overflow-hidden bg-white shadow-xl shadow-blue-950/5">
      <header className="relative z-20 flex h-[64px] items-center justify-between gap-3 border-b border-blue-100 bg-white px-[6%] shadow-sm shadow-blue-950/5 lg:h-[76px]">
        <Link
          to="/"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-center gap-1.5 text-ocean-950"
        >
          <img src="/images/logo.png" alt="Ganagala Seafood Exporters" className="h-12 w-auto object-contain" />
        </Link>
        <button
          className="ml-auto rounded-lg p-2 text-ocean-950 min-[680px]:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav
          className={`${open ? "flex" : "hidden"} absolute left-3 right-3 top-[52px] flex-col gap-1 rounded-xl border border-blue-100 bg-white p-3 shadow-xl min-[680px]:static min-[680px]:flex min-[680px]:flex-row min-[680px]:items-center min-[680px]:justify-end min-[680px]:gap-[clamp(14px,2.2vw,32px)] min-[680px]:border-0 min-[680px]:bg-transparent min-[680px]:p-0 min-[680px]:shadow-none`}
        >
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-bold transition duration-300 hover:text-sky-600 min-[680px]:px-0 min-[680px]:py-3 min-[900px]:text-[14px] ${isActive ? "text-sky-600 min-[680px]:border-b-2 min-[680px]:border-sky-500" : "text-ocean-950"}`
              }
            >
              {label}
              {to === "/products" && <ChevronDown size={11} />}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/contact"
          className="hidden shrink-0 items-center gap-1.5 rounded-full bg-ocean-900 px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-sky-600 min-[680px]:inline-flex"
        >
          Get a Quote <ArrowRight size={12} />
        </Link>
      </header>
      <main key={location.pathname} className="page-enter"><Outlet /></main>
      <SiteFooter />
    </div>
  );
}
