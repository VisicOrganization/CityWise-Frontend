import type { ProjectDetail } from "../api/contracts";

/** First project document with an http(s) URL (same rule as the project sidebar external link). */
export function primaryHttpDocumentUrlFromDetail(detail: ProjectDetail | null): string | null {
  if (!detail) {
    return null;
  }
  const doc = detail.documents.find((d) => d.url?.startsWith("http"));
  return doc?.url ?? null;
}
