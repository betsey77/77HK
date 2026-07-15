/**
 * Calendar date in Asia/Hong_Kong as YYYY-MM-DD.
 * Avoids UTC day lag (e.g. 16:00 UTC is already next day in HK).
 */
export function getHongKongDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const fields = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${fields.year}-${fields.month}-${fields.day}`;
}
