import { Award, Globe2, Handshake, ShieldCheck } from "lucide-react";
const items = [
  {
    Icon: Award,
    title: (
      <>
        Superior
        <br />
        Quality
      </>
    ),
  },
  {
    Icon: ShieldCheck,
    title: (
      <>
        Hygienic
        <br />
        Processing
      </>
    ),
  },
  {
    Icon: Globe2,
    title: (
      <>
        Global Export
        <br />
        Network
      </>
    ),
  },
  {
    Icon: Handshake,
    title: (
      <>
        Trusted
        <br />
        Partner
      </>
    ),
  },
];
export default function TrustStrip() {
  return (
    <div className="flex w-full max-w-[470px] items-center rounded-2xl border border-blue-100 bg-white px-1.5 py-2 shadow-lg shadow-blue-950/10 transition duration-300 hover:bg-blue-50 lg:max-w-[620px] lg:py-3">
      {items.map(({ Icon, title }, i) => (
        <div
          key={i}
          className={`flex flex-1 items-center justify-center gap-1.5 px-1.5 text-ocean-900 transition-transform duration-300 hover:-translate-y-0.5 ${i < items.length - 1 ? "border-r border-blue-200" : ""}`}
        >
          <Icon size={20} className="shrink-0 text-sky-600 lg:size-6" />
          <b className="text-[8px] leading-[1.2] lg:text-[10px]">{title}</b>
        </div>
      ))}
    </div>
  );
}
