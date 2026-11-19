import { Globe2 } from "lucide-react";
const regions = [
  ["ðŸ‡ºðŸ‡¸", "USA"],
  ["ðŸ‡ªðŸ‡º", "EUROPE"],
  ["ðŸŒ", "ASIA"],
  ["ðŸŒ", "MIDDLE EAST"],
  ["ðŸ‡¦ðŸ‡º", "AUSTRALIA"],
];
export default function MarketStrip() {
  return (
    <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl">
      {regions.map(([flag, name]) => (
        <div
          key={name}
          className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl border border-blue-100 bg-white px-3 py-2 text-ocean-950 shadow-md shadow-blue-950/5 transition duration-300 hover:-translate-y-1 hover:bg-blue-50 lg:min-w-[82px] lg:px-4 lg:py-3"
        >
          <span className="text-base leading-none">{flag}</span>
          <b className="text-[7px] leading-tight lg:text-[9px]">{name}</b>
        </div>
      ))}
    </div>
  );
}
