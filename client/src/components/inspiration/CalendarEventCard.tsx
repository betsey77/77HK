import type { CalendarEvent } from '../../types';

interface Props {
  event: CalendarEvent;
  checked: boolean;
  onToggle: (id: string) => void;
}

export default function CalendarEventCard({ event, checked, onToggle }: Props) {
  return (
    <div
      className={`rounded-lg p-2.5 border transition-all ${
        checked
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-gray-800/20 light:bg-gray-100 border-gray-700/20 light:border-gray-200 hover:border-gray-600/30 light:hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <label className="flex items-center cursor-pointer mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(event.id)}
            className="w-3.5 h-3.5 rounded border-gray-500 bg-gray-800
              accent-emerald-500 cursor-pointer"
          />
        </label>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-gray-200 light:text-gray-800">
              {event.titleZh}
            </span>
            <span className="text-[9px] text-gray-600 light:text-gray-500">
              {event.date.split('..')[0]}
            </span>
          </div>

          {/* Angles */}
          <div className="flex flex-wrap gap-1 mb-1">
            {event.angles.slice(0, 3).map((angle) => (
              <span
                key={angle}
                className="text-[8px] px-1 py-0.5 rounded bg-gray-700/30 light:bg-gray-200/50
                  text-gray-400 light:text-gray-600"
              >
                {angle}
              </span>
            ))}
          </div>

          {/* Applicable industries */}
          <p className="text-[9px] text-gray-600 light:text-gray-500 mb-1">
            适用行业：{event.applicableIndustries.slice(0, 4).join('、')}
          </p>

          {/* Narrative hooks preview */}
          {event.narrativeHooks.length > 0 && (
            <p className="text-[10px] text-amber-400/70 light:text-amber-600 italic">
              💡 {event.narrativeHooks[0]}
            </p>
          )}

          {/* Sensitivity note */}
          {event.sensitivityNote && (
            <p className="text-[9px] text-red-400/60 light:text-red-500 mt-1">
              ⚠️ {event.sensitivityNote}
            </p>
          )}

          {/* Checked hint */}
          {checked && (
            <p className="text-[9px] text-emerald-400 light:text-emerald-600 mt-1">
              ✓ 已添加至生成 prompt — 生成时会融入此话题角度
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
