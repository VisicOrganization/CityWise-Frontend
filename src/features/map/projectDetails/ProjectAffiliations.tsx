import type { ProjectDetail } from "../../../shared/api/contracts";

type Affiliations = ProjectDetail["affiliations"];

interface ChipStyle {
  background: string;
  border: string;
  color: string;
}

/** Color-coded per report_acronyms category so each group reads apart at a glance. */
const CATEGORY_STYLES: Record<string, ChipStyle> = {
  Committee: { background: "#e0edff", border: "#b6d4fe", color: "#1e40af" },
  Department: { background: "#dcfce7", border: "#bbf7d0", color: "#166534" },
  Bureau: { background: "#cffafe", border: "#a5f3fc", color: "#0e7490" },
  Board: { background: "#ede9fe", border: "#ddd6fe", color: "#6d28d9" },
  "Agency / Office": { background: "#fef3c7", border: "#fde68a", color: "#92400e" },
  People: { background: "#ffe4e6", border: "#fecdd3", color: "#9f1239" },
  Other: { background: "#f3f4f6", border: "#e5e7eb", color: "#374151" },
};

const DEFAULT_STYLE: ChipStyle = CATEGORY_STYLES.Other;

/** Canonical display order for acronym categories (matches the chip color map). */
export const AFFILIATION_CATEGORY_ORDER: string[] = Object.keys(CATEGORY_STYLES);

/** Color styling for a category, with a neutral fallback for unknown categories. */
export function getCategoryChipStyle(category: string): { background: string; border: string; color: string } {
  return CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
}

/** Plural forms for categories that don't pluralize by simply appending "s". */
const PLURAL_OVERRIDES: Record<string, string> = {
  People: "People",
  "Agency / Office": "Agencies / Offices",
};

function pluralizeCategory(category: string, count: number): string {
  if (count <= 1) return category;
  return PLURAL_OVERRIDES[category] ?? `${category}s`;
}

export type AffiliationDensity = "compact" | "comfortable";

interface DensitySpec {
  gap: number;
  chipPadding: string;
  chipFontSize: number;
  labelMargin: number;
  labelFontSize: number;
  labelPadding: string;
}

const DENSITY_SPECS: Record<AffiliationDensity, DensitySpec> = {
  compact: { gap: 6, chipPadding: "3px 10px", chipFontSize: 12, labelMargin: 6, labelFontSize: 11, labelPadding: "0" },
  comfortable: { gap: 10, chipPadding: "8px 16px", chipFontSize: 13, labelMargin: 8, labelFontSize: 12, labelPadding: "4px 0" },
};

export function hasAnyAffiliations(affiliations: Affiliations | undefined | null): boolean {
  // Guard against older cached payloads (localStorage) that predate this field.
  return Array.isArray(affiliations) && affiliations.some((group) => group.items.length > 0);
}

/**
 * Sort affiliation groups into the canonical `AFFILIATION_CATEGORY_ORDER`, with any unknown/extra
 * categories appended alphabetically after. Mirrors the `orderedCats`/`extras` logic already used
 * in `CityMap.tsx` (`availableBodyGroups`) and `MemberAffiliationsTable.tsx` (`categoriesPresent`).
 */
function sortAffiliationGroups(affiliations: Affiliations): Affiliations {
  const byCategory = new Map(affiliations.map((group) => [group.category, group]));
  const orderedCats = AFFILIATION_CATEGORY_ORDER.filter((category) => byCategory.has(category));
  const extras = affiliations
    .map((group) => group.category)
    .filter((category) => !AFFILIATION_CATEGORY_ORDER.includes(category))
    .sort();
  return [...orderedCats, ...extras].map((category) => byCategory.get(category)!);
}

function ChipGroup({
  label,
  style,
  names,
  spec,
}: {
  label: string;
  style: ChipStyle;
  names: string[];
  spec: DensitySpec;
}) {
  if (names.length === 0) return null;
  return (
    <div>
      <h4
        style={{
          fontSize: spec.labelFontSize,
          color: "#6b7280",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          margin: 0,
          padding: spec.labelPadding,
        }}
      >
        {label}
      </h4>
      <ul
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spec.gap,
          marginTop: spec.labelMargin,
          listStyle: "none",
          padding: 0,
        }}
      >
        {names.map((name) => (
          <li
            key={name}
            style={{
              fontSize: spec.chipFontSize,
              fontWeight: 500,
              color: style.color,
              background: style.background,
              border: `1px solid ${style.border}`,
              borderRadius: 10,
              padding: spec.chipPadding,
              maxWidth: "100%",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              lineHeight: 1.3,
            }}
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Colored chip groups for a project's affiliations, grouped by category. */
export function ProjectAffiliationChips({
  affiliations,
  density = "compact",
}: {
  affiliations: Affiliations | undefined | null;
  density?: AffiliationDensity;
}) {
  if (!hasAnyAffiliations(affiliations)) return null;
  const spec = DENSITY_SPECS[density];
  const orderedGroups = sortAffiliationGroups(affiliations!).filter((group) => group.items.length > 0);
  return (
    <div className="project-affiliation-groups">
      {orderedGroups.map((group) => (
        <div className="project-affiliation-group" key={group.category}>
          <ChipGroup
            label={pluralizeCategory(group.category, group.items.length)}
            style={CATEGORY_STYLES[group.category] ?? DEFAULT_STYLE}
            names={group.items}
            spec={spec}
          />
        </div>
      ))}
    </div>
  );
}
