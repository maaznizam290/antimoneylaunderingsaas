/// Original Verifin mark: a shield (trust/security/compliance) with a
/// checkmark built from the negative space of a "V" (verification,
/// identity) — deliberately geometric/enterprise rather than decorative.
export function VerifinLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M20 2 L36 8 V19 C36 28.5 29.5 35.5 20 38 C10.5 35.5 4 28.5 4 19 V8 L20 2 Z"
        fill="url(#verifin-shield)"
      />
      <path
        d="M12 19.5 L18 26 L29 12.5"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="verifin-shield" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
    </svg>
  );
}
