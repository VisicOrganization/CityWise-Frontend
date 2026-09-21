/**
 * Whether a pathname is an embed route, and therefore must not load product analytics.
 *
 * Embeds render inside a City of Los Angeles page via iframe. Session replay firing there,
 * undisclosed in the city's own privacy policy, is the failure that gets an embed pulled after
 * it ships. This is the single highest-consequence predicate in the embed work, so it lives in
 * its own module with tests rather than inline in `main.tsx` where nothing could exercise it.
 *
 * `baseUrl` is Vite's `import.meta.env.BASE_URL`. It is `"/"` today, but it is normalised here
 * so that a future subpath deploy -- with or without a trailing slash -- cannot silently stop
 * matching and re-enable analytics on a government page.
 */
export function isEmbedPath(pathname: string, baseUrl: string): boolean {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const prefix = `${base}embed/`.replace(/\/{2,}/g, "/");
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalized.startsWith(prefix);
}
