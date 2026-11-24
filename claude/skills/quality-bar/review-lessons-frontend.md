# Review lessons: frontend (React/TypeScript)

Part of the review-lessons catalog (see "Catalog and caps" in section 8 of `SKILL.md`). Tag = highest severity seen: [H] High, [M] Medium, [L] Low.

## 1. Frontend

- [M] Charts aggregate (e.g. weekly) once a range would render thousands of nodes or sub-pixel bars; disable animation for big series. Per-item detail lists over a long range render on selection, paged or virtualized, not all at once.
- [H] Changed UI lines use semantic tokens only (no palette classes, `dark:` color variants, hex, title case), as classes: a token value passed through an inline `style` constant passes the literal-only lint but still breaks the rule. Lint on a branch rebased onto the target.
- [H] After a mutation, invalidate every query showing data derived from it, not only the edited list; test it. If the query key itself derives from the mutated data, invalidating refetches the old key and the rerender fetches the new one: version the key with a fingerprint of the fields the query depends on (a whole-row `updated_at` refetches after unrelated saves) or use `refetchType: 'none'` instead.
- [H] Composite TS project references emit `.js`/`.d.ts` beside source unless `noEmit`/`emitDeclarationOnly` + `outDir` are set; a stray emitted `vite.config.js` is loaded before `vite.config.ts`. Delete emit output before commit and fix the tsconfig.
- [H] A query disabled via `enabled` still returns cached data for its key; gate the consumed data on the same condition, or key the query on the value the gate compares. Data fetched for the saved config is shown in a form only while every field it depends on (provider, endpoint, account) still matches the unsaved form values.
- [H] Edit dialogs surface 409/validation errors like their add siblings; toasts name the real cause.
- [H] Fixing an empty-string-means-missing bug (`||` not `??`) for one field: fix every sibling field and renderer read the same way.
- [M] Keyboard hooks inside a dialog coordinate with its Escape handler (`onEscapeKeyDown`); test the primitive inside a dialog.
- [M] One accessible model per chart (don't wrap a focusable accessibility layer in `role="img"`; don't put named `role="img"` children inside a `progressbar`/`img`, whose children are presentational, so jsdom tests see names real assistive tech drops).
- [L] Types match the wire shape including `null`; Zod schemas parse the fields the page reads (no `as unknown as T`).
- [L] Infinite queries: exclude `isFetchNextPageError` from page-level error states.
- [L] Retry controls don't retry non-retryable errors; 429 shows reason and a retry path.
- [L] Empty state and chart derive from the same data. Filter changes cancel their earlier in-flight queries.
- [M] Group and label dates in UTC: a date-only value parsed as UTC midnight and formatted in local time shows the previous day west of UTC (parse it as a local date or format with `timeZone: 'UTC'`, test under a non-UTC TZ); time-axis labels spanning years include the year. Heading levels follow nesting.
- [L] Job-watch state lives in a store or is derived from the API, not component state.
- [L] Exhaustive maps use `Record<Id, ...>` with no fallback cast; registry keys equal manifest ids.
- [M] A persistent configuration gap is shown as an alert with a direct link to the setting that fixes it, not as plain text.

## 2. Frontend tests

- [M] A gate depending on two async loads is tested with each load held back (deferred handler), not with both answering immediately in a lucky order.
- [M] Query policy options (`retry`, `refetchOnWindowFocus`, `staleTime`) are tested with a `QueryClient` on library defaults; a test client that sets the same option globally masks its removal.
- [L] Ordering assertions on already-ordered fixtures are tautologies: serve reversed. `waitFor(() => expect(x).toEqual([]))` passes on the first tick; wait on a settled signal.
- [L] Test names don't overclaim; comments state behavior, not review finding IDs. Hand-mirrored fake servers share a JSON fixture with the real one.
- [M] Test files are type-checked (or fixtures are typed builders): a fixture missing a required field silently renders another branch in every test.
- [L] Tests asserting formatted dates or numbers pin the locale (explicit locale argument or set in test setup), or they fail under a non-English `LANG`.
