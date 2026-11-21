// Local dev server: serves the static site and runs api/internships.js the way
// Vercel would, so the whole app works locally without a Vercel login.
//   npm run dev  ->  http://localhost:3000
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/internships.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (pathname === "/api/internships") return handler(req, res);

  // Resolve inside the project folder only (no ../ escapes).
  const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname));
  if (!file.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }
  try {
    const body = await readFile(file);
    res.setHeader("Content-Type", TYPES[extname(file)] || "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(PORT, () => console.log(`Internship Board running at http://localhost:${PORT}`));
