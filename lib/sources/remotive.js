import { fetchJson } from "../http.js";
import { INTERNSHIP_TITLE, clean, detectDomain, timeAgo } from "../normalize.js";

// Free public API, no key. Terms: credit Remotive, link back to the Remotive URL,
// and fetch at most ~4 times a day. The API response is CDN-cached for 6 hours
// (see api/internships.js), which keeps us within that limit.
const URL_ = "https://remotive.com/api/remote-jobs?search=intern";

export function parseRemotive(json, now = Date.now()) {
  return (json.jobs ?? [])
    // Remotive's search is fuzzy, so keep only real internship titles.
    .filter((job) => INTERNSHIP_TITLE.test(job.title))
    .map((job) => ({
      id: `remotive-${job.id}`,
      title: clean(job.title),
      company: clean(job.company_name),
      domain: detectDomain(`${job.title} ${job.category}`),
      mode: "Remote",
      location: clean(job.candidate_required_location) || "Worldwide",
      skills: (job.tags ?? []).slice(0, 5).map(clean),
      stipend: clean(job.salary),
      duration: "",
      posted: job.publication_date ? timeAgo(new Date(job.publication_date), now) : "",
      url: job.url,
      source: "Remotive",
    }));
}

export async function fetchRemotive() {
  return parseRemotive(await fetchJson(URL_));
}
