interface BrandLogoProps {
  compact?: boolean;
  larger?: boolean;
  className?: string;
}

export default function BrandLogo({ compact = false, larger = false, className = "" }: BrandLogoProps) {
  // If custom sizing is provided via className (e.g. w-8 h-8 in client portal modal)
  const isCustomSized = Boolean(className && (className.includes("w-") || className.includes("h-")));

  // Constrain logo dimensions so it fits strictly inside 64px–72px navbar without determining or expanding navbar height:
  // Desktop navbar: ~150px–175px wide, max-h-[58px]
  // Compact / Mobile: ~130px–145px wide, max-h-[46px]
  const sizeClass = isCustomSized
    ? "max-w-full max-h-full"
    : compact
    ? "w-[125px] max-w-[130px] max-h-[44px]"
    : larger
    ? "w-[145px] sm:w-[170px] max-w-[175px] max-h-[58px]"
    : "w-[135px] sm:w-[155px] max-w-[160px] max-h-[50px]";

  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src="/Thinkatic%20Full%20Logo.png"
        alt="Thinkatic"
        className={`${sizeClass} h-auto object-contain block select-none`}
        width={170}
        height={68}
      />
    </span>
  );
}