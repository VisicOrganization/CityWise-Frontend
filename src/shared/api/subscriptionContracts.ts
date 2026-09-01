export type ScrapeMode = "link_only" | "manual" | "auto";

export type ScrapeStatus =
  | "none"
  | "queued"
  | "ready"
  | "failed"
  | "skipped_quota"
  | "link_only";

export interface SubscriptionEntitlements {
  max_districts: number;
  scrape_mode: ScrapeMode | string;
  scrape_quota_monthly: number | null;
  scrapes_used: number;
  scrapes_remaining: number | null;
  plan_sku: string | null;
  is_unlimited: boolean;
}

export interface SubscriptionMe {
  id: number;
  email: string;
  district_ids: number[];
  entitlements: SubscriptionEntitlements;
}

export interface DistrictsUpdateRequest {
  district_ids: number[];
}

export interface NewFileItem {
  cf_id: string;
  title: string | null;
  district_id: number | null;
  source_url: string | null;
  scrape_status: ScrapeStatus | string;
  first_seen_at: string;
  created_at: string;
  notified_at: string | null;
}

export interface NewFilesResponse {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: NewFileItem[];
}

export interface ManualScrapeResponse {
  ok: boolean;
  reason: string;
  job_id: number | null;
  scrape_status: string | null;
  entitlements: SubscriptionEntitlements | null;
}

export interface SubscriptionPlan {
  sku: string;
  name: string;
  max_districts: number;
  scrape_mode: ScrapeMode | string;
  scrape_quota_monthly: number | null;
  description: string;
}

export interface AssignPlanRequest {
  sku: string;
}

/** Public Auth0 SPA settings from GET /subscriptions/auth/config (no secrets). */
export interface SubscriptionAuthConfig {
  provider: string;
  domain: string | null;
  audience: string | null;
  client_id: string | null;
  configured: boolean;
}

export interface NewFilesQuery {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface DashboardItem {
  cf_id: string;
  title: string | null;
  district_id: number | null;
  source_url: string | null;
  scrape_status: ScrapeStatus | string;
  in_citywise: boolean;
}

export interface DashboardResponse {
  district_id: number;
  subscribed_district_ids: number[];
  existing_in_citywise: number;
  total_discovered: number;
  new_unscraped: number;
  items: DashboardItem[];
}
