#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { formatHtml } from "./report-html.js";
import { formatJson, formatPretty } from "./reporter.js";
import { allRules } from "./rules/index.js";
import { lint } from "./runner.js";
import type { Severity } from "./types.js";

const HELP = `honestlint - catch dark patterns in your web app

Usage:
  honestlint <url...> [options]

Options:
  --rule <id>           Only run this rule (repeatable)
  --fail-on <level>     Exit non-zero on "error" (default) or "warn"
  --json                Print results as JSON
  --report              Also write an HTML report with annotated screenshots
  --out <file>          Where to write the report (default honestlint-report.html)
  --timeout <ms>        Navigation timeout (default 30000)
  --headed              Show the browser window
  --list-rules          List the built-in rules
  -h, --help            Show this help

Examples:
  honestlint http://localhost:3000/checkout
  honestlint https://staging.example.com --rule cookie-banner-asymmetry --json
  honestlint http://localhost:3000 --report --out reports/home.html
`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      rule: { type: "string", multiple: true },
      "fail-on": { type: "string", default: "error" },
      json: { type: "boolean", default: false },
      report: { type: "boolean", default: false },
      out: { type: "string", default: "honestlint-report.html" },
      timeout: { type: "string" },
      headed: { type: "boolean", default: false },
      "list-rules": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values["list-rules"]) {
    for (const r of allRules) console.log(`${r.id.padEnd(26)} ${r.severity.padEnd(6)} ${r.description}`);
    return 0;
  }
  if (positionals.length === 0) {
    console.error(HELP);
    return 2;
  }

  const failOn = values["fail-on"] as Severity;
  if (failOn !== "error" && failOn !== "warn") {
    console.error(`--fail-on must be "error" or "warn", got "${failOn}"`);
    return 2;
  }

  const results = await lint(positionals, {
    rules: values.rule,
    timeout: values.timeout ? Number(values.timeout) : undefined,
    headless: !values.headed,
    screenshot: values.report,
  });

  if (values.report) {
    const out = resolve(values.out);
    await writeFile(out, formatHtml(results), "utf8");
    // Keep the base64 screenshots out of the terminal and JSON output.
    for (const r of results) delete r.screenshot;
    console.error(`Report written to ${pathToFileURL(out).href}`);
  }

  console.log(values.json ? formatJson(results) : formatPretty(results));

  const failing = results.some((r) =>
    r.findings.some((f) => f.severity === "error" || (failOn === "warn" && f.severity === "warn")),
  );
  return failing ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  },
);
