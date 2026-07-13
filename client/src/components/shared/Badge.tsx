type BadgeVariant = 'red' | 'amber' | 'green' | 'blue' | 'gray';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  red: 'bg-red-500/15 text-red-300 border-red-500/20',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  green: 'bg-emerald-500/15 light:bg-orange-500/15 text-emerald-300 light:text-orange-700 border-emerald-500/20 light:border-orange-500/20',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  gray: 'bg-gray-500/15 text-gray-300 light:text-gray-800 border-gray-500/20',
};

const dotColors: Record<BadgeVariant, string> = {
  red: 'bg-red-400',
  amber: 'bg-amber-400',
  green: 'bg-emerald-400 light:bg-orange-500',
  blue: 'bg-blue-400',
  gray: 'bg-gray-400',
};

export default function Badge({ label, variant = 'gray', dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${variantStyles[variant]}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {label}
    </span>
  );
}
