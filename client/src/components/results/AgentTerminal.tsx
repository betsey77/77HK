import { useEffect, useMemo, useRef } from 'react';
import type { GenerationProgress as GenerationProgressType, GenerationStage, StageProgress } from '../../types';

interface Props {
  progress: GenerationProgressType;
}

const STAGE_TAG: Record<GenerationStage, string> = {
  diagnosis: 'DIAGNOSE',
  generation: 'VARIANT_ENGINE',
  audit: 'QUALITY_GATE',
  feedback: 'AUDIENCE_SIM',
};

/** Copy aligned with approved design-draft terminal (Image reference). */
const STAGE_COPY: Record<GenerationStage, { start: string; done: string }> = {
  diagnosis: {
    start: '正在识别原文语言与品牌约束…',
    done: '原文诊断完成，已提取关键约束。',
  },
  generation: {
    start: '正在生成 5 个平台版本…',
    done: '平台差异化表达生成完成。',
  },
  audit: {
    start: '正在检查港味、平台适配与品牌安全…',
    done: '质量门禁检查通过。',
  },
  feedback: {
    start: '正在汇总目标消费者反馈…',
    done: '消费者反馈模拟完成。',
  },
};

interface LogLine {
  key: string;
  tag: string;
  message: string;
  active?: boolean;
  failed?: boolean;
}

/**
 * Derive user-readable estimated logs from stage statuses (not real SSE).
 * Done stages emit both start + done lines so the terminal reads like a full timeline.
 */
export function buildTerminalLogs(stages: StageProgress[]): LogLine[] {
  const lines: LogLine[] = [];
  const anyStarted = stages.some((s) => s.status !== 'pending');

  if (!anyStarted) {
    lines.push({
      key: 'system-idle',
      tag: 'SYSTEM',
      message: '等待生成流程开始…',
    });
    return lines;
  }

  lines.push({
    key: 'system-start',
    tag: 'SYSTEM',
    message: '已启动预估流程（本地演示）',
  });

  for (const stage of stages) {
    const tag = STAGE_TAG[stage.stage];
    const copy = STAGE_COPY[stage.stage];

    if (stage.status === 'pending') continue;

    if (stage.status === 'active') {
      lines.push({
        key: `${stage.stage}-start`,
        tag,
        message: copy.start,
        active: true,
      });
      continue;
    }

    if (stage.status === 'done') {
      lines.push({
        key: `${stage.stage}-start`,
        tag,
        message: copy.start,
      });
      lines.push({
        key: `${stage.stage}-done`,
        tag,
        message: copy.done,
      });
      continue;
    }

    if (stage.status === 'failed') {
      lines.push({
        key: `${stage.stage}-start`,
        tag,
        message: copy.start,
      });
      lines.push({
        key: `${stage.stage}-failed`,
        tag,
        message: '本阶段未完成（请查看错误提示）',
        failed: true,
      });
    }
  }

  return lines;
}

function tagClass(tag: string): string {
  switch (tag) {
    case 'DIAGNOSE':
      return 'text-emerald-400 light:text-orange-600';
    case 'VARIANT_ENGINE':
      return 'text-sky-400 light:text-sky-600';
    case 'QUALITY_GATE':
      return 'text-amber-400 light:text-amber-600';
    case 'AUDIENCE_SIM':
      return 'text-lime-400 light:text-lime-700';
    default:
      return 'text-gray-500 light:text-gray-400';
  }
}

export default function AgentTerminal({ progress }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const logs = useMemo(() => buildTerminalLogs(progress.stages), [progress.stages]);

  const activeStage = progress.stages.find((s) => s.status === 'active');
  const hasFailed = progress.stages.some((s) => s.status === 'failed');
  const allDone = progress.stages.every((s) => s.status === 'done');

  const meta = hasFailed
    ? 'stage · error'
    : allDone
      ? 'stage · success'
      : activeStage
        ? `stage · ${activeStage.stage}`
        : 'stage · idle';

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div
      data-testid="agent-terminal"
      className="w-full max-w-[520px] overflow-hidden rounded-xl border border-gray-700/40 light:border-gray-200 bg-gray-950 light:bg-white shadow-lg shadow-black/20 light:shadow-gray-200/80"
      role="region"
      aria-label="阶段状态终端（预估）"
    >
      <div className="flex items-center justify-between border-b border-gray-700/40 light:border-gray-100 bg-gray-900 light:bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-300 light:text-gray-800">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400 light:bg-orange-500 motion-safe:animate-pulse"
            aria-hidden="true"
          />
          Agent Terminal
          <span className="font-normal text-[10px] text-gray-500 light:text-gray-400">预估流程</span>
        </div>
        <span className="font-mono text-[10px] text-gray-500 light:text-gray-400" data-testid="terminal-meta">
          {meta}
        </span>
      </div>

      <div
        ref={bodyRef}
        className="max-h-[168px] overflow-y-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed"
      >
        {logs.map((line) => (
          <div
            key={line.key}
            data-testid="terminal-log"
            className={`flex gap-2 ${line.active ? 'text-gray-200 light:text-gray-800' : 'text-gray-400 light:text-gray-600'}`}
          >
            <span className={`shrink-0 font-semibold ${tagClass(line.tag)}`}>[{line.tag}]</span>
            <span className={line.failed ? 'text-red-400' : undefined}>
              {line.message}
              {line.active && (
                <span
                  className="ml-0.5 inline-block h-3 w-1.5 align-[-1px] rounded-[1px] bg-emerald-400 light:bg-orange-500 motion-safe:animate-pulse"
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
