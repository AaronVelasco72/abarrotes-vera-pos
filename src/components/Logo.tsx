"use client";

import { useState } from "react";

type Props = {
  size?: number;
  className?: string;
  /** Show the wordmark next to the logo */
  withText?: boolean;
  textClassName?: string;
};

/**
 * Renders /logo.png if present; falls back to a navy "AV" badge if not.
 * Drop the brand logo file at `public/logo.png` (transparent PNG works best).
 */
export function Logo({ size = 36, className = "", withText = false, textClassName = "" }: Props) {
  const [errored, setErrored] = useState(false);

  const img = errored ? (
    <div
      className={`rounded-full bg-brand-700 text-white grid place-items-center font-bold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      aria-label="Abarrotes Vera"
    >
      AV
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Abarrotes Vera"
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );

  if (!withText) return img;

  return (
    <div className="flex items-center gap-2.5">
      {img}
      <div className={textClassName}>
        <div className="text-sm font-bold text-brand-900 leading-none tracking-tight">Abarrotes Vera</div>
        <div className="text-[10px] text-brand-400 leading-none mt-1">CDMX · Nezahualcóyotl</div>
      </div>
    </div>
  );
}
