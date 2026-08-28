export interface FontOption {
  id: string
  label: string
  /** CSS font-family value (uses the variables loaded in layout.tsx) */
  family: string
  /** short descriptor shown under the name */
  vibe: string
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "geist", label: "Geist", family: "var(--font-geist-sans)", vibe: "Neutra · padrão" },
  { id: "poppins", label: "Poppins", family: "var(--font-poppins)", vibe: "Geométrica · amigável" },
  { id: "bebas", label: "Bebas Neue", family: "var(--font-bebas)", vibe: "Condensada · impacto" },
  { id: "archivo", label: "Archivo Black", family: "var(--font-archivo)", vibe: "Pesada · chamativa" },
  { id: "playfair", label: "Playfair Display", family: "var(--font-playfair)", vibe: "Serifada · elegante" },
  { id: "space", label: "Space Grotesk", family: "var(--font-space)", vibe: "Técnica · moderna" },
  { id: "oswald", label: "Oswald", family: "var(--font-oswald)", vibe: "Condensada · anúncio" },
  { id: "montserrat", label: "Montserrat", family: "var(--font-montserrat)", vibe: "Geométrica · hook" },
  { id: "anton", label: "Anton", family: "var(--font-anton)", vibe: "Display · impacto" },
  { id: "inter", label: "Inter", family: "var(--font-inter)", vibe: "Neutra · UI" },
  { id: "alfa", label: "Alfa Slab One", family: "var(--font-alfa)", vibe: "Slab · gancho" },
  { id: "nunito", label: "Nunito", family: "var(--font-nunito)", vibe: "Redonda · amigável" },
  { id: "lilita", label: "Lilita One", family: "var(--font-lilita)", vibe: "Display · brincalhona" },
  { id: "luckiest", label: "Luckiest Guy", family: "var(--font-luckiest)", vibe: "HQ · cartoon" },
  { id: "baloo", label: "Baloo 2", family: "var(--font-baloo)", vibe: "Redonda · infantil" },
  { id: "titan", label: "Titan One", family: "var(--font-titan)", vibe: "Pesada · grito" },
  { id: "caveat", label: "Caveat", family: '"Caveat", cursive', vibe: "Manuscrita · OFL" },
  { id: "courier", label: "Courier Prime", family: '"Courier Prime", monospace', vibe: "Máquina · OFL" },
]

export const FONT_MAP: Record<string, FontOption> = Object.fromEntries(
  FONT_OPTIONS.map((font) => [font.id, font]),
) as Record<string, FontOption>

export const FONT_PREVIEW_SAMPLE = "Oferta relâmpago"

export function withProjectFont(fonts: string[], fontId: string): string[] {
  if (fonts.includes(fontId)) return fonts
  return [fontId, ...fonts]
}
