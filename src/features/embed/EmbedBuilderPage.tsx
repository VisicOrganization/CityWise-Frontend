import { useMemo, useState } from "react";

import { NEIGHBORHOOD_DISTRICT_ID, useDistrictAssetsState } from "../map/cd2Assets";
import { CopyButton } from "./CopyButton";
import { buildEmbedSnippet, buildEmbedTargets, EMBED_HEIGHT } from "./embedSnippet";

/**
 * Internal utility at `/embed/v1/builder`: pick a target, preview it live, and copy the exact
 * `<iframe>` snippet for the council office's CMS -- one at a time, or all eight at once.
 *
 * The snippet always points at the production domain even though the preview loads from
 * wherever this app is currently running (localhost in dev). Those are deliberately different:
 * only one of them is correct to paste into someone else's website.
 */
const PRODUCTION_ORIGIN = "https://citywise.app";

export function EmbedBuilderPage() {
  const assetsState = useDistrictAssetsState(NEIGHBORHOOD_DISTRICT_ID, true);
  const [selectedSlug, setSelectedSlug] = useState<string>("");

  const targets = useMemo(() => {
    if (assetsState.status !== "ready") {
      return [];
    }
    return buildEmbedTargets(NEIGHBORHOOD_DISTRICT_ID, assetsState.loaded.neighborhoods);
  }, [assetsState]);

  const selected = targets.find((target) => (target.slug ?? "") === selectedSlug) ?? targets[0];
  const snippet = selected ? buildEmbedSnippet(PRODUCTION_ORIGIN, selected) : "";

  // One block per target, each labelled with the page it belongs on, so the whole handoff can
  // go in a single email rather than eight.
  const allSnippets = targets
    .map((target) => {
      const destination = target.destinationUrl ?? "(page URL not in the dataset)";
      return `${target.name} - paste on ${destination}\n${buildEmbedSnippet(PRODUCTION_ORIGIN, target)}`;
    })
    .join("\n\n");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">CD2 embed builder</h1>
        <p className="mt-1 text-sm text-slate-500">
          Copy the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">&lt;iframe&gt;</code>{" "}
          for the district page or any neighborhood page. Each snippet carries only the four
          attributes their CMS preserves on save.
        </p>
      </div>

      {assetsState.status === "error" ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t load the neighborhood data, so the snippets can&apos;t be generated.
          Reload to try again.
        </p>
      ) : null}
      {assetsState.status === "loading" ? (
        <p className="text-sm text-slate-400">Loading neighborhoods…</p>
      ) : null}

      {targets.length > 0 && selected ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-slate-700">Preview one</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="embed-builder-select" className="text-sm font-medium text-slate-700">
                Target page
              </label>
              <select
                id="embed-builder-select"
                className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={selectedSlug}
                onChange={(event) => setSelectedSlug(event.target.value)}
              >
                {targets.map((target) => (
                  <option key={target.slug ?? "district"} value={target.slug ?? ""}>
                    {target.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label
                  htmlFor="embed-builder-snippet"
                  className="text-sm font-medium text-slate-700"
                >
                  Embed snippet
                </label>
                <textarea
                  id="embed-builder-snippet"
                  className="w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700"
                  value={snippet}
                  readOnly
                  rows={3}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
              <CopyButton value={snippet} className="mb-3" />
            </div>

            {selected.destinationUrl ? (
              <p className="text-xs text-slate-500">
                Goes on{" "}
                <a
                  className="underline"
                  href={selected.destinationUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {selected.destinationUrl}
                </a>
              </p>
            ) : null}

            <div className="w-full max-w-xl overflow-hidden rounded-md border border-slate-300">
              {/* Relative src: the preview loads from this app's own origin, not production. */}
              <iframe
                src={selected.path}
                width="100%"
                height={EMBED_HEIGHT}
                title={selected.title}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-700">
                All {targets.length} embed codes
              </h2>
              <CopyButton value={allSnippets} label="Copy all" />
            </div>

            <ul className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200">
              {targets.map((target) => {
                const targetSnippet = buildEmbedSnippet(PRODUCTION_ORIGIN, target);
                return (
                  <li
                    key={target.slug ?? "district"}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{target.name}</p>
                      {target.destinationUrl ? (
                        <a
                          className="break-all text-xs text-slate-500 underline"
                          href={target.destinationUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {target.destinationUrl}
                        </a>
                      ) : (
                        <p className="text-xs text-slate-400">Page URL not in the dataset</p>
                      )}
                    </div>
                    <CopyButton value={targetSnippet} />
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
