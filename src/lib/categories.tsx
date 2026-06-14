import { ReactNode } from "react";

export type CategoryKey =
  | "refresco"
  | "alcohol"
  | "agua"
  | "cigarros"
  | "lacteos"
  | "alimento"
  | "dulces"
  | "otros";

type CategoryDef = {
  key: CategoryKey;
  label: string;
  /** Tailwind text color class for chips & icons */
  text: string;
  /** Tailwind background tint */
  bg: string;
  /** Tailwind ring/border */
  ring: string;
  icon: (cls?: string) => ReactNode;
};

const IconBase = ({
  className = "size-5",
  children,
}: { className?: string; children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
);

const SodaIcon = (cls?: string) => (
  <IconBase className={cls}>
    <path d="M7 8h10l-1 12a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2L7 8Z" />
    <path d="M8.5 8 9 3h6l.5 5" />
    <path d="M7.5 13h9" />
  </IconBase>
);

const BeerIcon = (cls?: string) => (
  <IconBase className={cls}>
    <path d="M6 7h10v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Z" />
    <path d="M16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    <path d="M9 11v7M12 11v7" />
  </IconBase>
);

const WaterIcon = (cls?: string) => (
  <IconBase className={cls}>
    <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />
  </IconBase>
);

const CigaretteIcon = (cls?: string) => (
  <IconBase className={cls}>
    <rect x="2" y="13" width="16" height="4" rx="1" />
    <path d="M14 13v4" />
    <path d="M19 7v2M22 6v3M19 11h3" />
  </IconBase>
);

const MilkIcon = (cls?: string) => (
  <IconBase className={cls}>
    <path d="M9 2h6v4l2 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10l2-4V2Z" />
    <path d="M7 12h10" />
  </IconBase>
);

const BreadIcon = (cls?: string) => (
  <IconBase className={cls}>
    <path d="M5 11a4 4 0 0 1 8-1.5A4 4 0 0 1 21 13c0 2-1.5 3-3 3H7c-1.5 0-3-1-3-3 0-1 .5-1.7 1-2Z" />
    <path d="M8 16v3M12 16v3M16 16v3" />
  </IconBase>
);

const CandyIcon = (cls?: string) => (
  <IconBase className={cls}>
    <circle cx="12" cy="12" r="4" />
    <path d="M8 12 4 8v8l4-4ZM16 12l4-4v8l-4-4Z" />
  </IconBase>
);

const BoxIcon = (cls?: string) => (
  <IconBase className={cls}>
    <path d="M3 7l9-4 9 4-9 4-9-4Z" />
    <path d="M3 7v10l9 4 9-4V7" />
    <path d="M12 11v10" />
  </IconBase>
);

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  refresco: {
    key: "refresco",
    label: "Refresco",
    text: "text-rose-600",
    bg: "bg-rose-50",
    ring: "ring-rose-100",
    icon: SodaIcon,
  },
  alcohol: {
    key: "alcohol",
    label: "Alcohol",
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-100",
    icon: BeerIcon,
  },
  agua: {
    key: "agua",
    label: "Agua",
    text: "text-sky-600",
    bg: "bg-sky-50",
    ring: "ring-sky-100",
    icon: WaterIcon,
  },
  cigarros: {
    key: "cigarros",
    label: "Cigarros",
    text: "text-neutral-700",
    bg: "bg-neutral-100",
    ring: "ring-neutral-200",
    icon: CigaretteIcon,
  },
  lacteos: {
    key: "lacteos",
    label: "Lácteos",
    text: "text-violet-600",
    bg: "bg-violet-50",
    ring: "ring-violet-100",
    icon: MilkIcon,
  },
  alimento: {
    key: "alimento",
    label: "Alimentos",
    text: "text-orange-600",
    bg: "bg-orange-50",
    ring: "ring-orange-100",
    icon: BreadIcon,
  },
  dulces: {
    key: "dulces",
    label: "Dulces",
    text: "text-pink-600",
    bg: "bg-pink-50",
    ring: "ring-pink-100",
    icon: CandyIcon,
  },
  otros: {
    key: "otros",
    label: "Otros",
    text: "text-slate-600",
    bg: "bg-slate-50",
    ring: "ring-slate-100",
    icon: BoxIcon,
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export function CategoryChip({
  category,
  size = "sm",
}: {
  category: CategoryKey;
  size?: "sm" | "md";
}) {
  const c = CATEGORIES[category] ?? CATEGORIES.otros;
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ${c.bg} ${c.text} ${c.ring} ${padding}`}
    >
      {c.icon(size === "sm" ? "size-3" : "size-3.5")}
      {c.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: CategoryKey }) {
  const c = CATEGORIES[category] ?? CATEGORIES.otros;
  return (
    <div
      className={`inline-grid place-items-center size-9 rounded-full ring-1 ${c.bg} ${c.text} ${c.ring}`}
    >
      {c.icon("size-5")}
    </div>
  );
}
