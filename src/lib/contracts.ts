export interface DistrictProjectCard {
  id: string;
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
}

export interface DistrictProjectsResponse {
  district_id: number;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: DistrictProjectCard[];
}
