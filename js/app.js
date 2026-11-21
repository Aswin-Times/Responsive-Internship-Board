"use strict";

const DATA_URL = "data/internships.json";
const ALL_DOMAINS = "all";

const els = {
  form: document.getElementById("filter-form"),
  search: document.getElementById("search"),
  domainOptions: document.getElementById("domain-options"),
  results: document.getElementById("results"),
  count: document.getElementById("result-count"),
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  errorMessage: document.getElementById("error-message"),
  retry: document.getElementById("retry-btn"),
  empty: document.getElementById("empty-state"),
  emptyReset: document.getElementById("empty-reset-btn"),
};

const state = {
  internships: [],
  query: "",
  domain: ALL_DOMAINS,
};

/* ---------- Rendering ---------- */

/** Build one internship card. Uses textContent everywhere so data can't inject HTML. */
function createCard(internship) {
  const li = document.createElement("li");
  li.className = "card";

  const article = document.createElement("article");
  article.setAttribute("aria-labelledby", `title-${internship.id}`);

  const domain = document.createElement("p");
  domain.className = "card-domain";
  domain.textContent = internship.domain;

  const title = document.createElement("h3");
  title.className = "card-title";
  title.id = `title-${internship.id}`;
  title.textContent = internship.title;

  const meta = document.createElement("dl");
  meta.className = "card-meta";
  [
    ["Mode", internship.mode],
    ["Location", internship.location],
    ["Openings", String(internship.openings)],
  ].forEach(([label, value]) => {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrap.append(dt, dd);
    meta.append(wrap);
  });

  const skills = document.createElement("ul");
  skills.className = "card-skills";
  skills.setAttribute("aria-label", "Skills");
  internship.skills.forEach((skill) => {
    const tag = document.createElement("li");
    tag.textContent = skill;
    skills.append(tag);
  });

  article.append(domain, title, meta, skills);
  li.append(article);
  return li;
}

/** Radio buttons ("chips") for every domain in the data, plus "All". */
function renderDomainOptions(internships) {
  const domains = [...new Set(internships.map((i) => i.domain))].sort();
  const options = [ALL_DOMAINS, ...domains].map((domain, index) => {
    const id = `domain-${index}`;
    const wrap = document.createElement("div");
    wrap.className = "chip";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "domain";
    input.id = id;
    input.value = domain;
    input.checked = domain === state.domain;

    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = domain === ALL_DOMAINS ? "All domains" : domain;

    wrap.append(input, label);
    return wrap;
  });
  els.domainOptions.replaceChildren(...options);
}

function showOnly(view) {
  els.loading.hidden = view !== "loading";
  els.error.hidden = view !== "error";
  els.empty.hidden = view !== "empty";
  els.results.hidden = view !== "results";
  // Filters are useless until data has loaded.
  const disabled = view === "loading" || view === "error";
  els.form.querySelectorAll("input, button").forEach((el) => { el.disabled = disabled; });
}

/* ---------- Filtering ---------- */

function matchesQuery(internship, query) {
  if (!query) return true;
  const haystack = [
    internship.title,
    internship.domain,
    internship.mode,
    internship.location,
    ...internship.skills,
  ].join(" ").toLowerCase();
  // Every word typed must appear somewhere, so "remote sql" narrows results.
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

function getFiltered() {
  const query = state.query.trim().toLowerCase();
  return state.internships.filter(
    (i) =>
      (state.domain === ALL_DOMAINS || i.domain === state.domain) &&
      matchesQuery(i, query)
  );
}

function update() {
  const filtered = getFiltered();
  const total = state.internships.length;
  els.count.textContent = `Showing ${filtered.length} of ${total} internship${total === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    els.results.replaceChildren();
    showOnly("empty");
    return;
  }
  els.results.replaceChildren(...filtered.map(createCard));
  showOnly("results");
}

function resetFilters() {
  els.form.reset();
}

/* ---------- Data loading ---------- */

function isValidRecord(r) {
  return (
    r && typeof r.id === "string" && typeof r.title === "string" &&
    typeof r.domain === "string" && Array.isArray(r.skills)
  );
}

async function loadInternships() {
  // Reviewers can append ?simulate=error to the URL to see the error state.
  const params = new URLSearchParams(location.search);
  const url = params.get("simulate") === "error" ? "data/does-not-exist.json" : DATA_URL;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Server responded with ${response.status}.`);
  const json = await response.json();
  if (!Array.isArray(json.internships)) throw new Error("The data file is not in the expected format.");
  return json.internships.filter(isValidRecord);
}

async function init() {
  showOnly("loading");
  els.count.textContent = "";
  try {
    state.internships = await loadInternships();
    renderDomainOptions(state.internships);
    update();
  } catch (err) {
    console.error(err);
    els.errorMessage.textContent = `${err.message} Please check your connection and try again.`;
    showOnly("error");
  }
}

/* ---------- Events ---------- */

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  update();
});

els.domainOptions.addEventListener("change", (e) => {
  if (e.target.name === "domain") {
    state.domain = e.target.value;
    update();
  }
});

// Stop Enter in the search box from reloading the page.
els.form.addEventListener("submit", (e) => e.preventDefault());

els.form.addEventListener("reset", () => {
  // The form resets inputs after this event, so sync state on the next tick.
  setTimeout(() => {
    state.query = "";
    state.domain = ALL_DOMAINS;
    const allRadio = els.domainOptions.querySelector(`input[value="${ALL_DOMAINS}"]`);
    if (allRadio) allRadio.checked = true;
    update();
    els.search.focus();
  });
});

els.emptyReset.addEventListener("click", resetFilters);
els.retry.addEventListener("click", init);

init();
