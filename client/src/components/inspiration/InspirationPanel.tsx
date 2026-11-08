import { useContext, useState, useCallback, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import Tabs from '../shared/Tabs';
import LanguageVibeTab from './LanguageVibeTab';
import TopicCalendarTab from './TopicCalendarTab';
import HotTrendsTab from './HotTrendsTab';
import CompetitorActivityTab from './CompetitorActivityTab';
import type { InspirationTab, CompetitorAd, HKPost } from '../../types';
import { INSPIRATION_TABS } from '../../types';
import { apiUrl } from '../../services/apiBase';
import { authApiFetch, getInspirationErrorMessage } from '../../services/api';

export default function InspirationPanel() {
  const { state, dispatch } = useContext(AppContext);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<InspirationTab>('languageVibe');

  // ---- Calendar selected events (from context) ----
  const selectedEventIds = new Set(state.settings.selectedCalendarEventIds ?? []);
  const handleToggleEvent = useCallback((id: string) => {
    const current = state.settings.selectedCalendarEventIds ?? [];
    const next = current.includes(id)
      ? current.filter((eid) => eid !== id)
      : [...current, id];
    dispatch({ type: 'SET_SELECTED_CALENDAR_EVENTS', payload: next });
  }, [state.settings.selectedCalendarEventIds, dispatch]);

  // ---- Competitor ads state ----
  const [competitorAds, setCompetitorAds] = useState<CompetitorAd[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);

  const handleCompetitorSearch = useCallback(async (queries: string[]) => {
    if (queries.length === 0) return;
    setCompLoading(true);
    setCompError(null);
    try {
      // Search all selected brands in parallel, merge results
      const results = await Promise.all(
        queries.map((query) =>
          fetch(apiUrl('/competitor/search'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 8 }),
          })
            .then((res) => {
              if (!res.ok) throw new Error(`搜索「${query}」失败`);
              return res.json();
            })
            .then((data) => ({
              query,
              ads: ((data as { ads: CompetitorAd[] }).ads ?? []) as CompetitorAd[],
            }))
            .catch((err) => {
              console.warn(`[InspirationPanel] Competitor search "${query}" failed:`, err);
              return { query, ads: [] as CompetitorAd[] };
            }),
        ),
      );

      // Merge all ads, deduplicate by adArchiveId
      const seen = new Set<string>();
      const merged: CompetitorAd[] = [];
      for (const r of results) {
        for (const ad of r.ads) {
          if (!seen.has(ad.adArchiveId)) {
            seen.add(ad.adArchiveId);
            merged.push(ad);
          }
        }
      }

      setCompetitorAds(merged);
      if (merged.length === 0) {
        setCompError('未找到竞品广告（Direct GraphQL 可能被 Facebook 拦截，请配置 META_ACCESS_TOKEN 获取真实数据）');
      }
    } catch (err) {
      setCompError(err instanceof Error ? err.message : '搜索失败');
      setCompetitorAds([]);
    } finally {
      setCompLoading(false);
    }
  }, []);

  // Auto-search when competitorQueries change in context (from left sidebar)
  useEffect(() => {
    const queries = state.settings.competitorQueries;
    if (queries && queries.length > 0) {
      handleCompetitorSearch(queries);
    }
  }, [state.settings.competitorQueries, handleCompetitorSearch]);

  // ---- Hot trends state ----
  const [hotPosts, setHotPosts] = useState<HKPost[]>([]);
  const [hotLoading, setHotLoading] = useState(false);
  const [hotError, setHotError] = useState<string | null>(null);
  const [hotFetched, setHotFetched] = useState(false);

  const fetchHotTrends = useCallback(async () => {
    setHotLoading(true);
    setHotError(null);
    try {
      const res = await authApiFetch('/inspiration/hot-trends', {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await getInspirationErrorMessage(res));
      const data = await res.json();
      setHotPosts((data as { posts: HKPost[] }).posts ?? []);
      setHotFetched(true);
    } catch (err) {
      setHotError(err instanceof Error ? err.message : '获取失败');
      setHotFetched(true);
    } finally {
      setHotLoading(false);
    }
  }, []);

  // Auto-fetch hot trends when tab is selected (one-time fetch, cached)
  useEffect(() => {
    if (activeTab === 'hotTrends' && !hotFetched) {
      fetchHotTrends();
    }
  }, [activeTab, hotFetched, fetchHotTrends]);

  // Render active tab content
  const renderTab = () => {
    switch (activeTab) {
      case 'languageVibe':
        return <LanguageVibeTab />;
      case 'topicCalendar':
        return (
          <TopicCalendarTab
            selectedEventIds={selectedEventIds}
            onToggleEvent={handleToggleEvent}
          />
        );
      case 'hotTrends':
        return (
          <HotTrendsTab
            posts={hotPosts}
            loading={hotLoading}
            error={hotError}
            onRetry={fetchHotTrends}
          />
        );
      case 'competitorActivity':
        return (
          <CompetitorActivityTab
            ads={competitorAds}
            loading={compLoading}
            error={compError}
            onSearch={handleCompetitorSearch}
          />
        );
    }
  };

  // Build tabs with live badge on hot trends
  const tabs = INSPIRATION_TABS.map((t) => ({
    key: t.key,
    label: t.key === 'hotTrends' ? `${t.label} 🔴` : t.label,
  }));

  return (
    <div className="mt-3 border border-gray-700/30 light:border-gray-300/30 rounded-lg overflow-hidden flex-shrink-0">
      {/* Header bar */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/30 light:bg-gray-100
          hover:bg-gray-800/50 light:hover:bg-gray-200/50 transition-colors"
      >
        <span className="text-xs font-medium text-gray-300 light:text-gray-700">
          💡 灵感参考{isExpanded ? '（收起）' : '（展开）'}
        </span>
        <span className="text-[10px] text-gray-500 light:text-gray-400">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Collapsible body */}
      <div
        className={`transition-all duration-200 ${
          isExpanded ? 'max-h-[300px] overflow-y-auto' : 'max-h-0 overflow-hidden'
        }`}
      >
        {/* Tab bar */}
        <div className="px-2 pt-1">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as InspirationTab)}
          />
        </div>

        {/* Tab content */}
        <div className="p-3">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
