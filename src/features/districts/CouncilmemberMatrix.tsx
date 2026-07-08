import { useMemo, useState } from "react";

import type { AffiliationsMatrix } from "../../shared/api/contracts";
import { formatPersonNameForDisplay } from "../../shared/formatPersonName";
import { getCategoryChipStyle } from "../map/projectDetails/ProjectAffiliations";
import {
  HEAT_RAMP,
  bucketForPercent,
  buildMatrixIndex,
  categoriesPresent,
  filterBodies,
} from "./councilmemberMatrixData";

/** Default category so the grid opens focused on Departments rather than all ~86 bodies. */
const DEFAULT_CATEGORY = "Department";

function memberLabel(name: string, districtId: number | null): string {
  const display = formatPersonNameForDisplay(name);
  return districtId != null ? `${display} · D${districtId}` : display;
}

export function CouncilmemberMatrix({
  matrix,
  isLoading = false,
  error = null,
}: {
  matrix: AffiliationsMatrix | null;
  isLoading?: boolean;
  error?: string | null;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>(DEFAULT_CATEGORY);
  // false: members are rows, bodies are columns. true: axes flipped.
  const [transposed, setTransposed] = useState(false);

  const categories = useMemo(() => (matrix ? categoriesPresent(matrix.bodies) : []), [matrix]);

  // Fall back to "All" if the preferred default category isn't present in this dataset.
  const activeCategory = categoryFilter && categories.includes(categoryFilter) ? categoryFilter : "";

  const visibleBodies = useMemo(
    () => (matrix ? filterBodies(matrix.bodies, activeCategory) : []),
    [matrix, activeCategory],
  );

  const index = useMemo(
    () => (matrix ? buildMatrixIndex(matrix.cells, visibleBodies) : null),
    [matrix, visibleBodies],
  );

  if (error) {
    return (
      <p className="status-message error-message" role="status">
        {error}
      </p>
    );
  }

  if (isLoading || !matrix) {
    return (
      <p className="cm-matrix-status" role="status">
        {isLoading ? "Loading councilmember metadata…" : "No councilmember metadata available yet."}
      </p>
    );
  }

  const members = matrix.members;
  const hasRenderableGrid = members.length > 0 && visibleBodies.length > 0 && index != null;

  // Generic axis model so the same render serves both transpose states.
  const rowsAreMembers = !transposed;

  return (
    <div className="cm-matrix">
      <div className="cm-matrix-controls">
        <label className="cm-matrix-control">
          <span className="cm-matrix-control-label">Category</span>
          <select
            className="member-affiliations-cat-filter"
            aria-label="Filter bodies by category"
            value={activeCategory}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="cm-matrix-transpose"
          aria-pressed={transposed}
          onClick={() => setTransposed((current) => !current)}
        >
          <span aria-hidden="true">⇄</span>
          {rowsAreMembers ? "Bodies as rows" : "Members as rows"}
        </button>

        <div className="cm-matrix-legend" aria-hidden="true">
          <span className="cm-matrix-legend-label">Less</span>
          {HEAT_RAMP.slice(1).map((step) => (
            <span
              key={step.background}
              className="cm-matrix-legend-swatch"
              style={{ background: step.background }}
            />
          ))}
          <span className="cm-matrix-legend-label">More</span>
        </div>
      </div>

      {!hasRenderableGrid ? (
        <p className="cm-matrix-status" role="status">
          No bodies to show for this category.
        </p>
      ) : (
        <div className="cm-matrix-scroll" tabIndex={0} role="group" aria-label="Councilmember file breakdown matrix">
          <table className="cm-matrix-table">
            <caption className="sr-only">
              Share of each councilmember&rsquo;s moved council files that reference each body. Percentages
              are normalized within each member. {rowsAreMembers
                ? "Rows are councilmembers, columns are bodies."
                : "Rows are bodies, columns are councilmembers."}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="cm-matrix-corner">
                  {rowsAreMembers ? "Member \\ Body" : "Body \\ Member"}
                </th>
                {rowsAreMembers
                  ? visibleBodies.map((body) => {
                      const chip = getCategoryChipStyle(body.category);
                      return (
                        <th key={body.full_name} scope="col" className="cm-matrix-colhead cm-matrix-body-head">
                          <span
                            className="cm-matrix-cat-dot"
                            style={{ background: chip.color }}
                            aria-hidden="true"
                          />
                          <span className="cm-matrix-head-text">{body.full_name}</span>
                        </th>
                      );
                    })
                  : members.map((member) => (
                      <th key={member.member_id} scope="col" className="cm-matrix-colhead">
                        <span className="cm-matrix-head-text">
                          {memberLabel(member.name, member.district_id)}
                        </span>
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody>
              {rowsAreMembers
                ? members.map((member) => (
                    <tr key={member.member_id}>
                      <th scope="row" className="cm-matrix-rowhead">
                        <span className="cm-matrix-head-text">
                          {memberLabel(member.name, member.district_id)}
                        </span>
                      </th>
                      {visibleBodies.map((body) => (
                        <MatrixCell
                          key={body.full_name}
                          index={index}
                          memberName={member.name}
                          memberId={member.member_id}
                          totalFiles={member.total_files}
                          bodyName={body.full_name}
                        />
                      ))}
                    </tr>
                  ))
                : visibleBodies.map((body) => {
                    const chip = getCategoryChipStyle(body.category);
                    return (
                      <tr key={body.full_name}>
                        <th scope="row" className="cm-matrix-rowhead cm-matrix-body-head">
                          <span
                            className="cm-matrix-cat-dot"
                            style={{ background: chip.color }}
                            aria-hidden="true"
                          />
                          <span className="cm-matrix-head-text">{body.full_name}</span>
                        </th>
                        {members.map((member) => (
                          <MatrixCell
                            key={member.member_id}
                            index={index}
                            memberName={member.name}
                            memberId={member.member_id}
                            totalFiles={member.total_files}
                            bodyName={body.full_name}
                          />
                        ))}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatrixCell({
  index,
  memberName,
  memberId,
  totalFiles,
  bodyName,
}: {
  index: ReturnType<typeof buildMatrixIndex>;
  memberName: string;
  memberId: number;
  totalFiles: number;
  bodyName: string;
}) {
  const cell = index.get(memberId, bodyName);
  const percent = cell?.percent_of_total ?? 0;
  const fileCount = cell?.file_count ?? 0;
  const step = HEAT_RAMP[bucketForPercent(percent, index.maxPercent)];
  const label = `${formatPersonNameForDisplay(memberName)} — ${bodyName}: ${percent}% (${fileCount} of ${totalFiles} files)`;

  return (
    <td
      className="cm-matrix-cell"
      style={{ background: step.background, color: step.color }}
      title={label}
      aria-label={label}
    >
      {percent > 0 ? `${percent}%` : ""}
    </td>
  );
}
