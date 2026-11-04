import type { ResearchSource, VerificationStatus } from "@/lib/schemas";

/* ─────────────────────────────────────────────────────────────────
   Source registry.

   Sources come ONLY from what the web search tool actually returned
   (url_citation annotations and web_search_call sources). The model
   never supplies a URL; it can only refer to an id we assigned.
   ───────────────────────────────────────────────────────────────── */

/** Sites we do not use as evidence: scraping is restricted, or they hold private data. */
export const DISALLOWED_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "spokeo.com",
  "whitepages.com",
  "beenverified.com",
  "truepeoplesearch.com",
  "fastpeoplesearch.com",
  "radaris.com",
  "zillow.com",
  "redfin.com",
  "peoplefinders.com",
  "intelius.com",
  "mylife.com",
];

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Registrable-ish domain for corroboration counting (news.example.com → example.com). */
export function rootDomain(url: string): string {
  const host = hostnameOf(url);
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const twoPartTlds = ["co.uk", "com.au", "co.jp", "org.uk"];
  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTlds.includes(lastTwo)) return parts.slice(-3).join(".");
  return lastTwo;
}

export function isDisallowed(url: string): boolean {
  const host = hostnameOf(url);
  return DISALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref$|ref_src)/i;

export function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return null;
  }
}

function publisherFromHost(host: string): string {
  return host || "Unknown publisher";
}

export interface RawSource {
  url: string;
  title?: string;
  cited: boolean;
}

export class SourceRegistry {
  private byUrl = new Map<string, ResearchSource>();
  private next = 1;
  readonly excluded: string[] = [];

  constructor(
    private readonly prefix = "S",
    seed: ResearchSource[] = [],
  ) {
    for (const s of seed) {
      const key = normalizeUrl(s.url) ?? s.url;
      this.byUrl.set(key, s);
      const n = Number(s.id.replace(/\D/g, ""));
      if (Number.isFinite(n) && n >= this.next) this.next = n + 1;
    }
  }

  /** Adds a source; returns its id, or null if it was invalid or excluded. */
  add(raw: RawSource, retrievedAt: string): string | null {
    const normalized = normalizeUrl(raw.url);
    if (!normalized) return null;
    if (isDisallowed(normalized)) {
      const host = hostnameOf(normalized);
      if (!this.excluded.includes(host)) this.excluded.push(host);
      return null;
    }
    const existing = this.byUrl.get(normalized);
    if (existing) {
      if (raw.cited) existing.cited = true;
      if (raw.title && (existing.title === existing.publisher || !existing.title)) existing.title = raw.title;
      return existing.id;
    }
    const host = hostnameOf(normalized);
    const source: ResearchSource = {
      id: `${this.prefix}${this.next++}`,
      url: normalized,
      title: raw.title?.trim() || host,
      publisher: publisherFromHost(host),
      retrievedAt,
      cited: raw.cited,
    };
    this.byUrl.set(normalized, source);
    return source.id;
  }

  idForUrl(url: string): string | undefined {
    const n = normalizeUrl(url);
    return n ? this.byUrl.get(n)?.id : undefined;
  }

  has(id: string): boolean {
    return this.list().some((s) => s.id === id);
  }

  get(id: string): ResearchSource | undefined {
    return this.list().find((s) => s.id === id);
  }

  list(): ResearchSource[] {
    return [...this.byUrl.values()];
  }
}

/** Keeps only ids that exist in the registry, in order, without duplicates. */
export function validSourceIds(ids: string[], known: { has(id: string): boolean }): string[] {
  const out: string[] = [];
  for (const id of ids) if (known.has(id) && !out.includes(id)) out.push(id);
  return out;
}

/**
 * Status is decided by code from the source links, never by the model.
 * "Corroborated" means two different domains; it still is not proof — Andrew
 * should open the source before relying on a claim.
 */
export function assignStatus(
  sourceIds: string[],
  sources: ResearchSource[],
  conflicting: boolean,
): VerificationStatus {
  const linked = sources.filter((s) => sourceIds.includes(s.id));
  if (linked.length === 0) return "unverified";
  if (conflicting) return "conflicting";
  const domains = new Set(linked.map((s) => rootDomain(s.url)));
  return domains.size >= 2 ? "corroborated" : "single-source";
}
