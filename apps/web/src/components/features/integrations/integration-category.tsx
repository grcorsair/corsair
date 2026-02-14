import { FadeIn } from "@/components/motion/fade-in";
import { IntegrationCard } from "./integration-card";
import type {
  Integration,
  IntegrationCategoryMeta,
} from "@/data/integrations-data";

export function IntegrationCategory({
  category,
  integrations,
}: {
  category: IntegrationCategoryMeta;
  integrations: Integration[];
}) {
  const availableCount = integrations.filter(
    (i) => i.status === "available",
  ).length;
  const totalCount = integrations.length;

  return (
    <section id={category.id} className="scroll-mt-24">
      <FadeIn>
        {/* Category header */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3">
            <p className="font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              {category.pirateName}
            </p>
            <span className="font-mono text-[10px] text-corsair-text-dim/40">
              {availableCount}/{totalCount} available
            </span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold text-corsair-text">
            {category.name}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-corsair-text-dim">
            {category.description}
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {integrations
            .sort((a, b) => {
              const order = { available: 0, beta: 1, coming: 2 };
              return order[a.status] - order[b.status];
            })
            .map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
              />
            ))}
        </div>
      </FadeIn>
    </section>
  );
}
