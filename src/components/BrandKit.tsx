import { BRAND_COLORS, LOGO_RULES } from "@/lib/brand";

export function BrandKit() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-base font-semibold tracking-normal">McCoy's brand kit</h3>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-secondary-foreground">
          LOCKED BY MARKETING
        </span>
      </div>
      <div className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground">COLORS</div>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {BRAND_COLORS.slice(0, 6).map((c) => (
          <div key={c.hex} className="text-center">
            {/* Swatch shows the literal brand color from the guide */}
            <div className="h-10 rounded-md border" style={{ backgroundColor: c.hex }} title={c.name} />
            <div className="mt-1 text-[10px] text-muted-foreground">{c.hex}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground">FONTS</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-4 text-lg">
        <span className="font-display text-2xl">Bebas Neue</span>
        <span>Helvetica Neue</span>
        <span className="font-serif font-bold">Serifa Bold</span>
      </div>
      <div className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground">LOGO RULES</div>
      <ul className="mt-2 space-y-1 text-sm">
        {LOGO_RULES.map((r) => (
          <li key={r} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
