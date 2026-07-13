import { useContext, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function getDayLabel(dateStr: string): string {
  if (dateStr === TODAY) return '今日';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().slice(0, 10)) return '明日';
  return '';
}

export default function TargetDatePicker() {
  const { state, dispatch } = useContext(AppContext);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const currentDate = state.settings.targetDate ?? TODAY;
  const dayLabel = getDayLabel(currentDate);

  const handleIconClick = () => {
    // Use native date picker via hidden input
    if (dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch {
        // Fallback for browsers that don't support showPicker
        dateInputRef.current.click();
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-400 light:text-gray-600">
        📅 目标发布时间
      </label>

      <button
        onClick={handleIconClick}
        className="w-full flex items-center gap-2 bg-gray-800/50 light:bg-white border border-gray-700/50
          light:border-gray-300/50 rounded-lg px-2.5 py-2 text-xs
          hover:border-emerald-500/50 light:hover:border-orange-500/50 hover:ring-1 hover:ring-emerald-500/20 light:hover:ring-orange-500/20
          focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 focus:ring-1 focus:ring-emerald-500/20 light:focus:ring-orange-500/20
          transition-colors group"
      >
        <Calendar className="w-4 h-4 text-emerald-400 light:text-orange-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
        <span className="text-gray-200 light:text-gray-800">
          {formatDate(currentDate)}
        </span>
        {dayLabel && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 light:bg-orange-500/15 text-emerald-400 light:text-orange-600 font-medium">
            {dayLabel}
          </span>
        )}
        <span className="text-[10px] text-gray-500 light:text-gray-400 ml-auto">
          点击日历修改
        </span>
      </button>

      {/* Hidden native date input — triggers native picker on click */}
      <input
        ref={dateInputRef}
        type="date"
        value={currentDate}
        onChange={(e) => dispatch({ type: 'SET_TARGET_DATE', payload: e.target.value })}
        className="sr-only"
        aria-hidden="true"
      />

      {state.settings.targetDate && state.settings.targetDate !== TODAY && (
        <p className="text-[10px] text-emerald-400 light:text-orange-600">
          💡 已设定目标日期，可查看灵感参考中的话题日历
        </p>
      )}
    </div>
  );
}
