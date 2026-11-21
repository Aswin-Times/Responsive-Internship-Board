// Shared fetch helper. We identify ourselves honestly (no browser spoofing)
// and give up after a timeout, so one slow source never holds up the response.
export const USER_AGENT =
  "InternshipBoardBot/1.0 (+https://github.com/Aswin-Times/Responsive-Internship-Board)";

async function fetchOnce(url, timeoutMs, accept) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} responded ${response.status}`);
  return response.text();
}

export async function fetchText(url, { timeoutMs = 15000, accept = "text/html" } = {}) {
  try {
    return await fetchOnce(url, timeoutMs, accept);
  } catch (err) {
    // Retry once on a dropped connection ("fetch failed"), but not on a timeout
    // or an HTTP error: those won't get better a second later.
    if (err.name === "TimeoutError" || err.message.includes("responded")) throw err;
    return fetchOnce(url, timeoutMs, accept);
  }
}

export async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, { ...options, accept: "application/json" }));
}
