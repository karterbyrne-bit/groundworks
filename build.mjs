// Builds index.html (one self-contained, minified page) from the files in src/.
// three.js and the fonts are packed into the page too, so it never depends on another website being up.
// Run: npm install   (once)   then   npm run build
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { transformSync } from "esbuild";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const src = f => read("./src/" + f);
const dev = process.argv.includes("--dev"); // unminified, easier to debug

// The app's code, joined in this order into one shared scope: each file can use what the files before it define.
const FILES = [
  "data.js", "core.js",
  "build/basics.js", "build/atmosphere.js", "build/architecture.js", "build/fittings.js", "build/walls.js", "build/roofs-site.js", "build/stadium.js",
  "ui/readout.js", "ui/camera.js", "ui/stand-editor.js", "ui/ground.js", "ui/saving.js", "ui/welcome.js",
];
// if the 3D engine didn't arrive (a page cut off part way), boot.js shows a card instead of the app starting
const js = "(function(){\nif (typeof THREE === \"undefined\" || !THREE.OrbitControls){ if (window.gwNo3D) window.gwNo3D(); return; }\n" + FILES.map(src).join("\n") + "\n})();\n";
const css = src("styles.css");
const body = src("body.html");
const boot = src("boot.js");

const three = read("./node_modules/three/build/three.min.js");
const orbit = transformSync(read("./node_modules/three/examples/js/controls/OrbitControls.js"), { minify: true, target: "es2019" }).code;

// Latin subsets only: the page is in English. font-display:swap shows text straight away in a fallback font.
const FONTS = [
  ["Big Shoulders Display", "big-shoulders-display", [600, 800]],
  ["IBM Plex Sans", "ibm-plex-sans", [400, 500, 600]],
  ["IBM Plex Mono", "ibm-plex-mono", [400, 500]],
];
const fontCss = FONTS.flatMap(([family, pkg, weights]) => weights.map(w => {
  const data = readFileSync(new URL(`./node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`, import.meta.url)).toString("base64");
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")}`;
})).join("\n");

const min = (code, loader) => dev ? code : transformSync(code, { minify: true, target: "es2019", loader }).code;
const outJs = min(js, "js");
const outBoot = min(boot, "js");
const outCss = min(css, "css");
const outBody = dev ? body : body.replace(/\n\s+/g, "\n");

// The address used in link previews. On Vercel it picks up the project's own address automatically.
const SITE = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/` : "https://karterbyrne-bit.github.io/groundworks/");
const DESC = "Design your own 3D football stadium in the browser. Build stands tier by tier, add roofs and floodlights, and see capacity, sightlines and safety checks update live.";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Groundworks: build your own stadium</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="#eef1ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111714" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${SITE}">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:title" content="Groundworks: build your own stadium">
<meta property="og:description" content="${DESC}">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<style>${fontCss}
${outCss}</style>
</head>
<body>
${outBody}
<script>${outBoot}</script>
<script>${three}</script>
<script>${orbit}</script>
<script>${outJs}</script>
</body>
</html>
`;
writeFileSync(new URL("./index.html", import.meta.url), html);
// dist/ holds just the files a web host needs (Vercel, Netlify and similar publish this folder).
const dist = new URL("./dist/", import.meta.url);
rmSync(dist, { recursive: true, force: true }); mkdirSync(dist);
writeFileSync(new URL("index.html", dist), html);
for (const f of ["sw.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "og.png"]) copyFileSync(new URL("./" + f, import.meta.url), new URL(f, dist));
console.log(`index.html written: ${(html.length / 1024).toFixed(0)} KB${dev ? " (dev, unminified)" : ""}`);
