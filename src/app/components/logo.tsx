export function Logo({ className = "", size = "default" }: { className?: string; size?: "small" | "default" | "large" }) {
  const heights = { small: "h-5", default: "h-7", large: "h-10" };

  return (
    <span className={`${heights[size]} inline-flex items-center ${className}`}>
      <span
        className="font-[family-name:var(--font-serif)] italic font-normal tracking-tight"
        style={{
          color: '#D4A853',
          fontSize: size === 'small' ? '16px' : size === 'large' ? '28px' : '20px',
          lineHeight: 1,
        }}
      >
        TheAutonomous
      </span>
    </span>
  );
}
