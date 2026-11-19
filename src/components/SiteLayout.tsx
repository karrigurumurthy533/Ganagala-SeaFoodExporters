import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Anchor, ArrowRight, ChevronDown, Menu, X } from 'lucide-react';

const links = [
  ['/', 'Home'], ['/about', 'About Us'], ['/products', 'Our Products'],
  ['/processing-quality', 'Processing & Quality'], ['/export-markets', 'Export Markets'], ['/contact', 'Contact Us'],
] as const;
export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  return <div className="mx-auto min-h-screen max-w-[1440px] overflow-hidden bg-white shadow-xl shadow-blue-950/5">
    <header className="relative z-20 flex h-[56px] items-center justify-between gap-3 bg-white/95 px-[6%] lg:h-[68px]">
      <Link to="/" onClick={() => setOpen(false)} className="flex shrink-0 items-center gap-1.5 text-ocean-950">
        <span className="grid size-9 place-items-center rounded-full bg-sky-100 text-sky-500"><Anchor size={24} /></span>
        <span className="leading-none"><b className="block text-[18px] tracking-tight">Ganagala</b><small className="mt-1 block text-right text-[8px] font-bold">Seafood Exporters</small></span>
      </Link>
      <button className="ml-auto rounded-lg p-2 text-ocean-950 min-[680px]:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X size={21}/> : <Menu size={21}/>}</button>
      <nav className={`${open ? 'flex' : 'hidden'} absolute left-3 right-3 top-[52px] flex-col gap-1 rounded-xl border border-blue-100 bg-white p-3 shadow-xl min-[680px]:static min-[680px]:flex min-[680px]:flex-row min-[680px]:items-center min-[680px]:justify-end min-[680px]:gap-[clamp(10px,1.7vw,24px)] min-[680px]:border-0 min-[680px]:bg-transparent min-[680px]:p-0 min-[680px]:shadow-none`}>
        {links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({isActive}) => `flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-[10px] font-semibold transition hover:text-sky-600 min-[680px]:px-0 min-[680px]:py-3 min-[900px]:text-[11px] ${isActive ? 'text-sky-600 min-[680px]:border-b-2 min-[680px]:border-sky-500' : 'text-ocean-950'}`}>{label}{to==='/products'&&<ChevronDown size={11}/>}</NavLink>)}
      </nav>
      <Link to="/contact" className="hidden shrink-0 items-center gap-1.5 rounded-full bg-ocean-900 px-3.5 py-2 text-[10px] font-bold text-white transition hover:bg-sky-600 min-[680px]:inline-flex">Get a Quote <ArrowRight size={12} /></Link>
    </header>
    <Outlet />
    <footer className="flex flex-col items-center justify-between gap-2 border-t border-blue-100 bg-ice-50 px-6 py-5 text-[11px] text-blue-800/60 sm:flex-row sm:px-12"><span>© {new Date().getFullYear()} Ganagala Seafood Exporters</span><span>Premium Quality · Global Standards</span></footer>
  </div>;
}
