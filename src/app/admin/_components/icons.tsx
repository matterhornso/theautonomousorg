/**
 * Hand-crafted SVG icons for the admin portal. We avoid pulling in
 * @phosphor-icons or @radix-ui/react-icons because (a) the project hasn't
 * adopted either, (b) the editorial direction reads better with thin,
 * uniform 1.5-stroke geometric icons that match Instrument Serif's character.
 *
 * Convention: 24×24 viewBox, currentColor stroke, strokeWidth 1.5,
 * round caps + joins. Sized by parent via `w-* h-*` Tailwind classes.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function AgentsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 20c.7-3.3 3.7-5.5 7-5.5s6.3 2.2 7 5.5" />
      <path d="M9 5.5h.01M15 5.5h.01" />
    </svg>
  );
}

export function ApprovalsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 7h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z" />
      <path d="M9 4v3m6-3v3" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 1.5 6 1.5 6h-15S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function VaultIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="13" cy="12" r="3" />
      <path d="M13 9v.5M13 14.5v.5M16 12h.5M9.5 12h.5" />
      <path d="M6 5v14" />
    </svg>
  );
}

export function TallyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4h16M4 9h16M4 14h10M4 19h6" />
    </svg>
  );
}

export function ProvisionIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 4 7v6c0 4.5 3.5 7.5 8 8 4.5-.5 8-3.5 8-8V7l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ArrowUpRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path d="m6.5 6.5 2.5 2.5M15 15l2.5 2.5M6.5 17.5 9 15M15 9l2.5-2.5" />
    </svg>
  );
}

export function FlowIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h8M6 8v8M8 18h8M18 8v8" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17v.5" />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18" cy="12" r="1" />
    </svg>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h16l-6 8v6l-4-2v-4L4 6Z" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1.2 12a2 2 0 0 0 2 1.8h5.6a2 2 0 0 0 2-1.8L18 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" />
    </svg>
  );
}

export function ShopIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9h16l-1.5 11H5.5L4 9Z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function TimesheetIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M9 4v16" />
      <path d="M13 13l2 2 3-3" />
    </svg>
  );
}

export function BillingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.83V13a3 3 0 0 0 1.5 2.6V17a3 3 0 0 0 3 3 3 3 0 0 0 3-3V5a1 1 0 0 0-1-1H9Z" />
      <path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.83V13a3 3 0 0 1-1.5 2.6V17a3 3 0 0 1-3 3 3 3 0 0 1-3-3V5a1 1 0 0 1 1-1h1.5Z" />
      <path d="M12 9h0M9 12h0M15 12h0" />
    </svg>
  );
}
