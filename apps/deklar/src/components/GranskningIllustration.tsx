// Hand-built SVG illustration (no external image assets / no image-generation
// tool available in this environment) — a declaration document being
// reviewed, with a found deduction highlighted and a magnifying glass
// picking it out. Colors reference the CSS custom properties directly so it
// adapts to light/dark mode automatically.
export function GranskningIllustration() {
  return (
    <svg
      viewBox="0 0 420 320"
      role="img"
      aria-label="Illustration av en deklaration som granskas, med ett hittat avdrag markerat"
      className="granskning-illustration"
    >
      {/* Soft backdrop */}
      <ellipse cx="210" cy="270" rx="150" ry="18" fill="var(--color-muted)" />

      {/* Document */}
      <rect
        x="90"
        y="30"
        width="200"
        height="250"
        rx="12"
        fill="var(--color-surface)"
        stroke="var(--color-border)"
        strokeWidth="2"
      />
      {/* Folded corner */}
      <path
        d="M 250 30 L 290 30 L 290 70 Z"
        fill="var(--color-muted)"
        stroke="var(--color-border)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Header lines */}
      <rect x="112" y="56" width="90" height="10" rx="5" fill="var(--color-foreground)" opacity="0.85" />
      <rect x="112" y="74" width="60" height="7" rx="3.5" fill="var(--color-muted-fg)" opacity="0.6" />

      {/* Body rows */}
      <rect x="112" y="104" width="176" height="7" rx="3.5" fill="var(--color-border)" />
      <rect x="112" y="122" width="150" height="7" rx="3.5" fill="var(--color-border)" />

      {/* Highlighted "found deduction" row */}
      <rect x="106" y="140" width="188" height="24" rx="6" fill="var(--color-accent-soft)" />
      <rect x="118" y="148" width="90" height="8" rx="4" fill="var(--color-accent-dark)" />
      <rect x="216" y="148" width="60" height="8" rx="4" fill="var(--color-accent-dark)" />

      <rect x="112" y="178" width="164" height="7" rx="3.5" fill="var(--color-border)" />
      <rect x="112" y="196" width="120" height="7" rx="3.5" fill="var(--color-border)" />
      <rect x="112" y="214" width="176" height="7" rx="3.5" fill="var(--color-border)" />
      <rect x="112" y="232" width="90" height="7" rx="3.5" fill="var(--color-border)" />

      {/* Coin badge emerging from the highlighted row */}
      <circle
        cx="238"
        cy="152"
        r="26"
        fill="var(--color-success)"
        stroke="var(--color-surface)"
        strokeWidth="4"
      />
      <text
        x="238"
        y="159"
        textAnchor="middle"
        fontSize="18"
        fontWeight="800"
        fill="var(--color-on-primary)"
        fontFamily="var(--font-sans)"
      >
        kr
      </text>

      {/* Magnifying glass */}
      <circle
        cx="238"
        cy="152"
        r="58"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="6"
        opacity="0.9"
      />
      <line
        x1="279"
        y1="193"
        x2="330"
        y2="244"
        stroke="var(--color-primary)"
        strokeWidth="10"
        strokeLinecap="round"
      />
    </svg>
  );
}
