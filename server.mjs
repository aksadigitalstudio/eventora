// Local static preview only. Production deploys dist/ directly (no Node server required).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.env.EVENTORA_DIST || "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".json": "application/json",
};
export const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw Error();
    } catch {
      if (path.extname(pathname)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      file = path.join(root, "index.html");
    }
    const bytes = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(bytes);
  } catch {
    res.writeHead(500);
    res.end("Unable to load this page.");
  }
});
server.listen(Number(process.env.PORT || 4200), "127.0.0.1", () =>
  console.log(
    "Eventora preview: http://127.0.0.1:" + (process.env.PORT || 4200) + "/",
  ),
);
process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
