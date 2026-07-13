import { AlertTriangle, XCircle } from 'lucide-react';
import type { RiskNote } from '../../types';

interface RiskNotesProps {
  risks: RiskNote[];
}

export default function RiskNotes({ risks }: RiskNotesProps) {
  if (risks.length === 0) {
    return <p className="text-xs text-gray-600 light:text-gray-500">没有风险提示</p>;
  }

  return (
    <ul className="space-y-1.5">
      {risks.map((risk, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[11px]">
          {risk.level === 'red' ? (
            <XCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          )}
          <span className={risk.level === 'red' ? 'text-red-300' : 'text-amber-300'}>
            {risk.description}
          </span>
        </li>
      ))}
    </ul>
  );
}
