// Builds index.html (one self-contained, minified page) from the files in src/.
// Run: npm install   (once)   then   npm run build
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { transformSync } from "esbuild";

const src = f => readFileSync(new URL("./src/" + f, import.meta.url), "utf8");
const dev = process.argv.includes("--dev"); // unminified, easier to debug

const js = "(function(){\n" + ["data.js", "core.js", "build.js", "ui.js"].map(src).join("\n") + "\n})();\n";
const css = src("styles.css");
const body = src("body.html");

const outJs = dev ? js : transformSync(js, { minify: true, target: "es2019" }).code;
const outCss = dev ? css : transformSync(css, { loader: "css", minify: true }).code;
const outBody = dev ? body : body.replace(/\n\s+/g, "\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Groundworks</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${outCss}</style>
</head>
<body>
${outBody}
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>${outJs}</script>
</body>
</html>
`;
writeFileSync(new URL("./index.html", import.meta.url), html);
// Hosting copy: Vercel serves the "public" folder (GitHub Pages serves index.html from the root).
mkdirSync(new URL("./public/", import.meta.url), { recursive: true });
writeFileSync(new URL("./public/index.html", import.meta.url), html);
console.log(`index.html written: ${(html.length / 1024).toFixed(0)} KB${dev ? " (dev, unminified)" : ""}`);
