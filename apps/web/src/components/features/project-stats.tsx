import { FadeIn } from "@/components/motion/fade-in";

const stats = [
  { value: "2,050+", label: "Tests Passing", color: "text-corsair-green" },
  { value: "79", label: "Test Files", color: "text-corsair-turquoise" },
  { value: "5,349", label: "Assertions", color: "text-corsair-cyan" },
  { value: "8", label: "Tool Formats", color: "text-corsair-gold" },
  { value: "1", label: "Runtime Dep", color: "text-corsair-text" },
];

export function ProjectStats() {
  return (
    <section className="border-y border-corsair-border bg-corsair-deep/50 px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className={`font-mono text-xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-[10px] tracking-wider text-corsair-text-dim/60">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
