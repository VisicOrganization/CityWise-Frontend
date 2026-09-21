import { CATEGORY_LABELS, CATEGORY_ORDER } from "../map/neighborhoodMapLayers";
import type { AssetProperties, PanelAsset } from "../map/cd2Assets";

/**
 * The embed's resource list: real, keyboard-navigable DOM, not a copy of `ResourceDetailPanel`.
 *
 * `ResourceDetailPanel` is a fixed-position left dock (`.neighborhood-detail-host` is
 * `position: absolute` with a slide-in animation) built to float over `CityMap`'s WebGL canvas
 * inside `.city-demo-map`. The embed instead needs the list to sit in normal flow beside or
 * below the map -- side-by-side at >=768px, stacked under a fixed-height map below that -- with
 * no overlay, no dock animation, and no dependency on a `.city-demo-map` ancestor for its
 * positioning context. Contorting the dock component to also work in-flow would mean fighting
 * its CSS rather than reusing it, so this is a small purpose-built list instead. It reuses every
 * data-shaping piece from `cd2Assets.ts` / `neighborhoodMapLayers.ts` -- only the chrome differs.
 */

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Strips the scheme so a long URL reads as a domain rather than wrapping over three lines. */
function linkText(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export interface EmbedResourceListProps {
  assets: PanelAsset[];
  emptyMessage: string;
}

export function EmbedResourceList({ assets, emptyMessage }: EmbedResourceListProps) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: assets.filter((item) => item.properties.category === category),
  })).filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {groups.map((group) => (
        <section key={group.category} aria-labelledby={`embed-group-${group.category}`}>
          {groups.length > 1 ? (
            <h3
              id={`embed-group-${group.category}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {CATEGORY_LABELS[group.category] ?? group.category}
              <span className="ml-1.5 font-normal normal-case text-slate-400">
                ({group.items.length})
              </span>
            </h3>
          ) : null}
          <ul className="flex flex-col gap-2.5">
            {group.items.map((item) => (
              <EmbedResourceCard key={item.key} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EmbedResourceCard({ item }: { item: PanelAsset }) {
  const properties: Partial<AssetProperties> = item.properties;
  const label = readText(properties.label) || "Unnamed location";
  const address = readText(properties.address);
  const phone = readText(properties.phone);
  const email = readText(properties.email);
  const meeting = readText(properties.meeting_information);
  const website = readText(properties.website);

  return (
    <li className="min-w-0 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <h4 className="break-words text-sm font-semibold text-slate-800">{label}</h4>
      {address ? <p className="mt-0.5 break-words text-sm text-slate-600">{address}</p> : null}
      {phone || email || meeting || website ? (
        <dl className="mt-1.5 flex min-w-0 flex-col gap-0.5 text-sm">
          {phone ? (
            <div className="flex gap-1.5">
              <dt className="flex-none text-slate-500">Phone:</dt>
              <dd className="min-w-0 break-words">
                <a className="text-sky-700 underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                  {phone}
                </a>
              </dd>
            </div>
          ) : null}
          {email ? (
            <div className="flex gap-1.5">
              <dt className="flex-none text-slate-500">Email:</dt>
              <dd className="min-w-0 break-words">
                <a className="text-sky-700 underline" href={`mailto:${email}`}>
                  {email}
                </a>
              </dd>
            </div>
          ) : null}
          {meeting ? (
            <div className="flex gap-1.5">
              <dt className="flex-none text-slate-500">Meetings:</dt>
              <dd className="min-w-0 break-words text-slate-700">{meeting}</dd>
            </div>
          ) : null}
          {website ? (
            <div className="flex gap-1.5">
              <dt className="flex-none text-slate-500">Website:</dt>
              <dd className="min-w-0 break-words">
                <a
                  className="text-sky-700 underline"
                  href={website}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {linkText(website)}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}
