import Badge from '../shared/Badge';
import type { AuditIssue, Severity } from '../../types';

interface IssueChipsProps {
  issues: AuditIssue[];
}

const severityVariant: Record<Severity, 'red' | 'amber' | 'blue'> = {
  high: 'red',
  medium: 'amber',
  low: 'blue',
};

export default function IssueChips({ issues }: IssueChipsProps) {
  if (issues.length === 0) {
    return <p className="text-xs text-gray-600 light:text-gray-500">没有检测到问题</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {issues.map((issue, i) => (
        <Badge
          key={i}
          label={`${issue.tag}`}
          variant={severityVariant[issue.severity]}
          dot
        />
      ))}
    </div>
  );
}
