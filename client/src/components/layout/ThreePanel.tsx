import { useState, type ReactNode } from 'react';
import { PenLine, FileText, ShieldCheck, type LucideIcon } from 'lucide-react';

interface ThreePanelProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

type PanelKey = 'input' | 'results' | 'audit';

const MOBILE_TABS: Array<{
  key: PanelKey;
  label: string;
  Icon: LucideIcon;
  tabId: string;
  panelId: string;
  testId: string;
}> = [
  {
    key: 'input',
    label: '输入',
    Icon: PenLine,
    tabId: 'workbench-tab-input',
    panelId: 'workbench-panel-input',
    testId: 'workbench-tab-input',
  },
  {
    key: 'results',
    label: '文案',
    Icon: FileText,
    tabId: 'workbench-tab-results',
    panelId: 'workbench-panel-results',
    testId: 'workbench-tab-results',
  },
  {
    key: 'audit',
    label: '审核',
    Icon: ShieldCheck,
    tabId: 'workbench-tab-audit',
    panelId: 'workbench-panel-audit',
    testId: 'workbench-tab-audit',
  },
];

export default function ThreePanel({ left, center, right }: ThreePanelProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>('input');

  const panelClass = (key: PanelKey, bg: string) =>
    [
      // Mobile: only the active panel fills the work area
      activePanel === key ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden',
      // Desktop (lg+): always show all three columns
      'lg:flex lg:min-h-0 lg:flex-none lg:flex-col lg:overflow-hidden',
      bg,
    ].join(' ');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Mobile-only segment tabs — hidden at lg+ */}
      <div
        role="tablist"
        aria-label="工作台面板"
        data-testid="workbench-mobile-tablist"
        className="flex shrink-0 border-b border-gray-800 bg-gray-950 light:border-gray-200 light:bg-white lg:hidden"
      >
        {MOBILE_TABS.map(({ key, label, Icon, tabId, panelId, testId }) => {
          const selected = activePanel === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={tabId}
              data-testid={testId}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActivePanel(key)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 light:focus-visible:ring-orange-500 ${
                selected
                  ? 'border-emerald-400 text-emerald-300 light:border-orange-400 light:text-orange-700'
                  : 'border-transparent text-gray-500 hover:text-gray-300 light:text-gray-500 light:hover:text-gray-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel stage: single column on mobile; three columns at lg+ */}
      <div
        data-testid="workbench-panel-stage"
        className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(260px,30%)_1fr_minmax(260px,30%)] lg:divide-x lg:divide-gray-800 light:lg:divide-gray-200"
      >
        <div
          id="workbench-panel-input"
          role="tabpanel"
          aria-labelledby="workbench-tab-input"
          data-testid="workbench-panel-input"
          className={panelClass('input', 'bg-gray-950/50 light:bg-gray-100/50')}
        >
          {left}
        </div>

        <div
          id="workbench-panel-results"
          role="tabpanel"
          aria-labelledby="workbench-tab-results"
          data-testid="workbench-panel-results"
          className={panelClass('results', 'bg-gray-950/30 p-4 light:bg-gray-50')}
        >
          {center}
        </div>

        <div
          id="workbench-panel-audit"
          role="tabpanel"
          aria-labelledby="workbench-tab-audit"
          data-testid="workbench-panel-audit"
          className={panelClass('audit', 'bg-gray-950/50 light:bg-gray-100/50')}
        >
          {right}
        </div>
      </div>
    </div>
  );
}
