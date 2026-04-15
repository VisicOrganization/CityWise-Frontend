export function formatProjectTitleForDisplay(rawTitle: string): string {
  const slashIndex = rawTitle.indexOf("/");
  if (slashIndex < 0) {
    return rawTitle;
  }

  const beforeSlash = rawTitle.slice(0, slashIndex).trim();
  return beforeSlash.length > 0 ? beforeSlash : rawTitle;
}
