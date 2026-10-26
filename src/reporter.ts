import type { LintResult } from "./types.js";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const red = paint(31);
const yellow = paint(33);
const dim = paint(2);
const bold = paint(1);

export function formatPretty(results: LintResult[]): string {
  const lines: string[] = [];
  let errors = 0;
  let warnings = 0;

  const failed = results.filter((r) => r.error);
  for (const { url, error } of failed) {
    lines.push("", bold(url), `  ${red("failed")} Could not lint this page: ${error}`);
  }

  for (const { url, findings } of results) {
    if (findings.length === 0) continue;
    lines.push("", bold(url));
    for (const f of findings) {
      if (f.severity === "error") errors++;
      else warnings++;
      const level = f.severity === "error" ? red("error") : yellow("warn ");
      lines.push(`  ${level}  ${f.message}  ${dim(f.ruleId)}`);
      if (f.snippet) lines.push(`         ${dim(`"${f.snippet}"`)}`);
      if (f.selector) lines.push(`         ${dim(f.selector)}`);
    }
  }

  const total = errors + warnings;
  const linted = results.length - failed.length;
  if (total === 0) {
    lines.push(`${failed.length ? "" : "✔ "}No dark patterns found in ${linted} page(s).`);
  } else {
    lines.push("", bold(`✖ ${total} problem(s) (${errors} error(s), ${warnings} warning(s))`));
  }
  if (failed.length) lines.push(red(`✖ ${failed.length} page(s) could not be linted.`));
  return lines.join("\n");
}

export function formatJson(results: LintResult[]): string {
  return JSON.stringify(results, null, 2);
}
