import { Check, X } from 'lucide-react';
import type { GenerationProgress as GenerationProgressType, StageProgress } from '../../types';
import AgentTerminal from './AgentTerminal';

interface Props {
  progress: GenerationProgressType;
}

function StageDot({ stage }: { stage: StageProgress }) {
  let dot: React.ReactNode;

  switch (stage.status) {
    case 'done':
      dot = (
        <div
          data-stage={stage.stage}
          data-stage-status="done"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 light:bg-orange-100 border border-emerald-500/30 light:border-orange-300 transition-all duration-300"
        >
          <Check className="h-3.5 w-3.5 text-emerald-400 light:text-orange-600" />
        </div>
      );
      break;
    case 'active':
      dot = (
        <div
          data-stage={stage.stage}
          data-stage-status="active"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 light:bg-orange-100 border-2 border-emerald-400 light:border-orange-500 transition-all duration-300"
        >
          <div className="h-3 w-3 rounded-full bg-emerald-400 light:bg-orange-500 motion-safe:animate-pulse" />
        </div>
      );
      break;
    case 'failed':
      dot = (
        <div
          data-stage={stage.stage}
          data-stage-status="failed"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 transition-all duration-300"
        >
          <X className="h-3.5 w-3.5 text-red-400" />
        </div>
      );
      break;
    case 'pending':
    default:
      dot = (
        <div
          data-stage={stage.stage}
          data-stage-status="pending"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 light:bg-gray-100 border border-gray-700/30 light:border-gray-300/50 transition-all duration-300"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-gray-600 light:bg-gray-400" />
        </div>
      );
  }

  return dot;
}

function liveStatusText(stages: StageProgress[]): string {
  const failed = stages.find((s) => s.status === 'failed');
  if (failed) return `阶段失败：${failed.label}`;
  const active = stages.find((s) => s.status === 'active');
  if (active) return `当前预估阶段：${active.label}`;
  if (stages.every((s) => s.status === 'done')) return '生成流程已完成（预估）';
  return '生成未开始';
}

export default function GenerationProgress({ progress }: Props) {
  const { stages } = progress;

  const getTextClass = (stage: StageProgress): string => {
    switch (stage.status) {
      case 'done':
        return 'text-emerald-300 light:text-orange-700';
      case 'active':
        return 'text-emerald-400 light:text-orange-600 font-medium';
      case 'failed':
        return 'text-red-400';
      case 'pending':
      default:
        return 'text-gray-500 light:text-gray-400';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 py-6 w-full max-w-[520px] mx-auto">
      {/* Progress dots + connectors */}
      <div className="flex items-center justify-center gap-0" role="list" aria-label="生成四阶段">
        {stages.map((stage, i) => (
          <div key={stage.stage} className="flex items-center" role="listitem">
            <div className="flex flex-col items-center gap-1.5">
              <StageDot stage={stage} />
              <span className={`text-[10px] leading-tight text-center max-w-[60px] transition-colors duration-300 ${getTextClass(stage)}`}>
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className="mx-1 mb-5 w-8" aria-hidden="true">
                <div
                  className={`h-0.5 w-full rounded-full transition-all duration-500 ${
                    stage.status === 'done'
                      ? 'bg-emerald-400/60 light:bg-orange-500/60'
                      : stage.status === 'active'
                        ? 'bg-gradient-to-r from-emerald-400/60 to-gray-700/50 light:from-orange-500/60 light:to-gray-300/50'
                        : 'bg-gray-700/50 light:bg-gray-300/50'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Accessible live status (not color-only) */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveStatusText(stages)}
      </p>

      {/* Estimated label */}
      <p className="text-[10px] text-gray-500 light:text-gray-400">
        预估阶段 · 实际耗时可能因 AI 响应速度而异
      </p>

      {/* Agent Terminal — derived from StageProgress only */}
      <AgentTerminal progress={progress} />
    </div>
  );
}
