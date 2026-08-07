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
export const APP_DISPLAY_VERSION = '2.1.1';

export const RELEASE_NOTES_EMPTY_COPY = '暂无已正式上线的更新';

/**
 * Draft/local/staging items may exist for review but never render.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
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
