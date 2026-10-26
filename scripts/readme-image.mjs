// Regenerates docs/report.png, the README hero image: a honestlint report of
// the ShadyShop demo store. Run `npm run build` first, then:
//   node scripts/readme-image.mjs [url]
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { formatHtml, lint } from "../dist/index.js";

const url = process.argv[2] ?? "https://honestlint-shadyshop.vercel.app";
const out = fileURLToPath(new URL("../docs/report.png", import.meta.url));

const results = await lint([url], { screenshot: true });
const html = formatHtml(results);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });
  await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
  await page.locator(".page").first().screenshot({ path: out });
  console.log(`Wrote ${out} (${results[0].findings.length} findings)`);
} finally {
  await browser.close();
}
