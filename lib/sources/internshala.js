import * as cheerio from "cheerio";
import { fetchText } from "../http.js";
import { clean, detectMode } from "../normalize.js";

const BASE = "https://internshala.com";

// Only plain category pages are fetched. Internshala's robots.txt allows these;
// it disallows /internship/search/, /internship/details/ and any URL with a "?",
// none of which we request.
export const CATEGORIES = [
  { slug: "web-development-internship", domain: "Full Stack Development" },
  { slug: "ui-ux-design-internship", domain: "UI/UX" },
  { slug: "data-analytics-internship", domain: "Data Analytics" },
  { slug: "data-science-internship", domain: "Data Science" },
  { slug: "cyber-security-internship", domain: "Cyber Security" },
];

/** Parse one Internshala category page into normalized records. Pure function, easy to test. */
export function parseInternshala(html, domain) {
  const $ = cheerio.load(html);
  const records = [];

  $(".individual_internship[internshipid]").each((_, el) => {
    const card = $(el);
    const link = card.find("a.job-title-href").first();
    const title = clean(link.text());
    const href = link.attr("href") || card.attr("data-href");
    if (!title || !href) return;

    const rawLocation = clean(card.find(".locations").first().text());
    const location = clean(rawLocation.replace(/\(hybrid\)/gi, "")) || "India";
    const duration = clean(
      card.find(".row-1-item").filter((_, item) => $(item).find(".ic-16-calendar").length > 0).first().text()
    );

    records.push({
      id: `internshala-${card.attr("internshipid")}`,
      title,
      company: clean(card.find(".company-name").first().text()),
      domain,
      mode: detectMode(rawLocation),
      location,
      skills: card.find(".job_skill").map((_, s) => clean($(s).text())).get().filter(Boolean),
      stipend: clean(card.find(".stipend").first().text()),
      duration,
      posted: clean(card.find(".detail-row-2 .color-labels span").first().text()),
      url: new URL(href, BASE).href,
      source: "Internshala",
    });
  });

  return records;
}

export async function fetchInternshala() {
  const pages = await Promise.allSettled(
    CATEGORIES.map(async ({ slug, domain }) =>
      parseInternshala(await fetchText(`${BASE}/internships/${slug}/`), domain)
    )
  );

  const ok = pages.filter((p) => p.status === "fulfilled");
  if (ok.length === 0) throw pages[0].reason;

  // The same internship can be listed under several categories; keep the first.
  const seen = new Set();
  return ok.flatMap((p) => p.value).filter((r) => !seen.has(r.id) && seen.add(r.id));
}
