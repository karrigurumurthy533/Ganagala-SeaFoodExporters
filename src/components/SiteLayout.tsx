import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import SiteFooter from "./SiteFooter";

const links = [
  ["/", "Home"],
  ["/about", "About Us"],
  ["/products", "Our Products"],
  ["/processing-quality", "Processing & Quality"],
  ["/infrastructure", "Infrastructure"],
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
          className="ml-auto rounded-lg p-2 text-ocean-950 min-[1100px]:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav
          className={`${open ? "flex" : "hidden"} absolute left-3 right-3 top-[52px] flex-col gap-1 rounded-xl border border-blue-100 bg-white p-3 shadow-xl min-[1100px]:static min-[1100px]:flex min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-end min-[1100px]:gap-[clamp(8px,1.1vw,16px)] min-[1100px]:border-0 min-[1100px]:bg-transparent min-[1100px]:p-0 min-[1100px]:shadow-none`}
        >
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-[12px] font-bold transition duration-300 hover:text-sky-600 min-[1100px]:px-0 min-[1100px]:py-3 min-[1100px]:text-[12px] ${isActive ? "text-sky-600 min-[1100px]:border-b-2 min-[1100px]:border-sky-500" : "text-ocean-950"}`
              }
            >
              {label}
              {to === "/products" && <ChevronDown size={11} />}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/checkout"
          className="hidden shrink-0 items-center gap-1.5 rounded-full bg-ocean-900 px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-sky-600 min-[1100px]:inline-flex"
        >
          Checkout <ArrowRight size={12} />
        </Link>
      </header>
      <main key={location.pathname} className="page-enter"><Outlet /></main>
      <SiteFooter />
    </div>
  );
}
