import { type ReactNode } from 'react';

interface ThreePanelProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export default function ThreePanel({ left, center, right }: ThreePanelProps) {
  return (
    <div className="flex-1 grid grid-cols-[minmax(260px,30%)_1fr_minmax(260px,30%)] divide-x divide-gray-800 light:divide-gray-200 overflow-hidden">
      {/* Left panel */}
      <div className="overflow-hidden bg-gray-950/50 light:bg-gray-100/50">
        {left}
      </div>

      {/* Center panel */}
      <div className="overflow-hidden bg-gray-950/30 light:bg-gray-50 p-4">
        {center}
      </div>

      {/* Right panel */}
      <div className="overflow-hidden bg-gray-950/50 light:bg-gray-100/50">
        {right}
      </div>
    </div>
  );
}
