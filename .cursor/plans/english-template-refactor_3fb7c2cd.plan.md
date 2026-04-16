---
name: english-template-refactor
overview: Refactor the frontend logic to remove Chinese-dependent internals without changing current behavior, add an English example page template, and reorganize docs so English becomes the primary entry point for adopters.
todos:
  - id: audit-appjs-language-coupling
    content: Identify every place in `app.js` where Chinese text is used as logic, comments, locale, or formatting output, and define stable internal replacements that preserve current visible behavior.
    status: pending
  - id: refactor-appjs-internals
    content: Refactor `app.js` to use internal keys for summary/category logic, convert all comments to English, and keep all current UI strings and runtime behavior unchanged.
    status: pending
  - id: add-english-example-template
    content: Create an English example HTML template derived from `index.html` that demonstrates how the existing app can be adapted for English without introducing runtime language switching.
    status: pending
  - id: rewrite-docs-english-first
    content: Rewrite `README.md` for English-first adoption and split or preserve Chinese maintainer-facing documentation in a separate file if needed.
    status: pending
  - id: review-consistency
    content: Review naming, terminology, and behavior consistency across `app.js`, the English example template, and the documentation.
    status: pending
isProject: false
---

# English-First Template Refactor Plan

## Goals
- Keep the current site behavior, rendered Chinese UI, routing, and SEO output unchanged in the first refactor pass.
- Make [`app.js`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/app.js) internally language-agnostic so the same runtime can power future non-Chinese templates.
- Add an English example page template based on [`index.html`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/index.html) to demonstrate reuse.
- Rework documentation so [`README.md`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/README.md) is English-first, with Chinese content split out if needed.

## Scope
### 1. Internal-only refactor in [`app.js`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/app.js)
- Translate all code comments from Chinese to English.
- Replace language-dependent logic values with stable internal keys.
- Preserve current Chinese output by mapping internal keys back to the same visible strings.
- Do not change routes, fetch flow, search behavior, static page behavior, meta tag output text, or current UI wording.

Essential hotspots already identified:
- `getSummaryText()` currently returns Chinese values such as `不會動`, `不確定`, `可能會動` and is used as both logic and display state.
- `getOgDescription()` branches on those Chinese summary values.
- `formatCategory()` converts category keys directly into Chinese labels.
- `formatDate()` hardcodes `zh-TW` rather than accepting a configurable locale.
- Sorting uses `localeCompare(..., 'zh-TW')`, which should become configurable without changing current output.

Recommended refactor shape:
- Introduce stable internal summary keys like `wontWork`, `uncertain`, `mightWork`.
- Split current responsibilities into:
  - `getSummaryKey(result)` for logic
  - `getSummaryLabel(summaryKey)` for the current Chinese display text
- Update computed state so conditionals use `summaryKey`, while UI text still uses the current Chinese label.
- Convert category formatting into a display-label layer, e.g. `getCategoryDisplayText(category)`.
- Make formatting helpers accept configuration defaults while still defaulting to current Chinese behavior.

### 2. English example template based on [`index.html`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/index.html)
- Add one English example HTML template, preferably as a clearly labeled example file such as `index.en.example.html`.
- Use it to demonstrate how the current app can be re-skinned in English without changing the runtime behavior in [`app.js`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/app.js).
- Translate visible page copy in the example template:
  - title and description meta tags
  - headings and result labels
  - FAQ copy
  - search placeholder and empty-state text
  - overview copy
  - footer links and support text
- Keep structure close to the existing [`index.html`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/index.html) so adopters can diff the two templates easily.

Recommended follow-up structure for maintainability:
- If the template duplication starts to drift, extract content into a separate content/config layer after the first example lands.
- Do not attempt full runtime i18n in this pass; the English file is a reference template, not a locale switcher.

### 3. English-first documentation in [`README.md`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/README.md)
- Rewrite [`README.md`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/README.md) for external adopters in English.
- Focus the main README on:
  - what the repo does
  - how it relates to `web-resilience-test`
  - installation and build commands
  - static page generation flow
  - deployment flow
  - how to customize branding, report links, copy, and data sources
- Move current Chinese-oriented guidance into a separate file such as `README.zh-TW.md` if the original local-maintainer context should be preserved.
- Add a short link between the two files so readers can choose the language.

## Implementation order
1. Refactor [`app.js`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/app.js) internals first, with comment translation included.
2. Verify that current Chinese rendering remains identical at the template level.
3. Add the English example template derived from [`index.html`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/index.html).
4. Rewrite [`README.md`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/README.md) in English and split Chinese documentation if needed.
5. Run a final review for consistency between code comments, template naming, and documentation terminology.

## Validation checklist
- Current Chinese site output remains unchanged after the `app.js` refactor.
- Internal comparisons no longer depend on Chinese strings.
- All `app.js` comments are English.
- The English example template is understandable as a starting point for forks.
- The README clearly explains how to adapt the project for another country or organization.

## Files expected to change
- [`app.js`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/app.js)
- [`index.html`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/index.html) only if minor reference hooks are needed to support the example-template structure
- one new English example template file next to [`index.html`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/index.html)
- [`README.md`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/README.md)
- optional new [`README.zh-TW.md`](/Users/Irvin/Coding/smc%20git/web-resilience-test-profile/README.zh-TW.md)

## Notes
- This plan intentionally avoids changing the live Chinese experience in the first pass.
- Full multilingual runtime support can be added later on top of the new internal key structure, but is not required for this milestone.