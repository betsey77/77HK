import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import ThermometerGauge from './ThermometerGauge';
import IssueChips from './IssueChips';
import ReplacementCard from './ReplacementCard';
import RiskNotes from './RiskNotes';
import ScoreDisplay from '../results/ScoreDisplay';
import ConsumerFeedbackSection from '../results/ConsumerFeedback';
import QuickCheck from './QuickCheck';

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-[11px] font-semibold text-gray-500 light:text-gray-500 uppercase tracking-wider">{children}</h3>;
}

export default function AuditPanel() {
  const { state } = useContext(AppContext);
  const { audit, scores, consumerFeedback, generationEngine, uiState, variants, settings } = state;

  if (uiState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <div className="text-2xl opacity-30">📊</div>
        <p className="text-xs text-gray-500 light:text-gray-500">生成文案后，审核结果会显示在这里</p>
      </div>
    );
  }

  if (!audit) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto p-4">
      {/* 港味溫度計 — always visible, the classic visual */}
      <div>
        <SectionTitle>🌡️ 港味温度计</SectionTitle>
        <div className="mt-2 bg-gray-800/20 light:bg-gray-100 border border-gray-700/30 light:border-gray-300/50 rounded-lg p-3">
          <ThermometerGauge thermometer={audit.thermometer} />
        </div>
      </div>

      {/* V2 Five-dimension scores — supplementary detail when available */}
      {scores?.generated && (
        <div>
          <SectionTitle>📊 五维评分</SectionTitle>
          <div className="mt-2 bg-gray-800/20 light:bg-gray-100 border border-gray-700/30 light:border-gray-300/50 rounded-lg p-3">
            <ScoreDisplay generated={scores.generated} source={scores.source} />
          </div>
        </div>
      )}

      {/* Issues */}
      <div>
        <SectionTitle>问题标签</SectionTitle>
        <div className="mt-2">
          <IssueChips issues={audit.issues} />
        </div>
      </div>

      {/* Replacements */}
      {audit.replacements.length > 0 && (
        <div>
          <SectionTitle>替换建议</SectionTitle>
          <div className="mt-2 space-y-1.5">
            {audit.replacements.map((r, i) => (
              <ReplacementCard key={i} replacement={r} />
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      <div>
        <SectionTitle>风险提示</SectionTitle>
        <div className="mt-2">
          <RiskNotes risks={audit.risks} />
        </div>
      </div>

      {/* Quick Check — P2.3 local rules engine */}
      {variants && (
        <QuickCheck
          variants={variants}
          brandName={settings.brandName || undefined}
          brandRedLines={settings.brandRedLines || undefined}
        />
      )}

      {/* Consumer Feedback — V2 replaces "街坊留言模擬" */}
      {consumerFeedback && consumerFeedback.length > 0 ? (
        <div>
          <ConsumerFeedbackSection feedback={consumerFeedback} />
        </div>
      ) : (
        /* Fallback to legacy simulated comments */
        audit.comments.length > 0 && (
          <div>
            <SectionTitle>街坊留言模拟</SectionTitle>
            <div className="mt-2 space-y-1.5">
              {audit.comments.map((c, i) => (
                <div
                  key={i}
                  className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/30 light:border-gray-300/50 rounded-lg px-3 py-2"
                >
                  <span className="text-[10px] text-gray-500 light:text-gray-500">{c.type}</span>
                  <p className="text-xs text-gray-300 light:text-gray-800 mt-0.5">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Generation engine badge */}
      {generationEngine && (
        <div className="bg-emerald-500/5 light:bg-emerald-50 border border-emerald-500/20 light:border-emerald-200 rounded-lg p-2.5 space-y-1">
          <p className="text-[11px] text-emerald-300 light:text-emerald-700 font-medium">
            {generationEngine === 'self-hosted-cantonese'
              ? '🖥️ Qwen3-4B-CV-KD（本地模型）'
              : generationEngine === 'featherless-cantonese'
              ? '✨ 专业粤语模型生成'
              : generationEngine === 'deepseek'
                ? 'DeepSeek 生成（后备引擎）'
                : '快速规则生成（避免超时）'}
          </p>
          <p className="text-[10px] text-emerald-500/70 light:text-emerald-600/70">
            {generationEngine === 'self-hosted-cantonese'
              ? 'hon9kon9ize/Qwen3-4B-CV-KD local'
              : generationEngine === 'featherless-cantonese'
              ? 'CantoneseLLMChat-v1.0-32B (Featherless.ai)'
              : generationEngine === 'deepseek'
                ? 'deepseek-v4-flash'
                : 'local rules fallback'}
          </p>
        </div>
      )}
    </div>
  );
}
