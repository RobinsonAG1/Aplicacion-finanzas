type BrandMarkProps = {
  size?: number
}

export function BrandMark({ size = 30 }: BrandMarkProps) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="brand-mark-bg" width="32" height="32" rx="9" />
      <path className="brand-mark-fg" d="M10 9h10v3.3h-6.6v3h5.4v3.3h-5.4V24H10z" />
      <circle className="brand-mark-dot" cx="23.2" cy="23.2" r="2.3" />
    </svg>
  )
}
