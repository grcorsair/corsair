export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-corsair-deep">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-corsair-border border-t-corsair-cyan" />
          <div className="absolute inset-2 animate-spin rounded-full border-2 border-corsair-border border-b-corsair-gold" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
        </div>
        <span className="font-pixel text-[8px] tracking-wider text-corsair-text-dim">
          CHARTING COURSE
        </span>
      </div>
    </div>
  );
}
