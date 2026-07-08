/**
 * Cat-themed loading state shared by learner-facing loading screens.
 * Centered in the content area. Motion is gentle (slow bob/sway, no flashing)
 * and fully disabled by the global prefers-reduced-motion rule in globals.css.
 */

type CatLoadingProps = {
  label?: string;
  className?: string;
};

function PawPrint({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="12" cy="15.5" rx="5" ry="4.5" fill="currentColor" />
      <circle cx="5.5" cy="10.5" r="2.4" fill="currentColor" />
      <circle cx="10" cy="6.8" r="2.4" fill="currentColor" />
      <circle cx="14" cy="6.8" r="2.4" fill="currentColor" />
      <circle cx="18.5" cy="10.5" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function CatLoading({ label = "Chờ mèo con chút nhé...", className = "" }: CatLoadingProps) {
  return (
    <div
      role="status"
      className={`flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 text-center ${className}`}
    >
      {/* Kitten */}
      <svg viewBox="0 0 140 120" className="cat-bob h-24 w-auto" aria-hidden="true">
        {/* Tail (swaying gently behind the body) */}
        <g className="cat-tail-sway">
          <path
            d="M100 96 C 122 96 130 82 124 66"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </g>

        {/* Body */}
        <ellipse cx="70" cy="88" rx="30" ry="24" fill="var(--accent)" />

        {/* Ears */}
        <path d="M50 30 L46 10 L64 20 Z" fill="var(--accent)" strokeLinejoin="round" />
        <path d="M90 30 L94 10 L76 20 Z" fill="var(--accent)" strokeLinejoin="round" />
        <path d="M52 26 L50 15 L60.5 21 Z" fill="var(--accent-soft)" opacity="0.9" />
        <path d="M88 26 L90 15 L79.5 21 Z" fill="var(--accent-soft)" opacity="0.9" />

        {/* Head */}
        <circle cx="70" cy="42" r="26" fill="var(--accent)" />

        {/* Closed, happy eyes */}
        <path d="M56 42 Q60 47 64 42" fill="none" stroke="var(--on-accent)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M76 42 Q80 47 84 42" fill="none" stroke="var(--on-accent)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Nose + smile */}
        <path d="M67.5 50 L72.5 50 L70 53.2 Z" fill="var(--on-accent)" />
        <path d="M65.5 57.5 Q70 60.8 74.5 57.5" fill="none" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" />

        {/* Whiskers */}
        <g stroke="var(--on-accent)" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
          <path d="M32 44 L48 46" />
          <path d="M33 52 L48 50" />
          <path d="M92 46 L108 44" />
          <path d="M92 50 L107 52" />
        </g>

        {/* Front feet */}
        <ellipse cx="57" cy="108" rx="8.5" ry="5.5" fill="var(--accent-strong)" />
        <ellipse cx="83" cy="108" rx="8.5" ry="5.5" fill="var(--accent-strong)" />
      </svg>

      {/* Walking paw prints */}
      <div className="flex items-center gap-2.5 text-leaf" aria-hidden="true">
        <PawPrint className="paw-step size-4" />
        <PawPrint className="paw-step size-4" />
        <PawPrint className="paw-step size-4" />
      </div>

      <p className="text-sm font-semibold text-ink-soft">{label}</p>
    </div>
  );
}
