/**
 * ApkForge brand mark — minimal "A" letterform with a forge spark.
 * Uses currentColor so it works on gradient tiles (text-white) and on
 * white cards (text-blue-600) alike.
 */
export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 192" className={className} aria-hidden="true">
      <path d="M56 132 L96 52 L136 132" stroke="currentColor" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 104 H120" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
      <path d="M138 40 l4.5 10.5 L153 55 l-10.5 4.5 L138 70 l-4.5 -10.5 L123 55 l10.5 -4.5 Z" fill="currentColor" opacity="0.95" />
    </svg>
  )
}
