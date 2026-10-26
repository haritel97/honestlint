# honestlint

**A linter for deceptive UX.** honestlint opens your web app in a real browser and flags dark patterns (pre-ticked consent boxes, fake countdown timers, lopsided cookie banners, guilt-trip opt-outs) so you can fix them before your users, or a regulator, notice.

Think ESLint, but for the honesty of your interface.

```text
$ npx honestlint http://localhost:3000/checkout

http://localhost:3000/checkout
  error  Consent checkbox is pre-checked. Users must opt in themselves.  pre-checked-consent
         "Send me offers from our partners"
         #offers
  warn   Accept button is 22.5x larger than the reject option.  cookie-banner-asymmetry
         "Accept all / Reject"
         #cookie-banner > a
  error  Countdown reset from 14:54 to 15:00 after a reload.  fake-countdown
         "15:00"
         #timer

✖ 3 problem(s) (2 error(s), 1 warning(s))
```

> **Status:** early prototype (v0.1). Rules are heuristic, so expect some false positives and misses. Feedback and new rules are very welcome.

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
```

| Option | Description |
| --- | --- |
| `--rule <id>` | Only run this rule (repeatable) |
| `--fail-on <level>` | Exit non-zero on `error` (default) or `warn` |
| `--json` | Print results as JSON |
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

Each dark pattern is one small rule file, so adding a new one is a great first contribution. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
