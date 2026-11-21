"use strict";

const DATA_URL = "data/internships.json";

const resultsEl = document.getElementById("results");

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

function renderCards(list) {
  resultsEl.replaceChildren(...list.map(createCard));
}

async function loadInternships() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  return json.internships;
}

loadInternships().then(renderCards);
