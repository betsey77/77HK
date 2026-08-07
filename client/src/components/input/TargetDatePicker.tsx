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

  const openPicker = (el: HTMLInputElement) => {
    try {
      // Input is laid out over the field so the native popup anchors next to it.
      el.showPicker();
    } catch {
      // Older browsers: native click already targets this control.
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-emerald-400 light:text-orange-600">
        🗓️ 发布日期
      </label>

      {/*
        Native date popups (esp. Windows Chromium) anchor to the <input>'s box.
        `sr-only` makes a 1px off-screen target → calendar appears far away.
        Keep a full-size transparent input over the visible field instead.
      */}
      <div className="relative rounded-lg hover:border-emerald-500/50 light:hover:border-orange-500/50">
        <div
          className="w-full flex items-center gap-2 bg-gray-800/50 light:bg-white border border-gray-700/50
            light:border-gray-300/50 rounded-lg px-2.5 py-2 text-xs
            pointer-events-none"
          aria-hidden="true"
        >
          <Calendar className="w-4 h-4 text-emerald-400 light:text-orange-600 flex-shrink-0" />
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
        </div>

        <input
          ref={dateInputRef}
          type="date"
          value={currentDate}
          onChange={(e) => dispatch({ type: 'SET_TARGET_DATE', payload: e.target.value })}
          onClick={(e) => openPicker(e.currentTarget)}
          className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0
            rounded-lg
            focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/40 light:focus-visible:ring-orange-500/40"
          aria-label="发布日期"
          title="点击选择发布日期"
        />
      </div>

      {state.settings.targetDate && state.settings.targetDate !== TODAY && (
        <p className="text-[10px] text-emerald-400 light:text-orange-600">
          💡 已设定目标日期，可查看灵感参考中的话题日历
        </p>
      )}
    </div>
  );
}
