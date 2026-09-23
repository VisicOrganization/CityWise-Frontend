/**
 * Click-to-inspect card for one shelter or service point from the Scout shelters tile.
 *
 * Follows `CsaDetailPopup`'s defensive-read pattern: values arrive from a third-party tile, not
 * our own types, so every field is read defensively. `readText` is copied here rather than
 * imported from `CsaDetailPopup` (that module doesn't export it) — it is a small, stateless shim
 * with nothing to drift. `readNumber` isn't copied: none
 * of the fields this card renders are numeric, and an unused helper is worse than no helper.
 *
 * Unlike the CSA card's fixed stat rows, every field here is genuinely optional per record, so
 * absent or blank fields are skipped entirely rather than rendered as an empty label or "—".
 */
export interface ShelterDetailPopupProps {
  properties: Record<string, unknown>;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Joins the address parts that are present, comma-separating them, so a missing suite or unit
 * doesn't leave a dangling comma. */
function buildAddress(properties: Record<string, unknown>): string {
  const line1 = readText(properties.addrln1);
  const line2 = readText(properties.addrln2);
  const city = readText(properties.city);
  const state = readText(properties.state);
  const zip = readText(properties.zip);

  const streetPart = [line1, line2].filter(Boolean).join(" ");
  const cityStatePart = [city, state].filter(Boolean).join(", ");
  const localityPart = [cityStatePart, zip].filter(Boolean).join(" ");

  return [streetPart, localityPart].filter(Boolean).join(", ");
}

function buildCategory(properties: Record<string, unknown>): string {
  const cats = [properties.cat1, properties.cat2, properties.cat3].map(readText).filter(Boolean);
  return cats.join(", ");
}

export function ShelterDetailPopup({ properties }: ShelterDetailPopupProps) {
  const name = readText(properties.name) || readText(properties.org_name);
  const address = buildAddress(properties);
  const phones = readText(properties.phones);
  const hours = readText(properties.hours);
  const link = readText(properties.url) || readText(properties.link);
  const category = buildCategory(properties);

  return (
    <div className="homeless-count-popup">
      <h2 className="homeless-count-popup-title">{name || "Shelter or service"}</h2>

      {category ? <p className="homeless-count-popup-source">{category}</p> : null}
      {address ? <p className="homeless-count-popup-source">{address}</p> : null}
      {phones ? <p className="homeless-count-popup-source">{phones}</p> : null}
      {hours ? <p className="homeless-count-popup-source">{hours}</p> : null}
      {link ? (
        <p className="homeless-count-popup-source">
          <a href={link} target="_blank" rel="noopener noreferrer">
            {link}
          </a>
        </p>
      ) : null}
    </div>
  );
}
