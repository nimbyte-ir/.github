// Renders the organization README's bento tiles (tiles.html) to PNGs in profile/bento/, at 2x.
//   node bento/build.mjs
// Each tile keeps its transparent margin, so the README can set them side by side.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const { chromium } = createRequire(import.meta.url)("playwright"); // global install: require finds it
const here = import.meta.dirname;
// Bump the folder when tiles change: GitHub caches an image by its path.
const out = resolve(here, "../profile/bento/v4");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1200, height: 900 } });
await page.goto(`file://${resolve(here, "tiles.html")}`);
await page.evaluate(() => document.fonts.ready);
for (const id of await page.$$eval(".wrap", (els) => els.map((e) => e.id))) {
  await page.locator(`#${id}`).screenshot({ path: `${out}/${id}.png`, omitBackground: true });
}
// GitHub's dark theme: the ink tile gets a faint edge so it doesn't sink into the page.
await page.evaluate(() => document.querySelector("#process .tile").classList.add("dark"));
await page.locator("#process").screenshot({ path: `${out}/process-dark.png`, omitBackground: true });
// Bitty's tile moves: one frame per 0.15s step of the 2.4s wave, joined into an APNG by ffmpeg
// (GitHub plays APNG in a README; GIF would lose the soft corners' alpha).
const frames = mkdtempSync(resolve(tmpdir(), "bitty-"));
for (let step = 0; step < 16; step++) {
  await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), step * 150 + 1);
  await page.locator("#c-bitty").screenshot({ path: `${frames}/${String(step).padStart(2, "0")}.png`, omitBackground: true });
}
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "20/3", "-i", `${frames}/%02d.png`, "-plays", "0", "-f", "apng", `${out}/c-bitty.png`]);
rmSync(frames, { recursive: true });
await browser.close();

