"use strict";

/* ---------- Config ---------- */

const PRODUCTION_API = "https://responsive-internship-board.vercel.app/api/internships";
const SAMPLE_URL = "data/internships.json";
const PAGE_SIZE = 24;
const ALL = "all";

// On Vercel (and the local dev server) the API sits next to the page. Any other
// host, e.g. the Render static copy, calls the Vercel API instead (CORS is open).
const API_URL =
  /\.vercel\.app$/.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? "/api/internships"
    : PRODUCTION_API;

const els = {
  form: document.getElementById("filter-form"),
  search: document.getElementById("search"),
  domainOptions: document.getElementById("domain-options"),
  sourceOptions: document.getElementById("source-options"),
  results: document.getElementById("results"),
  count: document.getElementById("result-count"),
  dataStatus: document.getElementById("data-status"),
  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-state"),
  errorMessage: document.getElementById("error-message"),
  retry: document.getElementById("retry-btn"),
  empty: document.getElementById("empty-state"),
  emptyReset: document.getElementById("empty-reset-btn"),
  loadMore: document.getElementById("load-more-btn"),
};

const state = {
  internships: [],
  query: "",
  domain: ALL,
  source: ALL,
  visible: PAGE_SIZE,
};

/* ---------- Rendering ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Build one internship card. textContent everywhere: scraped text can't inject HTML. */
function createCard(internship) {
  const li = el("li", "card");
  // Roving tabindex: only one card is in the Tab order; arrow keys move between cards.
  li.tabIndex = -1;
  li.setAttribute("aria-labelledby", `title-${internship.id}`);
  li.setAttribute("aria-describedby", `meta-${internship.id}`);

  const article = el("article");

  const top = el("div", "card-top");
  top.append(el("p", "card-domain", internship.domain));
  if (internship.source) {
    top.append(el("span", `card-source source-${internship.source.toLowerCase()}`, internship.source));
  }

  const title = el("h3", "card-title", internship.title);
  title.id = `title-${internship.id}`;

  const company = internship.company ? el("p", "card-company", internship.company) : null;

  const meta = el("dl", "card-meta");
  meta.id = `meta-${internship.id}`;
  [
    ["Mode", internship.mode],
    ["Location", internship.location],
    ["Stipend", internship.stipend],
    ["Duration", internship.duration],
    ["Openings", internship.openings != null ? String(internship.openings) : ""],
  ].forEach(([label, value]) => {
    if (!value) return;
    const wrap = el("div");
    wrap.append(el("dt", "", label), el("dd", "", value));
    meta.append(wrap);
  });

  const skills = el("ul", "card-skills");
  skills.setAttribute("aria-label", "Skills");
  (internship.skills || []).forEach((skill) => skills.append(el("li", "", skill)));

  const footer = el("div", "card-footer");
  if (internship.posted) footer.append(el("span", "card-posted", `Posted ${internship.posted.toLowerCase()}`));
  if (internship.url) {
    const link = el("a", "card-link", `View on ${internship.source}`);
    link.href = internship.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute(
      "aria-label",
      `View ${internship.title}${internship.company ? ` at ${internship.company}` : ""} on ${internship.source} (opens in a new tab)`
    );
    footer.append(link);
  }

  article.append(top, title);
  if (company) article.append(company);
  article.append(meta);
  if (skills.children.length) article.append(skills);
  if (footer.children.length) article.append(footer);
  li.append(article);
  return li;
}

/** Radio "chips" for one filter group, generated from the values in the data. */
function renderChips(container, name, values, allLabel, current) {
  const options = [ALL, ...values].map((value, index) => {
    const id = `${name}-${index}`;
    const wrap = el("div", "chip");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.id = id;
    input.value = value;
    input.checked = value === current;
    const label = el("label", "", value === ALL ? allLabel : value);
    label.htmlFor = id;
    wrap.append(input, label);
    return wrap;
  });
  container.replaceChildren(...options);
}

