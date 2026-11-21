import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseInternshala } from "../lib/sources/internshala.js";
import { parseArbeitnow } from "../lib/sources/arbeitnow.js";
import { parseRemotive } from "../lib/sources/remotive.js";
import { detectDomain, detectMode, timeAgo } from "../lib/normalize.js";

const fixture = readFileSync(new URL("./fixtures/internshala-category.html", import.meta.url), "utf8");

test("parseInternshala extracts normalized records and skips malformed cards", () => {
  const records = parseInternshala(fixture, "Full Stack Development");
  assert.equal(records.length, 2);

  assert.deepEqual(records[0], {
    id: "internshala-1001",
    title: "Web Development",
    company: "Acme Labs",
    domain: "Full Stack Development",
    mode: "Remote",
    location: "Work from home",
    skills: ["HTML", "CSS"],
    stipend: "₹ 5,000 - 7,000 /month",
    duration: "4 Months",
    posted: "Today",
    url: "https://internshala.com/internship/detail/web-development-internship-at-acme1001",
    source: "Internshala",
  });

  assert.equal(records[1].mode, "Hybrid");
  assert.equal(records[1].location, "Pune, Nashik");
  assert.deepEqual(records[1].skills, []);
});

test("parseArbeitnow keeps only internship titles", () => {
  const now = Date.parse("2026-11-21T00:00:00Z");
  const records = parseArbeitnow(
    {
      data: [
        { slug: "a", title: "Software Engineer Intern", company_name: "X", location: "Berlin", remote: false, tags: ["Development"], job_types: [], url: "https://www.arbeitnow.com/jobs/a", created_at: now / 1000 - 86400 * 2 },
        { slug: "b", title: "Senior Backend Engineer", company_name: "Y", location: "Munich", remote: true, tags: [], job_types: [], url: "https://www.arbeitnow.com/jobs/b", created_at: now / 1000 },
        { slug: "c", title: "Pflichtpraktikum Marketing", company_name: "Z", location: "Hamburg", remote: true, tags: [], job_types: [], url: "https://www.arbeitnow.com/jobs/c", created_at: now / 1000 },
      ],
    },
    now
  );
  assert.deepEqual(records.map((r) => r.id), ["arbeitnow-a", "arbeitnow-c"]);
  assert.equal(records[0].domain, "Full Stack Development");
  assert.equal(records[0].posted, "2 days ago");
  assert.equal(records[1].mode, "Remote");
});

test("parseRemotive filters fuzzy search results down to internships", () => {
  const records = parseRemotive({
    jobs: [
      { id: 1, title: "Data Analyst Intern", company_name: "A", category: "Data", tags: ["sql"], candidate_required_location: "Europe", salary: "", url: "https://remotive.com/1", publication_date: "2026-11-20T10:00:00" },
      { id: 2, title: "Customer Service Representative", company_name: "B", category: "Support", tags: [], url: "https://remotive.com/2" },
    ],
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].domain, "Data Analytics");
  assert.equal(records[0].mode, "Remote");
  assert.equal(records[0].source, "Remotive");
});

test("normalize helpers", () => {
  assert.equal(detectMode("Work from home"), "Remote");
  assert.equal(detectMode("Gurgaon (Hybrid)"), "Hybrid");
  assert.equal(detectMode("Pune"), "On-site");
  assert.equal(detectDomain("UI/UX Design Intern"), "UI/UX");
  assert.equal(detectDomain("Machine Learning Engineer Intern"), "Data Science");
  assert.equal(detectDomain("Security Operations Intern"), "Cyber Security");
  assert.equal(detectDomain("HR Internship"), "Other");
  const now = Date.parse("2026-11-21T00:00:00Z");
  assert.equal(timeAgo(new Date(now - 3 * 86400000), now), "3 days ago");
  assert.equal(timeAgo(new Date(now - 14 * 86400000), now), "2 weeks ago");
});
