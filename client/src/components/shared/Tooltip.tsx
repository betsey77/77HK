import { useState, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
          <div className="bg-gray-800 light:bg-gray-100 text-gray-200 light:text-gray-800 text-[11px] px-2 py-1 rounded shadow-lg border border-gray-700 light:border-gray-300 whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