function uniqueSorted(key) {
  const values = [...new Set(state.internships.map((i) => i[key]).filter(Boolean))].sort();
  // Keep the catch-all bucket last.
  return values.includes("Other") ? [...values.filter((v) => v !== "Other"), "Other"] : values;
}

function renderFilters() {
  renderChips(els.domainOptions, "domain", uniqueSorted("domain"), "All domains", state.domain);
  renderChips(els.sourceOptions, "source", uniqueSorted("source"), "All sources", state.source);
}

function showOnly(view) {
  els.loading.hidden = view !== "loading";
  els.error.hidden = view !== "error";
  els.empty.hidden = view !== "empty";
  els.results.hidden = view !== "results";
  if (view !== "results") els.loadMore.hidden = true;
  // Filters are useless until data has loaded.
  const disabled = view === "loading" || view === "error";
  els.form.querySelectorAll("input, button").forEach((node) => { node.disabled = disabled; });
}

function minutesAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** Tell people whether they're looking at live data, partial data or the sample fallback. */
function renderDataStatus(info) {
  els.dataStatus.hidden = false;
  els.dataStatus.className = `data-status ${info.live ? "is-live" : "is-sample"}`;

  if (!info.live) {
    els.dataStatus.textContent =
      "Live sources are unavailable right now, so you’re seeing fictional sample listings.";
    return;
  }

  const parts = info.sources.map((s) => (s.ok ? `${s.name} (${s.count})` : `${s.name} (unavailable)`));
  els.dataStatus.textContent = `Live listings from ${parts.join(", ")}. Updated ${minutesAgo(info.fetchedAt)}.`;
}

/* ---------- Filtering ---------- */

