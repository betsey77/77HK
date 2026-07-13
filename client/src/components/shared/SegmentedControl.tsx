interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex bg-gray-800 light:bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
            value === opt.value
              ? 'bg-emerald-500/20 light:bg-orange-500/20 text-emerald-300 light:text-orange-700 shadow-sm'
              : 'text-gray-400 light:text-gray-600 hover:text-gray-200 light:hover:text-gray-800 hover:bg-gray-700/50 light:hover:bg-gray-300/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
