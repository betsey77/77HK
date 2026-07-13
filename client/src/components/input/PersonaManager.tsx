import { useContext, useState, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import type { ConsumerPersona } from '../../types';

const DEFAULT_PERSONA_TEMPLATES: Omit<ConsumerPersona, 'id'>[] = [
  {
    name: '本地师奶阿May',
    ageRange: '35-50',
    occupation: '家庭主妇',
    habits: '精打细算、看WhatsApp group、重口碑',
    apps: 'Facebook、WhatsApp Group',
    notes: '对价钱敏感',
  },
  {
    name: '职场白领Jason',
    ageRange: '25-35',
    occupation: 'marketing manager',
    habits: '追求效率、看IG多过FB',
    apps: 'IG、LinkedIn',
    notes: '中英夹杂自然，对设计感要求高',
  },
  {
    name: '斜杠青年Chris',
    ageRange: '18-25',
    occupation: '大学生 / freelance designer',
    habits: '追求质感、钟意小众品牌',
    apps: 'IG、Threads、小红书',
    notes: '看design多过看字，caption太长会skip',
  },
  {
    name: '育儿爸妈Karen',
    ageRange: '30-45',
    occupation: '在职妈妈',
    habits: '关注教育同健康、会做功课先消费',
    apps: 'Facebook、WhatsApp Group',
    notes: '重视资讯准确性，对夸张广告免疫',
  },
];

function makeId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export default function PersonaManager() {
  const { state, dispatch } = useContext(AppContext);
  const [expanded, setExpanded] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const personas = state.settings.consumerPersonas;

  const addPersona = useCallback(
    (template?: Omit<ConsumerPersona, 'id'>) => {
      const newPersona: ConsumerPersona = {
        id: makeId(),
        name: template?.name ?? '',
        ageRange: template?.ageRange ?? '',
        occupation: template?.occupation ?? '',
        habits: template?.habits ?? '',
        apps: template?.apps ?? '',
        notes: template?.notes ?? '',
      };
      dispatch({
        type: 'SET_CONSUMER_PERSONAS',
        payload: [...personas, newPersona],
      });
    },
    [personas, dispatch],
  );

  const updatePersona = useCallback(
    (id: string, field: keyof ConsumerPersona, value: string) => {
      dispatch({
        type: 'SET_CONSUMER_PERSONAS',
        payload: personas.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      });
    },
    [personas, dispatch],
  );

  const removePersona = useCallback(
    (id: string) => {
      dispatch({
        type: 'SET_CONSUMER_PERSONAS',
        payload: personas.filter((p) => p.id !== id),
      });
    },
    [personas, dispatch],
  );

  const handleAIParse = useCallback(async () => {
    if (!freeText.trim() || freeText.trim().length < 10) {
      setParseError('请输入至少 10 个字描述你的目标消费者');
      return;
    }

    setParsing(true);
    setParseError(null);

    try {
      const res = await fetch(`/api/parse-personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeText.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setParseError(data.error || '解析失败');
        return;
      }

      if (data.personas && data.personas.length > 0) {
        dispatch({
          type: 'SET_CONSUMER_PERSONAS',
          payload: data.personas,
        });
        setFreeText('');
        setParseError(null);
      } else {
        setParseError('AI 无法从文字中提取消费者画像，请提供更多细节');
      }
    } catch {
      setParseError('网络错误，请确认后端服务正在运行');
    } finally {
      setParsing(false);
    }
  }, [freeText, dispatch]);

  const hasUnsavedPersonas = personas.length > 0;

  return (
    <div className="space-y-2 border-t border-gray-800 light:border-gray-200 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-400 light:text-gray-600 hover:text-gray-300 transition-colors"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        🧑‍🤝‍🧑 目标消费者画像（可选）
        {hasUnsavedPersonas && (
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            {personas.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* AI Free-text Parsing */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-500 light:text-gray-500">
              💡 直接描述你的目标消费者，AI 会自动整理成结构化画像。
              例如：「我的target是35-50岁香港师奶，她们对价钱敏感，钟意看Facebook...」
            </p>
            <textarea
              value={freeText}
              onChange={(e) => { setFreeText(e.target.value); setParseError(null); }}
              placeholder="描述你的目标消费者，任意格式都得..."
              rows={3}
              className="w-full bg-gray-900/50 border border-gray-700/50 light:border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-200 light:text-gray-800
                placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30 resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAIParse}
                disabled={parsing || freeText.trim().length < 10}
                className="text-[10px] px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30
                  text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {parsing ? '⏳ 解析中...' : '🤖 AI 智能解析'}
              </button>
              {parseError && (
                <span className="text-[10px] text-red-400">{parseError}</span>
              )}
            </div>
          </div>

          {/* Quick add templates */}
          <div>
            <p className="text-[10px] text-gray-600 light:text-gray-500 mb-1">快速添加预设画像：</p>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_PERSONA_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  onClick={() => addPersona(tmpl)}
                  className="text-[10px] px-2 py-1 rounded-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300
                    text-gray-400 light:text-gray-600 hover:text-gray-200 hover:border-gray-600 transition-colors"
                >
                  + {tmpl.name}
                </button>
              ))}
              <button
                onClick={() => addPersona()}
                className="text-[10px] px-2 py-1 rounded-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300
                  text-gray-500 light:text-gray-500 hover:text-gray-300 transition-colors"
              >
                + 自定义
              </button>
            </div>
          </div>

          {/* Persona list */}
          {personas.map((persona, idx) => (
            <div
              key={persona.id}
              className="bg-gray-800/30 light:bg-gray-200/50 border border-gray-700/50 light:border-gray-300 rounded-lg p-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 light:text-gray-500">消费者 {idx + 1}</span>
                <button
                  onClick={() => removePersona(persona.id)}
                  className="text-[10px] text-gray-600 light:text-gray-500 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                value={persona.name}
                onChange={(e) => updatePersona(persona.id, 'name', e.target.value)}
                placeholder="名称（必填）"
                className="w-full bg-gray-900/50 border border-gray-700/50 light:border-gray-300 rounded px-2 py-1 text-xs text-gray-200 light:text-gray-800
                  placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={persona.ageRange}
                  onChange={(e) => updatePersona(persona.id, 'ageRange', e.target.value)}
                  placeholder="年龄范围"
                  className="bg-gray-900/50 border border-gray-700/50 light:border-gray-300 rounded px-2 py-1 text-xs text-gray-200 light:text-gray-800
                    placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30"
                />
                <input
                  type="text"
                  value={persona.occupation}
                  onChange={(e) => updatePersona(persona.id, 'occupation', e.target.value)}
                  placeholder="职业"
                  className="bg-gray-900/50 border border-gray-700/50 light:border-gray-300 rounded px-2 py-1 text-xs text-gray-200 light:text-gray-800
                    placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30"
                />
              </div>
              <input
                type="text"
                value={persona.habits}
                onChange={(e) => updatePersona(persona.id, 'habits', e.target.value)}
                placeholder="消费习惯"
                className="w-full bg-gray-900/50 border border-gray-700/50 light:border-gray-300 rounded px-2 py-1 text-xs text-gray-200 light:text-gray-800
                  placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30"
              />
              <input
                type="text"
                value={persona.apps}
                onChange={(e) => updatePersona(persona.id, 'apps', e.target.value)}
                placeholder="常用 App"
                className="w-full bg-gray-900/50 border border-gray-700/50 light:border-gray-300 rounded px-2 py-1 text-xs text-gray-200 light:text-gray-800
                  placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30"
              />
              <input
                type="text"
                value={persona.notes}
                onChange={(e) => updatePersona(persona.id, 'notes', e.target.value)}
                placeholder="备注"
                className="w-full bg-gray-900/50 border border-gray-700/50 light:border-gray-300 rounded px-2 py-1 text-xs text-gray-200 light:text-gray-800
                  placeholder-gray-600 light:placeholder-gray-400 focus:outline-none focus:border-emerald-500/30"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
