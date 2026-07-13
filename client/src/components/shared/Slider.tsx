import { useTheme } from '../../context/ThemeContext';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  leftLabel: string;
  rightLabel: string;
  onChange: (value: number) => void;
}

export default function Slider({
  label,
  value,
  min,
  max,
  step,
  leftLabel,
  rightLabel,
  onChange,
}: SliderProps) {
  const { isDark } = useTheme();
  const pct = ((value - min) / (max - min)) * 100;
  const brandFill = isDark ? '#34d399' : '#f97316'; // emerald-400 : orange-500

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400 light:text-gray-600">{label}</span>
        <span className="text-xs font-mono text-emerald-400 light:text-orange-600 bg-emerald-400/10 light:bg-orange-400/10 px-1.5 py-0.5 rounded">
          {value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-gray-700 light:bg-gray-200 cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
          style={{
            background: `linear-gradient(to right, ${brandFill} 0%, ${brandFill} ${pct}%, #374151 ${pct}%, #374151 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 light:text-gray-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
