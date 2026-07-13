import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, ShieldAlert } from 'lucide-react';
import Badge from '../shared/Badge';
import type { Diagnosis } from '../../types';

interface DiagnosisSummaryProps {
  diagnosis: Diagnosis;
}

export default function DiagnosisSummary({ diagnosis }: DiagnosisSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const violationCount = diagnosis.complianceViolations?.length ?? 0;
  const totalIssues = diagnosis.issues.length + diagnosis.mainlandPhrases.length + violationCount;
  const hasHighSeverity = diagnosis.complianceViolations?.some(v => v.severity === 'high');

  return (
    <div className="border border-gray-700/30 light:border-gray-300/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/30 light:bg-gray-200/50 hover:bg-gray-800/50 light:hover:bg-gray-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          {hasHighSeverity ? (
            <ShieldAlert size={14} className="text-red-400" />
          ) : (
            <AlertTriangle size={14} className={violationCount > 0 ? 'text-red-400' : 'text-amber-400'} />
          )}
          <span className="text-xs font-medium text-gray-300 light:text-gray-800">
            原文诊断：检测到 {totalIssues} 个问题
            {violationCount > 0 && (
              <span className="text-red-400 light:text-red-600">（含 {violationCount} 项合规风险）</span>
            )}
          </span>
          {diagnosis.hasSimplifiedChars && (
            <Badge label="简体" variant="amber" dot />
          )}
          {violationCount > 0 && (
            <Badge label={`${violationCount} 红线`} variant="red" dot />
          )}
        </div>
        {expanded ? <ChevronDown size={14} className="text-gray-500 light:text-gray-500" /> : <ChevronRight size={14} className="text-gray-500 light:text-gray-500" />}
      </button>

      {expanded && (
        <div className="px-3 py-2 space-y-2 border-t border-gray-700/30 light:border-gray-300/50">
          {/* Compliance violations — always shown FIRST, most prominent */}
          {violationCount > 0 && (
            <div className="bg-red-500/10 light:bg-red-50 border border-red-500/30 light:border-red-300 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldAlert size={13} className="text-red-400" />
                <span className="text-xs font-semibold text-red-400 light:text-red-700">
                  🚫 合规红线违规（{violationCount} 项）
                </span>
              </div>
              <ul className="space-y-2">
                {diagnosis.complianceViolations!.map((v, i) => (
                  <li key={i} className="text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <span className={`mt-0.5 px-1 py-px rounded text-[9px] font-bold ${
                        v.severity === 'high'
                          ? 'bg-red-500/20 text-red-400 light:text-red-700'
                          : 'bg-amber-500/20 text-amber-400 light:text-amber-700'
                      }`}>
                        {v.severity === 'high' ? 'HIGH' : 'MED'}
                      </span>
                      <div className="flex-1">
                        <p className="text-red-300 light:text-red-800 font-medium">{v.rule}</p>
                        <p className="text-gray-500 light:text-gray-500 mt-0.5">
                          原文：「<span className="text-red-400 light:text-red-600 bg-red-500/10 light:bg-red-100 rounded px-0.5">{v.match}</span>」
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diagnosis.hasSimplifiedChars && (
            <p className="text-xs text-amber-300 light:text-amber-700">
              ⚠ 原文包含简体中文字，已全部转换为香港繁体中文
            </p>
          )}
          {diagnosis.mainlandPhrases.length > 0 && (
            <div>
              <span className="text-[11px] text-gray-500 light:text-gray-500">内地营销词汇替换：</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {diagnosis.mainlandPhrases.map((p, i) => (
                  <span key={i} className="text-[11px] text-gray-400 light:text-gray-600 bg-gray-800/50 light:bg-gray-200 rounded px-1.5 py-0.5">
                    {p.phrase} → <span className="text-emerald-300 light:text-emerald-700">{p.suggestion}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {diagnosis.issues.length > 0 && (
            <ul className="space-y-0.5">
              {diagnosis.issues.map((issue, i) => (
                <li key={i} className="text-[11px] text-gray-400 light:text-gray-600 flex items-start gap-1">
                  <span className="text-gray-600 light:text-gray-500 mt-0.5">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
