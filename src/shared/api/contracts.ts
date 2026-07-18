export interface ProjectGeocode {
  latitude: number;
  longitude: number;
  provider?: string;
}

export interface ProjectAddressInfo {
  project_title: string;
  primary_address: string | null;
  addresses: string[];
  places: string[];
  topics: string[];
  segments: string[];
  geocode: ProjectGeocode | null;
}

/** Populated on district list when backend includes full parsed title (same shape as project detail). */
export interface DistrictProjectCard {
  id: string;
  url: string | null;
  title: string;
  summary: string;
  status: string;
  district_id: number;
  last_changed_date: string | null;
  start_date: string | null;
  meeting_date: string | null;
  primary_movers: string[];
  secondary_movers: string[];
  document_count: number;
  primary_address: string | null;
  affiliations?: Array<{ category: string; items: string[] }>;
  address_info?: ProjectAddressInfo | null;
  category: string | null;
}

export interface DistrictProjectsResponse {
  district_id: number;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: DistrictProjectCard[];
}

export interface DistrictListResponse {
  district_ids: number[];
}

/**
 * Council member / district representative from `GET /districts/{district_id}` or each element of
 * `GET /council-members` `items` (same JSON shape).
 */
export interface DistrictProfile {
  id: number;
  district_id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  website: string | null;
  phone_number: string | null;
  about: string | null;
  impact_summary: string | null;
  profile_pic: string | null;
  is_active: string | null;
}

export interface CouncilMembersListResponse {
  items: DistrictProfile[];
}

export interface MemberAffiliationFile {
  project_id: string;
  title: string;
  url: string | null;
  has_geocode: boolean;
  role: string | null;
}

export interface MemberAffiliationRow {
  category: string;
  full_name: string;
  file_count: number;
  percent_of_total: number;
  files: MemberAffiliationFile[];
}

export interface MemberAffiliations {
  member_id: number;
  total_files: number;
  items: MemberAffiliationRow[];
}

/** One active council member row in `GET /council-members/affiliations-matrix`. */
export interface AffiliationsMatrixMember {
  member_id: number;
  name: string;
  district_id: number | null;
  total_files: number;
}

/** One body (column/row) referenced across the matrix, pre-sorted by category then name. */
export interface AffiliationsMatrixBody {
  category: string;
  full_name: string;
}

/** A single non-zero (member, body) intersection. Percent is member-normalized. */
export interface AffiliationsMatrixCell {
  member_id: number;
  full_name: string;
  file_count: number;
  percent_of_total: number;
}

/**
 * `GET /council-members/affiliations-matrix`. `cells` is sparse (only non-zero pairs);
 * `percent_of_total` = `file_count / member.total_files * 100` (rounded to 1 decimal),
 * so a member's cells relate to that member's own file total, not to other members.
 */
export interface AffiliationsMatrix {
  members: AffiliationsMatrixMember[];
  bodies: AffiliationsMatrixBody[];
  cells: AffiliationsMatrixCell[];
}

export interface ProjectMember {
  id: number;
  name: string;
  district_id: number | null;
}

export interface ProjectVote {
  member: ProjectMember | null;
  vote: string | null;
}

export interface ProjectTimelineDocument {
  url: string;
  title: string | null;
  date: string | null;
  /** AI-generated summary of the source file. Absent on older payloads. */
  activity_file_summary?: string | null;
}

export interface ProjectTimelineEntry {
  date: string | null;
  type: string;
  text: string | null;
  documents: ProjectTimelineDocument[];
}

export interface ProjectDetail {
  project: {
    id: string;
    source_council_file_id: string;
    url: string | null;
    title: string;
    summary: string;
    status: string;
    district_id: number | null;
    about: string | null;
    category: string | null;
    start_date: string | null;
    last_changed_date: string | null;
    end_date: string | null;
    meeting_date: string | null;
    meeting_type: string | null;
    vote_action: string | null;
    vote_given: string | null;
    reference_numbers: string | null;
    mover_seconder_comment: string | null;
  };
  movers: {
    primary: ProjectMember[];
    secondary: ProjectMember[];
    other: ProjectMember[];
  };
  votes: ProjectVote[];
  timeline: ProjectTimelineEntry[];
  documents: Array<{
    url: string;
    title: string | null;
    date: string | null;
    source: string;
    /** AI-generated summary of the source file. Absent on older payloads. */
    activity_file_summary?: string | null;
  }>;
  affiliations: Array<{
    category: string;
    items: string[];
  }>;
  address_info: ProjectAddressInfo | null;
}
