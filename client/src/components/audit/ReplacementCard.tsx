import type { Replacement } from '../../types';

interface ReplacementCardProps {
  replacement: Replacement;
}

export default function ReplacementCard({ replacement }: ReplacementCardProps) {
  return (
    <div className="bg-gray-800/30 light:bg-gray-200/50 border border-gray-700/30 light:border-gray-300/50 rounded-lg px-2.5 py-2 space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-red-300/70 line-through">{replacement.original}</span>
        <span className="text-gray-600 light:text-gray-500">→</span>
        <span className="text-emerald-300 light:text-emerald-700 font-medium">{replacement.suggested}</span>
      </div>
      <p className="text-[10px] text-gray-500 light:text-gray-500">{replacement.reason}</p>
    </div>
  );
}
