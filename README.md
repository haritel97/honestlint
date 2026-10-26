# honestlint

[![CI](https://github.com/haritel97/honestlint/actions/workflows/ci.yml/badge.svg)](https://github.com/haritel97/honestlint/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/honestlint)](https://www.npmjs.com/package/honestlint)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**A linter for deceptive UX.** honestlint opens your web app in a real browser and flags dark patterns (pre-ticked consent boxes, fake countdown timers, lopsided cookie banners, guilt-trip opt-outs) so you can fix them before your users, or a regulator, notice.

Think ESLint, but for the honesty of your interface.

![honestlint report for the ShadyShop demo store: a screenshot with four dark patterns outlined and numbered, next to the list of findings](https://raw.githubusercontent.com/haritel97/honestlint/main/docs/report.png)

## Try it in 30 seconds

[**ShadyShop**](https://honestlint-shadyshop.vercel.app) is a fake store we built to be as shady as possible. Point honestlint at it:

```bash
npx playwright install chromium   # once
npx honestlint https://honestlint-shadyshop.vercel.app --report
```

```text
https://honestlint-shadyshop.vercel.app
  error  Consent checkbox is pre-checked. Users must opt in themselves.  pre-checked-consent
         "Email me exclusive offers and share my details with trusted partners"
  warn   Accept button is 14.8x larger than the reject option.  cookie-banner-asymmetry
  warn   Opt-out text shames the user for declining.  confirmshaming
         "No thanks, I'd rather pay full price"
  error  Countdown reset from 09:58 to 09:59 after a reload.  fake-countdown

✖ 4 problem(s) (2 error(s), 2 warning(s))
Report written to honestlint-report.html
```

ShadyShop also hides a few patterns honestlint can't catch yet (fake scarcity, a pre-added protection plan, a "cancel by phone" subscription). Spotting them is a good first contribution.

> **Status:** early (v0.2). Rules are heuristic, so expect some false positives and misses. Feedback and new rules are very welcome.

## Why

Dark patterns are no longer just bad manners. Laws such as the EU Digital Services Act and consumer-protection rules in the US and India increasingly restrict them. Most teams don't ship them on purpose: a growth experiment here, a copied cookie banner there. honestlint catches them in CI, the same way you already catch accessibility and lint errors.

## Install

```bash
npm install --save-dev honestlint
npx playwright install chromium
```

Requires Node.js 20 or newer.

## Usage

```bash
# Lint one or more pages
npx honestlint http://localhost:3000 http://localhost:3000/pricing

# Only run some rules
npx honestlint http://localhost:3000 --rule fake-countdown --rule confirmshaming

# Fail CI on warnings too, and get machine-readable output
npx honestlint http://localhost:3000 --fail-on warn --json

# Write an HTML report with annotated screenshots
npx honestlint http://localhost:3000 --report
```

### HTML report

`--report` writes a single self-contained HTML file (default `honestlint-report.html`, change it with `--out`). Each page gets a full-page screenshot with every problem outlined and numbered, next to the list of findings. Hover a finding to highlight it on the screenshot, or click a marker to jump to its finding. The file has no external dependencies, so you can attach it to a PR, upload it as a CI artifact, or send it to a designer.

| Option | Description |
| --- | --- |
| `--rule <id>` | Only run this rule (repeatable) |
| `--fail-on <level>` | Exit non-zero on `error` (default) or `warn` |
| `--json` | Print results as JSON |
| `--report` | Also write an HTML report with annotated screenshots |
| `--out <file>` | Where to write the report (default `honestlint-report.html`) |
| `--timeout <ms>` | Navigation timeout (default 30000) |
| `--headed` | Show the browser window |
| `--list-rules` | List the built-in rules |

Exit codes: `0` clean, `1` findings at or above `--fail-on`, `2` usage or runtime error.

### Programmatic API

```ts
import { lint, formatPretty } from "honestlint";

const results = await lint(["http://localhost:3000"], { rules: ["pre-checked-consent"] });
console.log(formatPretty(results));
```

## Rules

| Rule | Severity | What it catches |
| --- | --- | --- |
| `pre-checked-consent` | error | Marketing, newsletter or partner-sharing checkboxes that are ticked by default |
| `cookie-banner-asymmetry` | warn | Cookie banners with no reject option, or a reject option far smaller than accept |
| `confirmshaming` | warn | Opt-out wording that guilt-trips the user ("No thanks, I don't like saving money") |
| `fake-countdown` | error | Urgency timers that reset when the page is reloaded |

## Roadmap

- [ ] `roach-motel`: compare clicks needed to sign up against clicks needed to cancel
- [ ] `hidden-costs`: detect prices that grow between the product page and checkout
- [ ] `sneak-into-basket`: items added to the cart without the user asking
- [ ] Multi-step flows (scripted journeys, not just single pages)
- [ ] Optional LLM-backed text rules for non-English pages
- [ ] GitHub Action with PR annotations
- [ ] Config file (`honestlint.config.ts`) for per-project rule settings

## Contributing

Each dark pattern is one small rule file, so adding a new one is a great first contribution. See [CONTRIBUTING.md](CONTRIBUTING.md), and look for issues labelled [`good first issue`](https://github.com/haritel97/honestlint/labels/good%20first%20issue).

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
