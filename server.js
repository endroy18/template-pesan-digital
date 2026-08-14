// Server lokal untuk development (tidak dipakai saat deploy ke Vercel).
// Menyajikan situs statis + endpoint /api/generate dari api/generate.js.
// Cara pakai:  npm run dev   ->   buka http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");
const generate = require("./api/generate.js");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

// Muat .env.local (tanpa dependensi) jika ada.
try {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
} catch (e) {
  /* abaikan */
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (e) {
    pathname = url.pathname;
  }

  if (pathname === "/api/generate") {
    // Shim agar handler ala Vercel (res.status().json()) jalan di Node bawaan.
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
    res.json = function (obj) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
      this.end(JSON.stringify(obj));
      return this;
    };
    req.body = await readBody(req);
    return generate(req, res);
  }

  let filePath = pathname === "/" ? path.join(ROOT, "index.html") : path.resolve(ROOT, "." + pathname);
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Forbidden");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("404 Not Found");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`✅ Generator berjalan: http://localhost:${PORT}`);
});
