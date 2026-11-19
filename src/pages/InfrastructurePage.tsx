import { Boxes, Snowflake, Truck, Factory } from "lucide-react";
import PageHero from "../components/PageHero";
import { SectionHeading } from "../components/Content";
const units = [
  { Icon: Factory, title: "Processing plants" },
  { Icon: Snowflake, title: "Cold storage" },
  { Icon: Boxes, title: "Modern packaging" },
  { Icon: Truck, title: "Logistics support" },
];
export default function InfrastructurePage() {
  return (
    <>
      <PageHero
        image="/references/infrastructure.png"
        eyebrow="OUR INFRASTRUCTURE"
        title={
          <>
            State-of-the-art
            <br />
            infrastructure
          </>
        }
        description="Our modern infrastructure enables us to maintain consistent quality and meet global demand."
        action="Enquire About Our Facilities"
      />
      <section className="px-6 py-16">
        <SectionHeading
          eyebrow="BUILT FOR QUALITY"
          title="Facilities that support every step"
        />{" "}
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-4">
          {units.map(({ Icon, title }) => (
            <div
              key={title}
              className="rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-sm"
            >
              <Icon className="mx-auto text-sky-600" size={27} />
              <h3 className="mt-4 text-sm font-bold">{title}</h3>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
