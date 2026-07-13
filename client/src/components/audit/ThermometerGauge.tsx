import type { Thermometer } from '../../types';

interface ThermometerGaugeProps {
  thermometer: Thermometer;
}

const DIM_LABELS: Record<string, string> = {
  cantoneseFeel: '香港语感',
  culturalFit: '文化贴地',
  platformFit: '平台适配',
  brandSafety: '品牌安全',
  tradConsistency: '繁体一致',
  hookStrength: 'Hook强度',
  visualStrategy: 'Emoji策略',
  engagementFit: '互动引导',
};

function scoreColor(score: number): string {
  if (score <= 1) return 'text-red-400';
  if (score <= 2) return 'text-amber-400';
  if (score <= 3) return 'text-yellow-400';
  if (score <= 4) return 'text-lime-400';
  return 'text-emerald-400 light:text-emerald-600';
}

function barColor(score: number): string {
  if (score <= 1) return 'bg-red-400';
  if (score <= 2) return 'bg-amber-400';
  if (score <= 3) return 'bg-yellow-400';
  if (score <= 4) return 'bg-lime-400';
  return 'bg-emerald-400';
}

export default function ThermometerGauge({ thermometer }: ThermometerGaugeProps) {
  const { overall, dimensions } = thermometer;

  // Gauge arc parameters
  const radius = 60;
  const circumference = Math.PI * radius;
  const pct = overall / 100;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="space-y-3">
      {/* Semi-circular gauge */}
      <div className="flex justify-center">
        <div className="relative w-36 h-20">
          <svg viewBox="0 0 140 80" className="w-full h-full -mb-1">
            {/* Background arc */}
            <path
              d="M 10 70 A 60 60 0 0 1 130 70"
              fill="none"
              stroke="#1f2937"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Filled arc */}
            <path
              d="M 10 70 A 60 60 0 0 1 130 70"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="30%" stopColor="#fbbf24" />
                <stop offset="60%" stopColor="#a3e635" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <span className={`text-2xl font-bold ${scoreColor(Math.round(overall / 20))}`}>
              {overall}
            </span>
            <span className="text-[10px] text-gray-500 light:text-gray-500 block -mt-0.5">港味指数</span>
          </div>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="space-y-1.5">
        {Object.entries(dimensions).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 light:text-gray-500 w-14 text-right shrink-0">
              {DIM_LABELS[key] ?? key}
            </span>
            <div className="flex-1 h-1.5 bg-gray-800 light:bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(value)}`}
                style={{ width: `${(value / 5) * 100}%` }}
              />
            </div>
            <span className={`text-[11px] font-mono w-3 text-center ${scoreColor(value)}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
