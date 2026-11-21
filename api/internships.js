// GET /api/internships
// Vercel serverless function: fetches live internships from every source in
// parallel and returns them as one list. One failing source doesn't fail the
// response; its error is reported in `sources` instead.
import { fetchInternshala } from "../lib/sources/internshala.js";
import { fetchArbeitnow } from "../lib/sources/arbeitnow.js";
import { fetchRemotive } from "../lib/sources/remotive.js";

const SOURCES = [
  { name: "Internshala", url: "https://internshala.com", fetch: fetchInternshala },
  { name: "Arbeitnow", url: "https://www.arbeitnow.com", fetch: fetchArbeitnow },
  { name: "Remotive", url: "https://remotive.com", fetch: fetchRemotive },
];

// Vercel's CDN serves a cached copy for 6 hours, then refreshes in the
// background. Every source is hit at most a few times a day however many
// people visit, which respects Remotive's "max 4 calls a day" rule and keeps
// the load on Internshala tiny.
const CACHE = "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400";

export async function collectInternships() {
  const results = await Promise.allSettled(SOURCES.map((s) => s.fetch()));

  const sources = SOURCES.map(({ name, url }, i) => {
    const r = results[i];
    return r.status === "fulfilled"
      ? { name, url, ok: true, count: r.value.length }
      : { name, url, ok: false, count: 0, error: String(r.reason?.message ?? r.reason) };
  });

  const internships = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { fetchedAt: new Date().toISOString(), sources, internships };
}

export default async function handler(req, res) {
  // Public, read-only data: allow the Render-hosted copy of the page to call this.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const body = await collectInternships();
  const anyOk = body.sources.some((s) => s.ok);

  // If every source failed, don't let the CDN cache the failure for 6 hours.
  res.setHeader("Cache-Control", anyOk ? CACHE : "no-store");
  res.statusCode = anyOk ? 200 : 502;
  res.end(JSON.stringify(body));
}
