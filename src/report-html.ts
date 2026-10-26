import type { Finding, LintResult } from "./types.js";

/** Everything in the report that came from the linted page is untrusted, so escape it all. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;

function countBySeverity(findings: Finding[]) {
  const errors = findings.filter((f) => f.severity === "error").length;
  return { errors, warnings: findings.length - errors };
}

function renderMarkers(result: LintResult, offset: number): string {
  const shot = result.screenshot;
  if (!shot) return "";
  return result.findings
    .map((f, i) => {
      const box = f.box;
      if (!box || box.y >= shot.height) return "";
      const n = offset + i + 1;
      const style = [
        `left:${pct(box.x, shot.width)}`,
        `top:${pct(box.y, shot.height)}`,
        `width:${pct(Math.max(box.width, 8), shot.width)}`,
        `height:${pct(Math.max(box.height, 8), shot.height)}`,
      ].join(";");
      // The number badge sits just outside the box's top-left corner, where it
      // rarely hides the flagged element or its neighbours. It flips to the other
      // side when it would fall off the image.
      const edge = (box.x < 24 ? " edge-x" : "") + (box.y < 24 ? " edge-y" : "");
      return `<a class="marker ${f.severity}${edge}" href="#f${n}" data-n="${n}" style="${style}" aria-label="Finding ${n}"><span>${n}</span></a>`;
    })
    .join("");
}

function renderFinding(f: Finding, n: number, onScreenshot: boolean): string {
  return `<li class="finding ${f.severity}" id="f${n}" data-n="${n}">
  <div class="finding-head">
    <span class="num">${onScreenshot ? n : "–"}</span>
    <span class="sev">${f.severity === "error" ? "Error" : "Warning"}</span>
    <code class="rule">${escapeHtml(f.ruleId)}</code>
  </div>
  <p class="msg">${escapeHtml(f.message)}</p>
  ${f.snippet ? `<blockquote>${escapeHtml(f.snippet)}</blockquote>` : ""}
  ${f.selector ? `<code class="sel">${escapeHtml(f.selector)}</code>` : ""}
  ${!onScreenshot ? `<p class="note">Not visible in the screenshot.</p>` : ""}
</li>`;
}

function renderPage(result: LintResult, offset: number): string {
  if (result.error) {
    return `<section class="page">
  <header class="page-head">
    <h2>${escapeHtml(result.url)}</h2>
    <div class="chips"><span class="chip error">Could not lint</span></div>
  </header>
  <p class="empty">${escapeHtml(result.error)}</p>
</section>`;
  }
  const { errors, warnings } = countBySeverity(result.findings);
  const shot = result.screenshot;
  const clean = result.findings.length === 0;

  const findings = result.findings
    .map((f, i) => renderFinding(f, offset + i + 1, Boolean(shot && f.box && f.box.y < shot.height)))
    .join("\n");

  return `<section class="page">
  <header class="page-head">
    <h2><a href="${escapeHtml(result.url)}" rel="noreferrer noopener" target="_blank">${escapeHtml(result.url)}</a></h2>
    <div class="chips">
      ${clean ? `<span class="chip ok">No dark patterns found</span>` : ""}
      ${errors ? `<span class="chip error">${errors} error${errors > 1 ? "s" : ""}</span>` : ""}
      ${warnings ? `<span class="chip warn">${warnings} warning${warnings > 1 ? "s" : ""}</span>` : ""}
    </div>
  </header>
  <div class="page-body${shot ? "" : " no-shot"}">
    ${
      shot
        ? `<div class="shot-wrap"><figure class="shot" style="aspect-ratio:${shot.width}/${shot.height}">
      <img src="data:image/jpeg;base64,${shot.data}" alt="Screenshot of ${escapeHtml(result.url)}">
      ${renderMarkers(result, offset)}
    </figure></div>`
        : ""
    }
    ${clean ? `<p class="empty">Nothing to report on this page. 🎉</p>` : `<ol class="findings">${findings}</ol>`}
  </div>
</section>`;
}

/** A single self-contained HTML file: screenshots are inlined, no network access needed. */
export function formatHtml(results: LintResult[], generatedAt = new Date()): string {
  const all = results.flatMap((r) => r.findings);
  const { errors, warnings } = countBySeverity(all);

  let offset = 0;
  const pages = results
    .map((r) => {
      const html = renderPage(r, offset);
      offset += r.findings.length;
      return html;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>honestlint report</title>
<style>
:root {
  --bg: #f6f7f9; --surface: #ffffff; --text: #16181d; --muted: #5d6472; --border: #e3e6eb;
  --error: #d92d20; --error-soft: #fdecea; --warn: #b54708; --warn-soft: #fef4e6;
  --ok: #067647; --ok-soft: #e7f6ee; --accent: #3b5bdb; --code-bg: #f1f3f6;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f1115; --surface: #171a21; --text: #e8eaee; --muted: #9aa3b2; --border: #2a2f3a;
    --error: #f97066; --error-soft: #3a1a18; --warn: #fdb022; --warn-soft: #3a2a10;
    --ok: #47cd89; --ok-soft: #12321f; --accent: #8ea8ff; --code-bg: #20242d;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 1440px; margin: 0 auto; padding: 32px 24px 64px; }
.top { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.brand { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
.brand small { display: block; font-size: 14px; font-weight: 400; color: var(--muted); letter-spacing: 0; }
.summary { display: flex; gap: 12px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 16px; min-width: 96px; }
.stat b { display: block; font-size: 24px; line-height: 1.1; }
.stat span { color: var(--muted); font-size: 13px; }
.stat.error b { color: var(--error); } .stat.warn b { color: var(--warn); }
.page { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; margin-bottom: 24px; overflow: hidden; }
.page-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 20px; border-bottom: 1px solid var(--border); }
.page-head h2 { margin: 0; font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.page-head a { color: inherit; text-decoration: none; }
.page-head a:hover { color: var(--accent); }
.chips { display: flex; gap: 8px; }
.chip { font-size: 13px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.chip.error { color: var(--error); background: var(--error-soft); }
.chip.warn { color: var(--warn); background: var(--warn-soft); }
.chip.ok { color: var(--ok); background: var(--ok-soft); }
.page-body { display: grid; grid-template-columns: minmax(0, 3fr) minmax(300px, 2fr); }
.page-body.no-shot { grid-template-columns: 1fr; }
.shot-wrap { max-height: 80vh; overflow: auto; border-right: 1px solid var(--border); background: var(--code-bg); padding: 16px; }
.shot { position: relative; margin: 0; width: 100%; border-radius: 6px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.shot img { display: block; width: 100%; height: 100%; }
.marker { position: absolute; border: 2px solid var(--c); border-radius: 4px;
  background: color-mix(in srgb, var(--c) 12%, transparent); transition: box-shadow .15s, background .15s; }
.marker.error { --c: #e5484d; } .marker.warn { --c: #f5a524; }
.marker span { position: absolute; top: -20px; left: -20px; width: 22px; height: 22px; border-radius: 50%;
  background: var(--c); color: #fff; font: 700 12px/22px ui-sans-serif, system-ui, sans-serif; text-align: center;
  box-shadow: 0 1px 4px rgba(0,0,0,.3); }
.marker.edge-x span { left: auto; right: -20px; }
.marker.edge-y span { top: auto; bottom: -20px; }
.marker.active { box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 45%, transparent);
  background: color-mix(in srgb, var(--c) 25%, transparent); }
.findings { list-style: none; margin: 0; padding: 12px; max-height: 80vh; overflow: auto; }
.finding { border: 1px solid var(--border); border-left: 4px solid var(--c); border-radius: 10px;
  padding: 12px 14px; margin-bottom: 10px; cursor: pointer; transition: background .15s; }
.finding.error { --c: var(--error); } .finding.warn { --c: var(--warn); }
.finding:hover, .finding.active { background: var(--code-bg); }
.finding-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.num { width: 22px; height: 22px; border-radius: 50%; background: var(--c); color: #fff;
  font-size: 12px; font-weight: 700; line-height: 22px; text-align: center; flex: none; }
.sev { font-size: 13px; font-weight: 700; color: var(--c); }
code { font: 12.5px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.rule { color: var(--muted); background: var(--code-bg); padding: 1px 6px; border-radius: 5px; }
.msg { margin: 8px 0 6px; font-weight: 500; }
blockquote { margin: 0 0 6px; padding: 6px 10px; border-radius: 6px; background: var(--code-bg);
  color: var(--muted); font-style: italic; overflow-wrap: anywhere; }
.sel { display: block; color: var(--muted); overflow-wrap: anywhere; }
.note { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
.empty { padding: 24px; color: var(--muted); }
footer { margin-top: 32px; color: var(--muted); font-size: 13px; text-align: center; }
footer a { color: var(--accent); }
@media (max-width: 900px) {
  .wrap { padding: 20px 16px 48px; }
  .page-body { grid-template-columns: 1fr; }
  .shot-wrap { border-right: 0; border-bottom: 1px solid var(--border); max-height: 60vh; }
  .findings { max-height: none; }
}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <h1 class="brand">honestlint report<small>${results.length} page${results.length === 1 ? "" : "s"} · ${escapeHtml(generatedAt.toLocaleString("en-GB"))}</small></h1>
    <div class="summary">
      <div class="stat error"><b>${errors}</b><span>errors</span></div>
      <div class="stat warn"><b>${warnings}</b><span>warnings</span></div>
    </div>
  </div>
  ${pages}
  <footer>Generated by <a href="https://github.com/haritel97/honestlint">honestlint</a>. Findings are heuristic: review each one before acting on it.</footer>
</div>
<script>
(() => {
  const markers = (n) => document.querySelectorAll('.marker[data-n="' + n + '"]');
  const setActive = (n, on) => {
    markers(n).forEach((m) => m.classList.toggle("active", on));
    document.querySelectorAll('.finding[data-n="' + n + '"]').forEach((f) => f.classList.toggle("active", on));
  };
  document.querySelectorAll(".finding, .marker").forEach((el) => {
    const n = el.dataset.n;
    el.addEventListener("mouseenter", () => setActive(n, true));
    el.addEventListener("mouseleave", () => setActive(n, false));
  });
  document.querySelectorAll(".finding").forEach((el) => {
    el.addEventListener("click", () => {
      const m = markers(el.dataset.n)[0];
      if (m) m.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
  });
  document.querySelectorAll(".marker").forEach((m) => {
    m.addEventListener("click", (e) => {
      e.preventDefault();
      const f = document.getElementById("f" + m.dataset.n);
      if (f) f.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
})();
</script>
</body>
</html>
`;
}
