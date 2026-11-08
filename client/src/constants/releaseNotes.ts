/**
 * Workbench release notes — static, code-reviewed source of truth.
 * Only `status: 'deployed'` items are user-visible.
 * Add `deployed` entries only for the production candidate being released.
 */

export type ReleaseNoteStatus =
  | 'deployed'
  | 'local'
  | 'staging'
  | 'preview'
  | 'draft';

export interface ReleaseNoteSection {
  title: string;
  items: string[];
}

export interface ReleaseNote {
  version: string;
  status: ReleaseNoteStatus;
  /** ISO date YYYY-MM-DD for deployed releases; null for unpublished drafts. */
  releasedAt: string | null;
  title?: string;
  sections: ReleaseNoteSection[];
}

/** Product-facing version label (Footer / shell). */
export const APP_DISPLAY_VERSION = '2.2.0';

export const RELEASE_NOTES_EMPTY_COPY = '暂无已正式上线的更新';

/**
 * Draft/local/staging items may exist for review but never render.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.2.0',
    status: 'deployed',
    releasedAt: '2026-11-08',
    title: '版本 2.2.0',
    sections: [
      {
        title: '会员与额度',
        items: [
          '套餐页现在会标出会员是否已到期，并提供续费入口，不再把过期周期当作可用额度。',
          '会员到期与额度用完会分别提示；过期会员不再解锁收藏与历史。',
        ],
      },
      {
        title: '质量与可观测性',
        items: [
          '配额不足不再被误判为模型故障，坏包会显示真实错误码。',
          '新增请求级 trace 与配额拒绝原因记录，便于定位线上问题。',
        ],
      },
      {
        title: '运维',
        items: [
          '补齐生产等价代码与依赖，修复从 Git 构建时缺模块的问题。',
        ],
      },
    ],
  },
  {
    version: '2.1.1',
    status: 'deployed',
    releasedAt: '2026-08-07',
    title: '版本 2.1.1',
    sections: [
      {
        title: '体验修复',
        items: [
          '修复 Windows 浏览器中发布日期弹框位置偏移的问题。',
          '工作台版本标识更新为 v2.1.1。',
        ],
      },
    ],
  },
];

export function getDeployedReleaseNotes(
  notes: readonly ReleaseNote[] = RELEASE_NOTES,
): ReleaseNote[] {
  return notes
    .filter((note) => note.status === 'deployed')
    .slice()
    .sort((a, b) => {
      const dateA = a.releasedAt ?? '';
      const dateB = b.releasedAt ?? '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return b.version.localeCompare(a.version, undefined, { numeric: true });
    });
}
