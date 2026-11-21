// Every source is converted into this one record shape, so the frontend
// renders Internshala, Arbeitnow, Remotive and the sample data the same way.
//
// { id, title, company, domain, mode, location, skills[], stipend,
//   duration, posted, url, source }

export function clean(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/** Strip HTML tags and decode the handful of entities job feeds use. */
export function stripHtml(html) {
  return clean(
    String(html ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
  );
}

/** Work out Remote / Hybrid / On-site from a free-text location. */
export function detectMode(location, isRemote = false) {
  if (isRemote || /work from home|remote|anywhere/i.test(location)) return "Remote";
  if (/hybrid/i.test(location)) return "Hybrid";
  return "On-site";
}

const DOMAIN_RULES = [
  ["Cyber Security", /secur|cyber|soc\b|penetration|infosec/i],
  ["UI/UX", /\bui\b|\bux\b|design|figma/i],
  ["Data Science", /machine learning|\bml\b|\bai\b|data scien|computer vision|deep learning/i],
  ["Data Analytics", /data|analyt|business intelligence|\bbi\b/i],
  ["Full Stack Development", /develop|engineer|software|frontend|front-end|backend|back-end|full.?stack|web|programm/i],
];

/** Guess a domain from a job title (used for API sources that have no category we can map). */
export function detectDomain(text) {
  for (const [domain, pattern] of DOMAIN_RULES) {
    if (pattern.test(text)) return domain;
  }
  return "Other";
}

/** Matches internship titles in English and German ("Praktikum", "Werkstudent"). */
export const INTERNSHIP_TITLE = /\bintern(ship)?\b|praktik|werkstudent|trainee/i;

/** "3 days ago"-style label from a date. */
export function timeAgo(date, now = Date.now()) {
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}
