/** Title-case a single segment (letters); leaves numbers/symbols as-is. */
function titleCaseSegment(segment: string): string {
  const lower = segment.toLowerCase();
  if (!/^[a-z]/i.test(lower)) {
    return segment;
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Standard display for person names (e.g. "JOHN SMITH" → "John Smith", "john smith" → "John Smith").
 * Hyphenated parts are title-cased per segment. Does not alter district fallback strings like "District 12".
 */
export function formatPersonNameForDisplay(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return name;
  }
  return trimmed
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => titleCaseSegment(part))
        .join("-"),
    )
    .join(" ");
}
