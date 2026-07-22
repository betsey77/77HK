/**
 * Workbench release notes — static, code-reviewed source of truth.
 * Only `status: 'deployed'` items are user-visible.
 * Do not add a deployed `2.1` entry until E9 production deploy + manifest check.
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
export const APP_DISPLAY_VERSION = '2.1';

export const RELEASE_NOTES_EMPTY_COPY = '2.1 更新将在正式上线后公布';

/**
 * Static catalogue. E6 ships with no deployed entries so the shell can show
 * the empty state. Draft/local/staging items may exist for review but never render.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  // Intentionally no deployed 2.1 entry (E9 only).
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
