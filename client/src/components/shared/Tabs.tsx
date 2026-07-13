interface TabsProps {
  tabs: Array<{ key: string; label: string }>;
  activeTab: string;
  onTabChange: (key: string) => void;
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex border-b border-gray-700/50 light:border-gray-300 gap-0">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-3 py-2 text-xs font-medium transition-all duration-150 border-b-2 -mb-[1px] whitespace-nowrap ${
            activeTab === tab.key
              ? 'text-emerald-300 light:text-orange-700 border-emerald-400 light:border-orange-400'
              : 'text-gray-500 light:text-gray-500 border-transparent hover:text-gray-300 light:hover:text-gray-700 hover:border-gray-600 light:hover:border-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
