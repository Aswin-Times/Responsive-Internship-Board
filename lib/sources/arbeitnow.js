import { fetchJson } from "../http.js";
import { INTERNSHIP_TITLE, clean, detectDomain, detectMode, timeAgo } from "../normalize.js";

// Free public API, no key. Terms: "please do not abuse" and link back to Arbeitnow.
const URL_ = "https://www.arbeitnow.com/api/job-board-api";

export function parseArbeitnow(json, now = Date.now()) {
  return (json.data ?? [])
    .filter((job) => INTERNSHIP_TITLE.test(`${job.title} ${(job.job_types ?? []).join(" ")}`))
    .map((job) => ({
      id: `arbeitnow-${job.slug}`,
      title: clean(job.title),
      company: clean(job.company_name),
      domain: detectDomain(`${job.title} ${(job.tags ?? []).join(" ")}`),
      mode: detectMode(job.location, job.remote === true),
      location: clean(job.location) || "Not specified",
      skills: (job.tags ?? []).slice(0, 5).map(clean),
      stipend: "",
      duration: "",
      posted: job.created_at ? timeAgo(new Date(job.created_at * 1000), now) : "",
      url: job.url,
      source: "Arbeitnow",
    }));
}

export async function fetchArbeitnow() {
  return parseArbeitnow(await fetchJson(URL_));
}
