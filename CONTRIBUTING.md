# Contributing to honestlint

Thanks for helping make the web a little more honest.

## Setup

```bash
npm install
npx playwright install chromium
npm test
```

## Adding a rule

1. Create `src/rules/<rule-id>.ts` exporting a `Rule` (see `src/types.ts`). Use one of the existing rules as a template.
2. Inside `page.evaluate`, use the shared helpers on `window.__honestlint` (`cssPath`, `isVisible`, `text`) from `src/browser-helpers.ts`.
3. Register the rule in `src/rules/index.ts`. Rules that reload or navigate the page go at the end of the list.
4. Add the pattern to `test/fixtures/deceptive.html`, an honest version to `test/fixtures/honest.html`, and a test in `test/rules.test.ts`.
5. Add a row to the rules table in `README.md`.

## Guidelines

- **Prefer false negatives over false positives.** A linter that cries wolf gets turned off.
- Messages should say what is wrong and what the honest alternative is.
- Cite a source (research paper, regulator guidance, deceptive.design) for the pattern in your PR description.
