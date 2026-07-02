import { Fragment, useMemo, useState } from "react";

import type { MemberAffiliationRow, MemberAffiliations } from "../../shared/api/contracts";
import { formatProjectTitleForDisplay } from "../../shared/formatProjectTitleForDisplay";
import { AFFILIATION_CATEGORY_ORDER, getCategoryChipStyle } from "../map/projectDetails/ProjectAffiliations";

type SortKey = "body" | "category" | "files" | "percent";
type SortDir = "asc" | "desc";

function categoryRank(category: string): number {
  const index = AFFILIATION_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? AFFILIATION_CATEGORY_ORDER.length : index;
}

function compareRows(a: MemberAffiliationRow, b: MemberAffiliationRow, key: SortKey): number {
  switch (key) {
    case "body":
      return a.full_name.localeCompare(b.full_name);
    case "category": {
      const rank = categoryRank(a.category) - categoryRank(b.category);
      if (rank !== 0) return rank;
      // Within a category, keep the busier bodies first.
      if (b.file_count !== a.file_count) return b.file_count - a.file_count;
      return a.full_name.localeCompare(b.full_name);
    }
    case "files":
      if (a.file_count !== b.file_count) return a.file_count - b.file_count;
      return a.full_name.localeCompare(b.full_name);
    case "percent":
      if (a.percent_of_total !== b.percent_of_total) return a.percent_of_total - b.percent_of_total;
      return a.full_name.localeCompare(b.full_name);
  }
}

export function MemberAffiliationsTable({
  affiliations,
  onViewOnMap,
}: {
  affiliations: MemberAffiliations;
  onViewOnMap?: (projectId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Default mirrors the backend order: canonical category, busiest first.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "category", dir: "asc" });
  const [categoryFilter, setCategoryFilter] = useState("");

  const categoriesPresent = useMemo(() => {
    const present = new Set(affiliations.items.map((item) => item.category));
    const ordered = AFFILIATION_CATEGORY_ORDER.filter((category) => present.has(category));
    const extras = [...present].filter((category) => !AFFILIATION_CATEGORY_ORDER.includes(category)).sort();
    return [...ordered, ...extras];
  }, [affiliations.items]);

  const visibleItems = useMemo(() => {
    const items = affiliations.items.filter((item) => !categoryFilter || item.category === categoryFilter);
    items.sort((a, b) => {
      const result = compareRows(a, b, sort.key);
      return sort.dir === "asc" ? result : -result;
    });
    return items;
  }, [affiliations.items, sort, categoryFilter]);

  if (affiliations.items.length === 0) {
    return null;
  }

  const toggle = (fullName: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });

  const onSort = (key: SortKey) =>
    setSort((current) => {
      if (current.key === key) {
        return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      }
      // Text columns default ascending; numeric columns default descending.
      return { key, dir: key === "files" || key === "percent" ? "desc" : "asc" };
    });

  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <button type="button" className="member-affiliations-sort" onClick={() => onSort(sortKey)}>
      {label}
      <span className="member-affiliations-sort-arrow" aria-hidden="true">
        {sort.key === sortKey ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );

  return (
    <div className="member-affiliations-scroll">
      <table className="member-affiliations-table">
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort("body")}>
              <SortHeader label="Body" sortKey="body" />
            </th>
            <th scope="col">
              <select
                className="member-affiliations-cat-filter"
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {categoriesPresent.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </th>
            <th scope="col" className="member-affiliations-num" aria-sort={ariaSort("files")}>
              <SortHeader label="Files" sortKey="files" />
            </th>
            <th scope="col" className="member-affiliations-num" aria-sort={ariaSort("percent")}>
              <SortHeader label="% of files" sortKey="percent" />
            </th>
            <th scope="col" className="member-affiliations-num">
              <span className="sr-only">Toggle files</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((row) => {
            const isOpen = expanded.has(row.full_name);
            const style = getCategoryChipStyle(row.category);
            return (
              <Fragment key={row.full_name}>
                <tr
                  className={`member-affiliations-body-row${isOpen ? " is-open" : ""}`}
                  onClick={() => toggle(row.full_name)}
                >
                  <td>{row.full_name}</td>
                  <td>
                    <span
                      className="member-affiliations-chip"
                      style={{ background: style.background, border: `1px solid ${style.border}`, color: style.color }}
                    >
                      {row.category}
                    </span>
                  </td>
                  <td className="member-affiliations-num">{row.file_count}</td>
                  <td className="member-affiliations-num">{row.percent_of_total}%</td>
                  <td className="member-affiliations-num">
                    <button
                      type="button"
                      className="member-affiliations-toggle"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Hide" : "View"} council files for ${row.full_name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(row.full_name);
                      }}
                    >
                      {isOpen ? "Hide Council Files" : "View Council Files"}
                    </button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="member-affiliations-files-row">
                    <td colSpan={5}>
                      <ul className="member-affiliations-files">
                        {row.files.map((file) => {
                          const label = `${file.project_id} — ${formatProjectTitleForDisplay(file.title)}`;
                          const roleLabel = file.role
                            ? `${file.role.charAt(0).toUpperCase()}${file.role.slice(1)}`
                            : null;
                          return (
                            <li key={file.project_id}>
                              {file.url ? (
                                <a href={file.url} target="_blank" rel="noopener noreferrer">
                                  {label}
                                </a>
                              ) : (
                                <span>{label}</span>
                              )}
                              {roleLabel ? (
                                <span className="member-affiliations-role">({roleLabel})</span>
                              ) : null}
                              {file.has_geocode && onViewOnMap ? (
                                <button
                                  type="button"
                                  className="member-affiliations-view-map"
                                  onClick={() => onViewOnMap(file.project_id)}
                                >
                                  View on Map
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