function matchesQuery(internship, query) {
  if (!query) return true;
  const haystack = [
    internship.title,
    internship.company,
    internship.domain,
    internship.mode,
    internship.location,
    internship.source,
    ...(internship.skills || []),
  ].join(" ").toLowerCase();
  // Every word typed must appear somewhere, so "remote react" narrows results.
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

function getFiltered() {
  const query = state.query.trim().toLowerCase();
  return state.internships.filter(
    (i) =>
      (state.domain === ALL || i.domain === state.domain) &&
      (state.source === ALL || i.source === state.source) &&
      matchesQuery(i, query)
  );
}

/** Re-render the list. `focusIndex` moves focus to that card (used by "Show more"). */
function update({ focusIndex } = {}) {
  const filtered = getFiltered();
  const total = state.internships.length;
  const shown = Math.min(state.visible, filtered.length);
  els.count.textContent =
    filtered.length === 0
      ? `0 of ${total} internships`
      : `Showing ${shown} of ${filtered.length}${filtered.length === total ? "" : ` matching (${total} total)`}`;

  if (filtered.length === 0) {
    els.results.replaceChildren();
    showOnly("empty");
    return;
  }

  els.results.replaceChildren(...filtered.slice(0, shown).map(createCard));
  showOnly("results");

  const target = els.results.children[focusIndex ?? 0];
  target.tabIndex = 0;
  if (focusIndex !== undefined) target.focus();

  const remaining = filtered.length - shown;
  els.loadMore.hidden = remaining <= 0;
  els.loadMore.textContent = `Show ${Math.min(PAGE_SIZE, remaining)} more internships`;
}

/** Any filter change starts again from the first page. */
function applyFilters() {
  state.visible = PAGE_SIZE;
  update();
}

/* ---------- Keyboard navigation ---------- */

function columnCount() {
  return getComputedStyle(els.results).gridTemplateColumns.split(" ").length;
}

/** Arrow keys / Home / End move between cards; Enter opens the card's posting. */
function onCardKeydown(e) {
  const cards = [...els.results.children];
  const current = cards.indexOf(document.activeElement);
  if (current === -1) return;

  if (e.key === "Enter") {
    const link = cards[current].querySelector(".card-link");
    if (link) {
      e.preventDefault();
      link.click();
    }
    return;
  }

  const cols = columnCount();
  const moves = {
    ArrowRight: current + 1,
    ArrowLeft: current - 1,
    ArrowDown: current + cols,
    ArrowUp: current - cols,
    Home: 0,
    End: cards.length - 1,
  };
  if (!(e.key in moves)) return;

  e.preventDefault();
  const next = Math.max(0, Math.min(cards.length - 1, moves[e.key]));
  cards[current].tabIndex = -1;
  cards[next].tabIndex = 0;
  cards[next].focus();
}

/** Global shortcuts: "/" jumps to search, Escape clears it. */
function onGlobalKeydown(e) {
  const typing = e.target.matches("input, textarea, select");
  if (e.key === "/" && !typing && !els.search.disabled) {
    e.preventDefault();
    els.search.focus();
  } else if (e.key === "Escape" && e.target === els.search && els.search.value) {
    els.search.value = "";
    state.query = "";
    applyFilters();
  }
}

/* ---------- Data loading ---------- */

function isValidRecord(r) {
  return r && typeof r.id === "string" && typeof r.title === "string" && typeof r.domain === "string";
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Server responded with ${response.status}.`);
  return response.json();
}

/** Live API first; if it fails or returns nothing, fall back to the bundled sample data. */
async function loadInternships() {
  // Reviewers can test the fallbacks: ?simulate=offline (live API fails)
  // and ?simulate=error (live API and sample data both fail).
  const simulate = new URLSearchParams(location.search).get("simulate");
  const apiUrl = simulate ? "api/does-not-exist" : API_URL;
  const sampleUrl = simulate === "error" ? "data/does-not-exist.json" : SAMPLE_URL;

  try {
    const live = await getJson(apiUrl);
    const internships = (live.internships || []).filter(isValidRecord);
    if (internships.length > 0) {
      return { internships, info: { live: true, sources: live.sources || [], fetchedAt: live.fetchedAt } };
    }
  } catch (err) {
    console.warn("Live internships unavailable, using sample data:", err);
  }

  const sample = await getJson(sampleUrl);
  if (!Array.isArray(sample.internships)) throw new Error("The data file is not in the expected format.");
  const internships = sample.internships
    .filter(isValidRecord)
    .map((i) => ({ ...i, source: "Sample" }));
  return { internships, info: { live: false } };
}

async function init() {
  showOnly("loading");
  els.count.textContent = "";
  els.dataStatus.hidden = true;
  try {
    const { internships, info } = await loadInternships();
    state.internships = internships;
    renderFilters();
    renderDataStatus(info);
    applyFilters();
  } catch (err) {
    console.error(err);
    els.errorMessage.textContent = `${err.message} Please check your connection and try again.`;
    showOnly("error");
  }
}

/* ---------- Events ---------- */

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  applyFilters();
});

els.form.addEventListener("change", (e) => {
  if (e.target.name === "domain") state.domain = e.target.value;
  else if (e.target.name === "source") state.source = e.target.value;
  else return;
  applyFilters();
});

// Stop Enter in the search box from reloading the page.
els.form.addEventListener("submit", (e) => e.preventDefault());

els.form.addEventListener("reset", () => {
  // The form resets inputs after this event, so sync state on the next tick.
  setTimeout(() => {
    state.query = "";
    state.domain = ALL;
    state.source = ALL;
    renderFilters();
    applyFilters();
    els.search.focus();
  });
});

els.loadMore.addEventListener("click", () => {
  const firstNew = state.visible;
  state.visible += PAGE_SIZE;
  // Move focus to the first newly shown card, so keyboard users continue from there.
  update({ focusIndex: firstNew });
});

els.results.addEventListener("keydown", onCardKeydown);
document.addEventListener("keydown", onGlobalKeydown);

els.emptyReset.addEventListener("click", () => els.form.reset());
els.retry.addEventListener("click", init);

init();
