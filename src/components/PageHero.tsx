import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

type HeroProps = { image: string; eyebrow: string; title: ReactNode; description: string; action?: string; to?: string; children?: ReactNode; bottomContent?: ReactNode; imagePosition?: string };
export default function PageHero({image, eyebrow, title, description, action, to='/contact', children, bottomContent, imagePosition='object-center'}: HeroProps) {
  return <section className="relative isolate min-h-[268px] overflow-hidden bg-gradient-to-r from-white via-ice-50 to-sky-100 min-[900px]:min-h-[420px] lg:min-h-[520px]">
    <div className="absolute inset-y-0 right-0 -z-10 w-[62%] max-[679px]:w-full max-[679px]:opacity-70">
      <img src={image} alt="" className={`h-full w-full object-cover ${imagePosition}`} />
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/55 to-transparent" />
    </div>
    <div className="relative mx-auto grid min-h-[268px] max-w-[1440px] grid-cols-[43%_57%] items-center px-[6.5%] pb-4 pt-5 min-[900px]:min-h-[420px] lg:min-h-[520px] max-[679px]:min-h-[500px] max-[679px]:grid-cols-1 max-[679px]:items-start max-[679px]:pt-8">
      <div className="relative z-10 max-w-[320px] max-[679px]:max-w-[360px]">
        <p className="mb-2 text-[9px] font-extrabold tracking-[.18em] text-ocean-900 sm:text-[10px] lg:text-xs">{eyebrow}</p>
        <h1 className="max-w-[340px] text-[30px] font-extrabold leading-[1.04] tracking-tight text-ocean-950 min-[900px]:text-5xl lg:text-[56px] max-[679px]:text-[35px]">{title}</h1>
        <p className="mt-2 max-w-[290px] text-[11px] leading-[1.45] text-blue-950/90 sm:text-xs lg:mt-4 lg:max-w-[390px] lg:text-[15px] lg:leading-6">{description}</p>
        {children}
        {action && <Link to={to} className="mt-3 inline-flex items-center gap-2 rounded-full bg-ocean-900 px-4 py-2 text-[10px] font-bold text-white shadow-md shadow-ocean-900/15 transition hover:bg-sky-600 lg:mt-5 lg:px-5 lg:py-2.5 lg:text-xs">{action}<ArrowRight size={13}/></Link>}
      </div>
    </div>
    {bottomContent && <div className="absolute bottom-5 left-[6.5%] right-[6.5%] z-10 max-[679px]:bottom-4">{bottomContent}</div>}
  </section>;
}
