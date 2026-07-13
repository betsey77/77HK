// ============================================================
// Calendar coverage validation & enforcement — bounded, no retries, no extra cost
// ============================================================

export interface CalendarCoverageResult {
	/** Per-variant coverage: true if at least one calendar keyword found. */
	variantCoverage: Record<string, boolean>;
	/** Whether all 5 platform variants have calendar coverage. */
	allCovered: boolean;
	/** Variants that missed coverage. */
	missedVariants: string[];
}

export const VARIANT_KEYS = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'] as const;

/** Minimum keyword length for coverage detection — avoids 2-char false positives. */
const MIN_KEYWORD_LENGTH = 3;

/**
 * Platform-appropriate bridge sentence templates.
 * Each entry is a function that takes event context and returns a short sentence.
 */
type BridgeFn = (ctx: { titleZh: string; angle: string; hook: string }) => string;

const PLATFORM_BRIDGES: Record<string, BridgeFn> = {
	standardHK: ({ titleZh, angle }) =>
		`#${titleZh} 話題進行中！${angle}，即刻了解更多詳情。`,

	lightCantonese: ({ titleZh, hook }) =>
		`講到${titleZh}，${hook}`,

	ig: ({ titleZh, angle }) =>
		`📌 #${titleZh} ${angle}，你準備好未？`,

	facebook: ({ titleZh, angle }) =>
		`【${titleZh}】${angle}，歡迎留言分享你嘅睇法！`,

	shorts: ({ hook }) =>
		`${hook} 🔥`,
};

/**
 * Validate that each of the 5 platform variants contains at least one
 * calendar event keyword (angle or narrative hook fragment).
 *
 * This is a bounded, offline check — no model calls, no retries, no quota cost.
 * It provides observability but does NOT modify generation behaviour.
 *
 * Prefer `ensureCalendarCoverage` for production enforcement.
 */
export function validateCalendarCoverage(
	variants: Record<string, string>,
	calendarEvents?: { angles: string[]; narrativeHooks: string[]; titleZh?: string }[],
): CalendarCoverageResult {
	if (!calendarEvents || calendarEvents.length === 0) {
		return {
			variantCoverage: Object.fromEntries(VARIANT_KEYS.map((k) => [k, true])),
			allCovered: true,
			missedVariants: [],
		};
	}

	// Build a set of meaningful keyword fragments (≥3 chars) from all selected events
	const keywords = new Set<string>();
	for (const ev of calendarEvents) {
		for (const angle of ev.angles) {
			keywords.add(angle);
			// Also add longer substrings as fallback fragments (≥3 chars to avoid false positives)
			if (angle.length >= MIN_KEYWORD_LENGTH) {
				keywords.add(angle.slice(0, MIN_KEYWORD_LENGTH));
			}
			if (angle.length >= 4) {
				keywords.add(angle.slice(0, 4));
			}
		}
		for (const hook of ev.narrativeHooks) {
			keywords.add(hook);
			if (hook.length >= MIN_KEYWORD_LENGTH) {
				keywords.add(hook.slice(0, MIN_KEYWORD_LENGTH));
			}
			if (hook.length >= 4) {
				keywords.add(hook.slice(0, 4));
			}
		}
	}

	const variantCoverage: Record<string, boolean> = {};
	const missedVariants: string[] = [];

	for (const key of VARIANT_KEYS) {
		const text = variants[key] ?? '';
		const covered = [...keywords].some((kw) => text.includes(kw));
		variantCoverage[key] = covered;
		if (!covered) {
			missedVariants.push(key);
		}
	}

	return {
		variantCoverage,
		allCovered: missedVariants.length === 0,
		missedVariants,
	};
}

/**
 * Enforce calendar event coverage across all 5 platforms.
 *
 * For any platform variant that lacks calendar event coverage, appends a
 * deterministic, platform-appropriate bridge sentence generated from the
 * event's titleZh, angles, and narrativeHooks.
 *
 * - No model calls, no retries, no quota cost.
 * - Already-covered variants are left unchanged.
 * - When no events are selected, the original variants are returned as-is.
 * - Each bridge sentence is short and natural — it acts as a light tie-in
 *   rather than a heavy-handed insertion.
 *
 * IMPORTANT: This function must be called BEFORE persisting results and
 * BEFORE the HTTP response is sent, so that persisted data and returned
 * data are consistent.
 */
export function ensureCalendarCoverage(
	variants: Record<string, string>,
	calendarEvents?: { titleZh: string; angles: string[]; narrativeHooks: string[] }[],
): Record<string, string> {
	if (!calendarEvents || calendarEvents.length === 0) {
		return { ...variants };
	}

	// Use the first event's data to generate bridge sentences
	const primary = calendarEvents[0]!;
	const ctx = {
		titleZh: primary.titleZh,
		angle: primary.angles[0] ?? primary.titleZh,
		hook: primary.narrativeHooks[0] ?? primary.angles[0] ?? primary.titleZh,
	};

	const coverage = validateCalendarCoverage(variants, calendarEvents);

	// If all covered, return as-is
	if (coverage.allCovered) {
		return { ...variants };
	}

	// Patch only the missed variants
	const patched: Record<string, string> = {};
	for (const key of VARIANT_KEYS) {
		const original = variants[key] ?? '';
		if (coverage.variantCoverage[key]) {
			patched[key] = original;
		} else {
			const bridgeFn = PLATFORM_BRIDGES[key];
			const bridge = bridgeFn ? bridgeFn(ctx) : `#${ctx.titleZh} ${ctx.angle}`;
			patched[key] = original
				? `${original}\n\n${bridge}`
				: bridge;
		}
	}

	return patched;
}
