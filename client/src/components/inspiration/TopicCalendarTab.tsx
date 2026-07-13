import { useState, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import CalendarEventCard from './CalendarEventCard';
import type { CalendarEvent } from '../../types';

interface Props {
  selectedEventIds: Set<string>;
  onToggleEvent: (id: string) => void;
}

export default function TopicCalendarTab({ selectedEventIds, onToggleEvent }: Props) {
  const { state } = useContext(AppContext);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inspiration/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate: state.settings.targetDate || undefined,
        }),
      });
      if (!res.ok) throw new Error('获取话题日历失败');
      const data = await res.json();
      setEvents((data as { events: CalendarEvent[] }).events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [state.settings.targetDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500">⏳ 正在匹配话题...</p>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 rounded-lg p-3 animate-pulse">
            <div className="w-20 h-3 bg-gray-700/30 light:bg-gray-300 rounded mb-2" />
            <div className="w-full h-2.5 bg-gray-700/20 light:bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-[10px] text-red-400 mb-2">❌ {error}</p>
        <button
          onClick={fetchEvents}
          className="text-[10px] px-3 py-1 rounded bg-red-500/10 border border-red-500/20
            text-red-400 hover:bg-red-500/20 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-[10px] text-gray-500 light:text-gray-500 mb-1">
          📭 {state.settings.targetDate
            ? `未找到 ${state.settings.targetDate} 前后两周的匹配话题`
            : '未找到近期话题'}
        </p>
        <p className="text-[9px] text-gray-600 light:text-gray-500">
          {!state.settings.targetDate && '💡 在左侧设置「目标发布时间」可以精准匹配话题'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500 light:text-gray-500 mb-1">
        📅 {state.settings.targetDate
          ? `「${state.settings.targetDate}」前后两周的话题（${events.length} 个）`
          : `未来话题（${events.length} 个）`}
      </p>
      <div className="space-y-2 max-h-[360px] overflow-y-auto">
        {events.map((event) => (
          <CalendarEventCard
            key={event.id}
            event={event}
            checked={selectedEventIds.has(event.id)}
            onToggle={onToggleEvent}
          />
        ))}
      </div>
      {selectedEventIds.size > 0 && (
        <p className="text-[10px] text-emerald-400 light:text-emerald-600 text-center">
          ✓ 已选择 {selectedEventIds.size} 个话题 — 生成时会融入话题角度
        </p>
      )}
    </div>
  );
}
