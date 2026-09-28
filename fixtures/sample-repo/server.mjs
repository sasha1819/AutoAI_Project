import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const port = Number(process.env.PORT ?? 4173);

function isPublic(path) {
  return path === "/index.html" || path === "/styles.css" || path.startsWith("/src/");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = normalize(join(root, path));
  if (!isPublic(path) || !file.startsWith(root)) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "text/plain" }).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Sample shop running at http://localhost:${server.address().port}`);
});
