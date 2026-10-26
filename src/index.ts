export { lint, selectRules } from "./runner.js";
export { allRules } from "./rules/index.js";
export { matchesConfirmshaming } from "./rules/confirmshaming.js";
export { formatJson, formatPretty } from "./reporter.js";
export type { Finding, LintOptions, LintResult, Rule, RuleContext, Severity } from "./types.js";
