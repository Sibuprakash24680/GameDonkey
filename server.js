/* Zero-dependency static server for the Donkeyyy table.
 * `npm start` -> http://localhost:3000
 *
 * This is also the file the online build grows into: add `ws`, keep a
 * room map, run MK.reduce() on the server as the single source of truth and
 * broadcast state. index.html needs no changes for that (engine is already
 * pure + event-sourced).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(ROOT, path.normalize(urlPath));

    if (!file.startsWith(ROOT)) {
      res.writeHead(403); return res.end("forbidden");
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log("Donkeyyy table serving on http://localhost:" + PORT));
