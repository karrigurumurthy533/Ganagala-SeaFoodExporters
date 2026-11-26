import { Fish, Shell, Waves } from "lucide-react";
import { SectionHeading } from "./Content";
const products = [
  { icon: "🦐", name: "Shrimp (Prawns)" },
  { Icon: Fish, name: "Fish" },
  { icon: "🦑", name: "Squid" },
  { Icon: Waves, name: "Cuttlefish" },
  { Icon: Shell, name: "Other Seafood" },
];
export function ProductCategoryStrip() {
  return (
    <div className="grid max-w-[700px] grid-cols-5 gap-2">
      {products.map(({ Icon, icon, name }) => (
        <div
          key={name}
          className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl border border-blue-100 bg-white px-1 py-1.5 text-center text-ocean-950 shadow-md shadow-blue-950/5 transition duration-300 hover:-translate-y-1 hover:bg-blue-50"
        >
          <span className="text-base leading-none">
            {icon ?? (Icon && <Icon size={17} className="text-sky-600" />)}
          </span>
          <b className="text-[8px] leading-tight lg:text-[10px]">{name}</b>
        </div>
      ))}
    </div>
  );
}
export default function ProductGrid() {
  return (
    <section className="px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
      <SectionHeading eyebrow="OUR RANGE" title="Seafood for every market">
        A carefully selected range prepared to meet your market’s needs.
      </SectionHeading>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {products.map(({ Icon, icon, name }) => (
          <article
            key={name}
            className="group rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-blue-50 hover:shadow-xl"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-ice-100 text-sky-600">
              {icon ?? (Icon && <Icon size={24} />)}
            </span>
            <h3 className="mt-4 text-sm font-bold text-ocean-950">{name}</h3>
            <p className="mt-1 text-xs text-blue-950/60">
              Premium export selection
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
