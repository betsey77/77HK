import { useContext, useState, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import { MAX_SAVED_CONFIGS } from '../../constants';
import type { SavedConfig } from '../../types';

function makeConfigId() {
  return `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function sameStringArray(a: string[] = [], b: string[] = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export default function ConfigManager() {
  const { state, dispatch } = useContext(AppContext);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');

  const defaultName = [
    state.settings.brandName,
    state.settings.productName,
    state.settings.tone,
  ]
    .filter(Boolean)
    .join('-') || '未命名配置';

  const hasUnsavedChanges = (() => {
    const cfg = state.savedConfigs[0];
    if (!cfg) return true;
    return (
      cfg.brandName !== state.settings.brandName ||
      cfg.productName !== state.settings.productName ||
      cfg.brandRedLines !== state.settings.brandRedLines ||
      cfg.structuredBriefEnabled !== state.settings.structuredBriefEnabled ||
      cfg.creativityLevel !== state.settings.creativityLevel ||
      cfg.cantoneseLevel !== state.settings.cantoneseLevel ||
      cfg.englishMixingLevel !== state.settings.englishMixingLevel ||
      cfg.tone !== state.settings.tone ||
      cfg.platform !== state.settings.platform ||
      cfg.inputLanguage !== state.settings.inputLanguage ||
      (cfg.copyType ?? 'social') !== state.settings.copyType ||
      (cfg.customCopyType ?? '') !== (state.settings.customCopyType ?? '') ||
      (cfg.lengthControlEnabled ?? false) !== state.settings.lengthControlEnabled ||
      (cfg.copyLengthLevel ?? 3) !== state.settings.copyLengthLevel ||
      (cfg.primaryTone ?? cfg.tone) !== state.settings.primaryTone ||
      !sameStringArray(cfg.toneModifiers ?? [], state.settings.toneModifiers ?? []) ||
      !sameStringArray(
        cfg.selectedReferenceCaseIds,
        state.settings.selectedReferenceCaseIds,
      ) ||
      !sameStringArray(
        cfg.selectedCaseLibraryIds,
        state.settings.selectedCaseLibraryIds,
      ) ||
      (cfg.targetDate ?? '') !== (state.settings.targetDate ?? '') ||
      !sameStringArray(
        cfg.selectedCalendarEventIds ?? [],
        state.settings.selectedCalendarEventIds ?? [],
      )
    );
  })();

  const saveConfig = useCallback(() => {
    const name = saveName.trim() || defaultName;
    if (!name) return;

    const config: SavedConfig = {
      id: makeConfigId(),
      name,
      brandName: state.settings.brandName,
      productName: state.settings.productName,
      brandRedLines: state.settings.brandRedLines,
      structuredBriefEnabled: state.settings.structuredBriefEnabled,
      creativityLevel: state.settings.creativityLevel,
      cantoneseLevel: state.settings.cantoneseLevel,
      englishMixingLevel: state.settings.englishMixingLevel,
      tone: state.settings.primaryTone ?? state.settings.tone,
      platform: state.settings.platform,
      inputLanguage: state.settings.inputLanguage,
      consumerPersonas: state.settings.consumerPersonas,
      selectedReferenceCaseIds: state.settings.selectedReferenceCaseIds ?? [],
      selectedCaseLibraryIds: state.settings.selectedCaseLibraryIds ?? [],
      targetDate: state.settings.targetDate,
      selectedCalendarEventIds: [...(state.settings.selectedCalendarEventIds ?? [])],
      copyType: state.settings.copyType,
      customCopyType: state.settings.customCopyType,
      lengthControlEnabled: state.settings.lengthControlEnabled,
      copyLengthLevel: state.settings.copyLengthLevel,
      primaryTone: state.settings.primaryTone,
      toneModifiers: state.settings.toneModifiers ?? [],
      createdAt: new Date().toISOString(),
    };

    // Keep most recent configs, cap at MAX_SAVED_CONFIGS
    const updated = [config, ...state.savedConfigs.filter((c) => c.name !== name)].slice(
      0,
      MAX_SAVED_CONFIGS,
    );
    dispatch({ type: 'SET_SAVED_CONFIGS', payload: updated });
    setShowSave(false);
    setSaveName('');
  }, [saveName, defaultName, state.settings, state.savedConfigs, dispatch]);

  const loadConfig = useCallback(
    (config: SavedConfig) => {
      dispatch({ type: 'LOAD_CONFIG', payload: config });
    },
    [dispatch],
  );

  const deleteConfig = useCallback(
    (id: string) => {
      const updated = state.savedConfigs.filter((c) => c.id !== id);
      dispatch({ type: 'SET_SAVED_CONFIGS', payload: updated });
    },
    [state.savedConfigs, dispatch],
  );

  return (
    <div className="space-y-2 border-t border-gray-800 light:border-gray-200 pt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 light:text-gray-600 font-medium">💾 配置管理</span>
        {hasUnsavedChanges && (
          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
            未储存
          </span>
        )}
      </div>

      {/* Saved configs dropdown */}
      {state.savedConfigs.length > 0 && (
        <div className="space-y-1">
          {state.savedConfigs.slice(0, 5).map((cfg) => (
            <div
              key={cfg.id}
              className="flex items-center gap-1 bg-gray-800/30 light:bg-gray-200/50 border border-gray-700/50 light:border-gray-300 rounded-lg px-2 py-1"
            >
              <button
                onClick={() => loadConfig(cfg)}
                className="flex-1 text-left text-xs text-gray-300 light:text-gray-800 hover:text-emerald-300 truncate transition-colors"
                title={`${cfg.tone} | 粤${cfg.cantoneseLevel} | 英${cfg.englishMixingLevel} | 创作${cfg.creativityLevel} | 参考${cfg.selectedReferenceCaseIds?.length ?? 0} | 案例${cfg.selectedCaseLibraryIds?.length ?? 0}`}
              >
                {cfg.name}
              </button>
              <button
                onClick={() => deleteConfig(cfg.id)}
                className="text-[10px] text-gray-600 light:text-gray-500 hover:text-red-400 px-1 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      {showSave ? (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={defaultName}
            className="flex-1 bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-200 light:text-gray-800
              placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30"
            onKeyDown={(e) => e.key === 'Enter' && saveConfig()}
          />
          <button
            onClick={saveConfig}
            className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-300
              border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            储存
          </button>
          <button
            onClick={() => { setShowSave(false); setSaveName(''); }}
            className="px-2 py-1.5 text-xs text-gray-500 light:text-gray-500 hover:text-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSave(true)}
          className="w-full text-xs text-gray-500 light:text-gray-500 hover:text-gray-300 py-1.5 rounded-lg
            border border-dashed border-gray-700/50 light:border-gray-300 hover:border-gray-600 transition-colors"
        >
          + 储存当前配置
        </button>
      )}
    </div>
  );
}
