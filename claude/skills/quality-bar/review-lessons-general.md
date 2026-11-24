# Review lessons: language-agnostic (read for every change)

Part of the review-lessons catalog (see "Catalog and caps" in section 8 of `SKILL.md`). Tag = highest severity seen: [H] High, [M] Medium, [L] Low.

## 1. External calls: budgets, retries, caching

- [H] Classify each upstream error: transient (retry), permanent for one item (skip and count), fatal (auth, exhausted rate limit: abort the run); a per-item skip never swallows a fatal error. 4xx is not "permanent" as a class: 408/409/423/425/429, connection reset and body-read timeout are transient. Decide per status; log the real cause (sanitized error chain), not "decode failed".
- [H] A swallowed per-item failure still travels up as a typed flag in the result that callers cannot ignore (Rust: `#[must_use]` or destructured); callers deciding reset/retry/coverage read that flag.
- [H] Skip, truncation, page cap, shift or failed sub-fetch is reported as partial/incomplete, never clean success, and a CLI or handler catch-all never turns a failure into exit code 0 or a success response; when an upstream refuses (auth, permission, timeout), report "unknown", not zero. A failed sub-fetch or list never discards independent siblings (pushes vs PR lists) or lists that already succeeded, and "covered/searched" markers are recorded only for entities actually searched (never skipped, budget-cut or failed ones). A truncation notice states what the cap counts and suggests only an action that changes that count.
- [M] When a budget stops a loop part-way, rotate the start point between runs (or persist a cursor) so the tail is not starved.
- [H] A retry or restart gets its own budget, enough for the retry alone to finish a maximal valid run; it runs only where it can improve the result (opt-in per caller) and drops the first pass's rows before restarting. Offset paging over a mutating set needs shift detection (overlap an anchor row, restart with its own budget); a shift degrades to incomplete plus warning, never a hard failure with a misleading message.
- [H] Wait and budget bounds are wall-clock (not only sleep time) and fit inside the enclosing job deadline; when turning a fail-fast path into a retrying one, compute worst-case wall time (waves x retries x max wait) and check every other caller of that function. A per-item call in a fan-out that now waits on rate limits gets a run-scoped flag: after the first exhausted rate limit, later items skip the request and report truncated, so the waits cannot push the run past a deadline that discards everything collected. A consecutive-failure abort that any success resets does not bound this; cap rate-limited items per run by total count. Check a time budget before every call that has its own retry ladder, not only between coarse items (days, users). Count every rate-limit wait, including calls that recover after waiting, against one run-level wait budget: a stop that fires only on exhausted retries does not bound many calls that each wait and then succeed. Measure a phase budget from the attempt start (or a deadline the caller passes in), not the phase start, because earlier phases spend the same deadline; a doc claiming the budget bounds the run's total wait lists every waiting call path it does not cover.
- [M] Concurrency caps limit in-flight requests, not rate: add a shared cooldown and honor `Retry-After` and rate-limit headers. Charge each retried request against the local quota gate inside the retry closure (not once per item), in the shared entry point, not in each caller.
- [H] Every HTTP, SMTP and DB call has a timeout, and every HTTP client a connect timeout as well as a request timeout. Interactive, fallback, live-read and optional enrichment paths get a short timeout and no default retries: never auto-retry timeouts, non-transient 4xx or load-shed 429s there (timeout plus retry multiplies wait), and after the first rate limit in an enrichment pass set a run-wide flag that skips the remaining lookups.
- [M] Rate-limit and shed per user, not per tenant; reserve a share of a shared upstream budget for interactive use so one low-privilege user cannot drain the budget sync depends on.
- [M] Before adding a per-item lookup, estimate steady-state call growth (repos x open items x calls) and prefer a coarser list endpoint; don't call for data a sibling fetch in the same run already returns (order steps so the cheap source seeds the cache first); request only the cheapest option set the consumer reads and pin the exact option list in a test.
- [H] Cache successful lookups of near-immutable data across runs (TTL, per-tenant key, size cap in entries and in bytes, successes only; an arm that turns an unexpected status into an empty or cut-short `Ok` is not a success, so a memo keyed on the response stores only definitive answers like 200 or a real 404). Give upstream failures a short negative cache. A cached answer may short-circuit only the permissive outcome: a refusal of a user action is reconfirmed against a fresh read, and a fresh read the user was shown refreshes the cache.
- [M] Batching many items into one request amplifies one bad item into a whole-batch failure: validate each item (allowlist plus length cap, same check at save and sync) before batching; run batch chunks sequentially and stop at the first auth error (one bad credential costs one request, not one per chunk).
- [L] Build the HTTP client once and share it, with one request pacer per upstream tenant, across concurrent runs and routes; resolve shared lookups once per sync, not once per pass. Read upstream response bodies with a byte cap; do not read an error body nobody uses.
- [M] When the wait the upstream asks for (rate-limit reset, `Retry-After`) exceeds the retry wait cap, give up at once and set the run-wide stop; a retry before the reset fails for certain, burns quota and can extend the provider's penalty.
- [M] A skip that treats stored rows as "already fetched" cannot tell "fetched, nothing to store" from "never fetched" when the source emits no row for zero activity: record an explicit fetched marker, or count those refetches in the steady-state cost estimate with realistic sparse data.

## 2. External calls: failure handling

- [H] A failed lookup must not overwrite or blank a previously stored value (links, titles). Keep the old value or surface the failure.
- [M] Save results incrementally per unit so a deadline, abort or fatal error does not discard the run: in a concurrent fan-out stop at the first fatal result, persist rows already in hand, report persisted counts, then return the error. A failing sink or persist step is surfaced and tested, never swallowed (`unwrap_or(0)`); never await slow sinks while the stream is live.
- [M] Decide explicitly whether a partial run counts as success (advance cursor, run follow-up steps); a failed tick must not skip unrelated work, and one failed or skipped entity (user, repo, project) resets state only for that entity, never the whole source.
- [H] Upstream field types come from docs or a recorded response, never a guess; when uncertain or they disagree, decode both shapes (untagged enum) and validate numeric strings. Null, wrong-typed and string-number fields in external JSON are defined cases with tests.
- [H] When a payload shrinks, restore every field consumers read from the same lookup; keep fields that describe "now" (state, merged) out of historical rows.
- [M] When correctness depends on an upstream search index or operator, prove it on more than one account and server version, state the minimum version, warn when every item resolves to unknown.
- [H] Replacing a direct lookup with a search: pin the search's implicit filters (active-only, visibility, limits).
- [H] An input allowlist or pre-flight check in front of an external system matches what that system accepts (or a safe superset), and resolves the target exactly as the runtime call will: same endpoint precedence including deployment-wide fallbacks, same value as stored (not a trimmed copy).
- [M] Map every upstream status to a structured error variant, never prose matched by substring. Ambiguous statuses (203 on throttle, 404 for permission denied, 403 carrying quota headers) get a documented, tested mapping, applied at every call site through one shared mapper: fixing the 429 arm of one call while its quota-403 still falls into a skip arm leaves the same loss.
- [H] Never write back a rotating credential (OAuth refresh token) from a copy captured earlier in the request: the final write keeps the value the row holds at write time, and replay is limited to the first-save case with no stored row. Cache or retry a rotated credential whose persist failed; dropping it leaves only the revoked old one.
- [H] A long incremental sync advances its watermark to the last fully collected point (process items in watermark order), so an early stop resumes there and does not refetch the whole window every run; record a permanent per-item skip as a known gap, never as an incomplete state that repeats forever. One permission error on the first item does not mean the whole class is unreadable.
- [M] A fix to one failure arm is applied to every sibling arm with the same pattern in that function (the same `break` or silent skip on a sibling resource), or the sibling is recorded as a follow-up; a half-fixed function hides the remaining loss behind the fixed one.

## 3. Bounds and performance

- [H] A request deadline must not cancel in-flight fetches already paid for: run the fill detached and time out only the wait, so the next read hits the cache. Likewise a run-wide budget stop blocks only new work; it never cancels a retry whose wait was already paid inside the budget.
- [H] Every list call pages to the end or has an explicit, logged cap; every continuation-token loop has its own max-pages and repeated-token guard. A fixed `$top` without paging silently truncates.
- [H] User-controlled ranges (days, items) have a maximum: bound cost by the age/size of requested data, not range length (cap how far back `from` may go); heavy reads get a statement timeout and a per-user/tenant concurrency limit.
- [M] User-supplied paging offsets are clamped (or rejected) like limits; a negative value is a 400, not a 500.
- [M] Filter out rows that will be discarded (drafts, withdrawn) before expensive upstream work.
- [M] Multiple blocks measured under one shared deadline concurrently, never sequentially with a deadline each.
- [M] A per-request concurrency cap doesn't cap the tenant: add a per-tenant semaphore around upstream work when a page fires N requests. A global gate shared by tenants also needs a per-tenant share and a short acquire timeout, and the acquire wait must not consume the request deadline, or one slow tenant starves all; prove it with a test that holds the slot past the read budget, then releases it and expects success.
- [M] Destructive or maintenance routes: rate limit before the expensive scan, statement/lock timeout, dry-run, second-run guard, documented removal condition.
- [H] Reusing a command endpoint (validate, test connection) for a background or page-load read strips its side effects and expensive sub-steps (probes, test generations) and gets its own audit wording; the whole chain, sub-calls included, fits inside the proxy timeout.
- [M] Cap response size per read and in total across pages (bytes and item count); enforce the byte cap per page before decoding, since a count cap applied after a full decode does not bound memory; hitting the total cap marks the result incomplete.
- [L] Shared caches: eviction sweeps run only when full or at an interval (not O(N) under a write lock on every insert); per-tenant caps stop noisy neighbors; per-entity client maps evict on tenant/source removal.
- [L] Invalidate expensive aggregates after the data they depend on changes.
- [H] A child-process runner reads redirected stdout and stderr concurrently before waiting for exit, and every wait has a timeout that kills the child.
- [M] Fixed sleeps in production paths (wait for a launched app, show an error) are configurable and injectable, never a hard-coded wait on every run.
- [M] Reflection or plugin-registry scans run once per process and are cached, never per validation call.

## 4. Correctness and data integrity

- [H] Stored timestamps come from the item's own event data, never from sync/observation time or `min(event, now)`.
- [H] A row type chosen from the item's current status and used in the dedup key makes output depend on when the sync saw the item: key on stable identity, derive status separately.
- [H] Retry/backoff clocks advance only on real attempts; failed, skipped or swallowed ticks neither reset nor age them.
- [H] Checked arithmetic on user-supplied dates and numbers, in the shared helper, on every path (admin, manual sync, plugins).
- [H] Every path that changes a state (create, enable, re-enable, link, role change) triggers the same side effects. If a concurrent run blocks it, queue or retry; never drop silently. A new variant of an existing writer keeps every side effect and the transaction of the original, also those the target branch added after the fork; a doc comment saying "same as X" is checked against X.
- [M] Model a multi-column state machine as one pure transition function plus one guarded UPDATE; enumerate and test every reachable state. Put it in the domain/service layer where jobs can reuse it.
- [M] A repair/dedupe that deletes a duplicate verifies the kept counterpart is real and readable, not fabricated or derived.
- [M] Match grouped results back to parents by key, never by position or zip; test regroup/zip logic with unequal sizes and reversed ids.
- [H] Deletion policy is consistent: if deleting a parent is refused for closed records, cascading from another owner must not erase them. Check what `ON DELETE CASCADE` reaches.
- [M] Mutations checked for multi-tenant and multi-membership combinations; one global status flag must not activate or block sibling memberships.
- [M] Derived "ongoing/waiting" metrics consult the entity's current state, not only the last transition. Carrying state across ordered history: enforce or assert the order; take the latest value by timestamp, not arrival order.
- [M] One fact, one field, one meaning: two fields encoding one fact merge into one type; one flag for two causes splits per cause with its own wording; a stored field that changes meaning gets a comment where it is built and a note that old rows need a re-sync. Code that reads a shared status flag as a proxy for one cause (store failed) must not see a flag another cause set earlier; pass the specific condition.
- [M] Store coverage as an absolute timestamp, not relative days. If a view offers a wider range than collected, return the data horizon, and apply any missing-data fallback per covered segment, not per dataset: items on the uncovered days of a partly covered range must still land in some bucket.
- [M] Identity matching: exact hit first, else a single case-insensitive hit; 2+ hits are ambiguous. Never first-wins. Tightening attribution: release note, cause-separated logs, check the dedup key includes the actor.
- [M] A fetch window follows the query semantics the feature needs (closed in window, still open regardless of age); test with an old item active inside the window. Clamp "since"/retention boundaries so old open items are not re-inserted every sync.
- [M] Same class of failure, same status (state conflict is 409 everywhere, not 400). Domain errors the frontend must distinguish carry a machine-readable code.
- [M] Normalize blank or whitespace-only input to "absent" once at the trust boundary: a fallback (`.or(stored)`, `??`) on a present-but-empty value never falls back, and a COALESCE-style upsert then overwrites the stored value with empty.
- [L] Invalid persisted values must not break a whole aggregate; guard per row and count bad rows visibly.
- [L] Parallel implementations behave and log consistently on bad input. Rotation/bucket logic tested on both parity cases and wrap-around.
- [H] An installer or upgrade migrates user-copied config and templates, so a fix to a shipped default reaches existing installs. Persisted config carries a schema version and lives in a per-user writable location, not the install directory.
- [M] Preview, dry-run and validate modes skip every side effect (signing, chmod, cert creation, process launch, persisting credentials derived from a caller-supplied config); test with a mock executor or the stored row asserting nothing changed.
- [M] Config saves are atomic: write a temp file, then rename.
- [M] A ratio, capacity or residual takes its numerator and denominator from the same population (active members, scope, window); test with a member that is in one set but not the other and pin the exact values.
- [M] Group, key and dedup by stable ids, never by display names; two entities with the same name stay separate (test it), the name is only the label.
- [H] When a sync skips work it believes is already stored, the proof of "stored" comes only from the range the skip decides on, never from rows the always-refetched part writes on every run; otherwise a missed or interrupted backfill looks complete and is never repaired.

## 5. Concurrency

- [H] Hardening one writer: inventory every writer of rows referencing the same parent; guard all through one shared helper; test each.
- [M] Per-tenant state has a single owner and one invalidation entry point; don't make callers remember two `forget` calls.
- [H] In-process caches and limiters assume a single replica: enforce it, or share state and broadcast invalidation.
- [M] A slow external call placed between a read and the write that depends on it widens the lost-update window: re-read and compare a version before writing (409 on change), or document last-write-wins.
- [M] Per-invocation modes, flags and results (elevation mode, validation errors) are never stored on shared singleton services; pass them as arguments or return them in a result object. Warn-once and first-time flags are process-global; per-tenant behavior needs per-tenant state.
- [M] A toggle or config write during a running job must not reset that job's markers: generation counter or compare-and-set.
- [H] Request handlers never redirect process-global state (console writer, cwd, env vars); pass an injected writer or context instead.

## 6. Security

- [M] Stored secrets are bound to the endpoint they were saved for: when provider, base URL or TLS flag changes, require the secret again (backend and frontend), on every path that sends it (validation, save-time checks, runtime). A fallback that clears the secret instead of refusing must leave a config every later consumer (jobs, generation) still accepts; check each consumer's requirements first.
- [M] Routes live-reading upstream entities by caller-supplied key with the service credential restrict keys to stored activity or an allowlist.
- [H] Scoping and authorization filters go through one chokepoint that every read route applies; a scope-filter fix also repairs already-stored out-of-scope rows. A stricter rule for a sensitive data class (fail closed for a half-configured role, per-person data) covers every route that can return that data, aggregates included: a team or group rollup that a caller-chosen filter narrows to one person returns that person's data. Test each sibling route with the narrowest filter.
- [M] Cancel/revive of privileged invites requires the privilege needed to issue them. Admin-only by default; confirm when a broader role can change org-wide objects.
- [H] Untrusted upstream text into LLM prompts goes through the sanitizer at every sink, quotes and pipes escaped, length capped locally. Fixing one sink: audit every field the same formatter writes (timeline, headings, tables), and sanitize inside the one shared renderer so a copy cannot skip it.
- [M] Escape per output context: link targets are percent-encoded (http/https only), table text is cell-escaped, path segments built from external ids are validated and percent-encoded (no `.`/`..`); strip invisible and bidi Unicode from prompt text; never use an untrusted value as a regex replacement pattern (`$` expands), use a literal replace.
- [L] Reject userinfo in configured URLs; warn on `http://` with token auth; recheck redirects against the host allowlist. No DB URLs with passwords on process command lines; reject args with leading `-`.
- [L] Strip request URLs from transport errors shown to low-privilege users; generic messages for config validation failures.
- [L] Destructive admin actions and on-behalf-of crediting record the acting account.
- [L] Secret-bearing config is not logged or bound on every tick; compare by hash or generation. Types holding secrets never derive `Debug` over them (redact by hand); send them via the HTTP client's bearer helper or sensitive-header marking.
- [H] Values from an untrusted URL, link or file never reach a shell string, generated script or file name unescaped: pass argv lists (no `sh -c`, no string-built `do shell script`; quote with the language's shell-quoting helper where a shell is unavoidable), build temp file names from a random id only, and validate host/user fields against a strict character set (no control chars, `/`, `..`, leading `-`); stripping control characters is NOT shell-quoting (`;`, `$`, backtick, `|`, `&`, `()` survive), so a value that passes a control-char filter can still inject. Apply the escaping at the sink, and treat any code path that builds the output outside the shared sanitizer chokepoint (an alternate template, a default-template branch) as a reopened hole. Files generated from untrusted input in key=value formats allow-list the keys input may set and reject CR/LF; content derived from untrusted input is never signed or marked trusted, and a self-made cert is never added to a trust store silently.
- [H] A localhost-only HTTP server is still reachable from any web page (DNS rebinding, CSRF): enforce a Host allowlist, an Origin check and a per-session random token on every state-changing route.
- [M] Helper binaries are resolved from a fixed absolute or installer-recorded path, never by a search (PATH, desktop index, first match) whose first hit is executed, and registered launch commands and service paths quote the executable path; entitlements and hardened-runtime exceptions are the minimum the app needs.
- [M] Temp files holding tokens are owner-only in a per-user directory and deleted in `finally`.
- [M] A dangerous code path (shell sink, trust-store write, privileged op) disabled only by a feature flag or a migration is not fixed: harden the sink itself (defense in depth) AND add a test that the gate stays shut; a migration or flag that is the sole guard, and is itself untested, is one edit away from reopening the hole.
- [M] Sensitive business fields (pay rates, charges) stored in shared records are filtered by role on every read path, not only behind a sync-time toggle; test the lower role gets none and the higher role gets the exact value.
- [M] An identifier space shared by two subsystems (OAuth state provider, job kind) is typed and namespaced by the owner, so one subsystem cannot mint a value the other trusts; a host capability handed to plugins is scoped to the caller's own source.
- [L] OAuth authorization-code flows use PKCE, also for confidential clients.

## 7. Logging

- [H] Log tenant and entity ids, not emails, usernames, names, free text, repo/project names or connection strings; command lines and URLs that carry session tokens are redacted before logging. Wrap tenant work in a span carrying the tenant id.
- [M] Shift, incomplete and best-effort failures log at `warn` (the same level as their peers) with the reason and what is lost; one event, one line; failures never at success level. A fan-out logs one aggregated `warn!` per call, with per-item detail at `debug!`.
- [M] A log line moved into a shared helper stays true for every caller: name the operation neutrally or take the caller's purpose ("validation succeeded" must not appear on a save).
- [L] Sanitize untrusted strings before log fields (log forging) and truncate upstream error text; secret redaction in logged paths is allowlist/route-pattern based; test helpers never print credentials.
- [M] File log sinks configure rotation and retention.
- [M] Pass the exception as the logger's exception argument, not as a format value, so stack traces survive.
- [L] Log each retry once, in the shared retry helper; the operation closure does not also warn per attempt.

## 8. Single source of truth

- [H] No hand-kept list mirroring an enum or registry; coverage guards enumerate the real registry, compare as multisets or counts, and assert registry id equals the enum string. A guard proving a fixture row exists, or re-pinning the participant set, is not a guard that each participant's test exists; check per participant (e.g. scan its source for the named test).
- [H] Grep for an existing mapping, helper or constant before writing one (status code to error, tag constants, labels, constants shared by prod and demo data); extract at the second copy, never add the 7th. A rule or text derived in several places (approval, merge time, own-item check, user-visible fallback text) is written once and imported; precedence differences make two screens disagree.
- [M] Types every plugin/producer must fill live in a typed struct in the shared contract crate, not in comments.
- [H] A payload with domain rules shared across components (plugin to plugin, backend to frontend): persist the derived value in the producer, or add a contract test from real producer to real consumer; every cross-language wire enum has a golden fixture.
- [M] New endpoints get their own typed response; no ill-fitting schema reuse.
- [M] Two entry points of one component share one setup helper (parse, validate, allowlist, client), and two endpoints reporting the same condition share one error code contract.
- [M] A string format built in one place and parsed in another (dedup keys, tags) has a round-trip test from the real builders through the parser; a field projection sent upstream (`$select`, sparse fieldsets) is tied by a test to every reader of the stored payload, since a dropped field fails silently.

## 9. Architecture

- [M] Services don't import API DTOs and API modules don't import services back; services return their own structs, one entry point for handlers and jobs; type-level dependencies don't invert layers either. A repository doesn't write tables owned by another; compose in one transaction via the owner or a service.
- [M] New policy logic goes in its own module with pure decision functions; don't grow huge files or 500-line functions; split 100+ line handlers.
- [M] No API parameter without a client, and no flag that only produces a log line: document it as such, or wire it into the result.
- [L] Test-only helpers stay out of production contract crates.
- [M] Rename things when their meaning changes; remove unused impls, dead fields, guards for unreachable states and leftover wrappers. When a path is removed, also remove the lower-layer branches only it used (SQL `CASE` arms, sentinel values), above all ones that clear a stored secret.
- [M] One composition root; no static field bridging two DI containers.
- [M] Generic host components (backend and UI) never branch on a specific plugin or source id, hardcode one plugin's vendor name or setup hint, or import plugin internals; add an extension slot to the plugin contract (manifest field, trait method), let the plugin fill it, and carry the declaring source on the wire so the UI text uses its label.
- [M] Per-run state (stop flags, counters, budgets) lives in a run-scoped object passed by reference, not on a reusable client; if it must sit on a client, document that the client is never cached or shared, and test two runs on one plugin instance.

## 10. Tests

- [H] Wiring: exercise a new helper through the real entry point, with seeded data where the guard matters; reverting the call turns the suite red. A new request field is asserted through the HTTP route, not only on the function it feeds.
- [H] Every role-gated route: table-driven test that each lower role gets 403 with state unchanged, including the role just below the gate, paired with the allowed role succeeding.
- [H] Deadline, timeout, skip, early-exit and give-up branches reached by paused-clock tests, with data where the exit is not the natural end; multi-tick tests prove a cut-off entity is eventually reached; a stop flag meant to outlive an inner loop is tested across two outer iterations; a budget the caller derives (total minus elapsed) is asserted through the caller, not only by handing the callee a fixed value.
- [H] Never pin contested or known-bad behavior as intended; settle the decision first or label the test.
- [M] Each failure class gets its own case (401, 403, 404, 429, 500, undecodable, dropped body), and both sides of a classification (quota 403 retried, permission 403 not); accumulators and flags (`+=`, `|=`) get a case where an earlier item sets the flag and a clean item follows, and each copy of such a line in sibling arms gets its own case. A threshold (requested wait vs cap) gets a case on each side, with a cap realistic enough that the under-cap case is retried; a tiny cap lets "stop always" pass.
- [M] Assert which entity was acted on and exact values (keys, author, links, request counts, wire field names, both values of a response flag), not that something ran. An assertion repeated after an event that could change the value asserts a value that distinguishes before from after.
- [M] Absence assertions that constraints or a dependency already guarantee are vacuous (removing the guarded code leaves them green): drop them, don't count them. Pair every absence check and predicate edge case (null, wrong type, missing key) with a presence control that uses the same matching unit as the absence check (all fragments in one statement, not each anywhere in a file), and run checks on the produced output, never on the test's own expected literal.
- [H] Prove each guard red on its own; one red test through one guard proves nothing about the others. A guard on a value the entry-point fixtures cannot vary is unit-tested with hand-built input, so removing it goes red. An absence check is scoped to the region under test and matches anywhere in it, not by line prefix; its search marker is unique to the target within that scope (a text fragment shared by sibling queries or functions is not), and a comment claiming uniqueness is checked by grep.
- [M] A concurrency cap is tested on every method path that takes the slot.
- [H] Mocks don't encode the change's own API assumption; frontend mocks use the backend's real error shape and status.
- [M] Test the client as production builds it (timeouts, retries) and pin its literals; timeout paths assert the setting is applied and the mapped status (504), not elapsed time.
- [M] Cache invalidation on a write is tested (entry gone), with a sibling tenant's entry surviving.
- [M] Shell scripts handling URLs tested with query strings, missing env, unreachable DB, zero rows.
- [M] Paused/injected clocks or `Notify`/channels; no real sleeps or `now()` re-reads; a deadline shortened to provoke a failure never also bounds the test's success call (give that call the production deadline); fixed dates with mid-day boundaries, never `now()`-relative data that flakes near midnight or under a non-UTC session zone. Race tests gate the competing step on a notify/barrier or perform the other task's effect inside a mock responder at the exact point, never a wall-clock delay window. Every race/barrier wait has a timeout and aborts on failure.
- [L] Shared fixtures and builders hoisted into one helper, building rows in the producer's real shape (e.g. day buckets at 00:00Z) so boundary bugs are not hidden; named-field structs over positional tuples.
- [H] Platform-gated branches (OS checks) sit behind an injectable platform service, so security-critical paths for every OS are tested on any CI runner.
- [M] OS- or environment-gated tests that early-`return` on the non-target platform report as PASSED and inflate the green count; use the framework's Skip (xUnit `Skip`, `[SkippableFact]`) so they show as skipped, and read the skipped count, not just the pass count, in CI.
- [M] Memo/cache tests assert, for each non-definitive arm (error, paused, partial, unexpected status), that the next caller refetches, and use two keys that differ in each key component, so a key that drops a part fails.

## 11. Docs, comments and branch readiness

- [M] User docs, LLM prompts and UI notices state the rule the code applies; when a policy changes, grep for every doc and comment naming the old claim and update all in the same change. Documented limits and counts match computed values; shared-helper docs don't assume one caller, and a doc on a field several writers add to (insert vs upsert paths) holds for every writer.
- [H] Comments next to changed code still match it (e.g. "no lock needed" after adding a lock), make no overstated guarantees, name things that exist (after renaming a test or symbol, grep the old name everywhere, old migration headers included), cite no finding IDs and carry no history (that goes to commits). A shortcut's comment states the assumption it relies on; deliberate omissions get a one-line comment.
- [L] Behavior changes altering historical counts get a release note; published docs get broken tables and stale plans fixed.
- [H] Lint, build and test against the target branch's current rules and contracts (rebase onto it first), not the merge-base's; a contract the target added (coverage guard, required manifest field) is met by the new code too.
- [H] CI gates really run: triggers match the default branch, the toolchain is pinned and installed before the build, the job fails on zero tests; tools downloaded in CI are version-pinned and hash-checked before they get signing secrets; signing jobs run behind a protected environment with approval, not on any push to a release-named branch.
- [H] Before the first release of anything handling credentials: a disclosure contact, a security model (untrusted inputs, what is put in trust stores, where secrets land on disk and in logs), an incident and rollback plan, and a way to revoke or replace a bad signed release.
- [M] With warnings-as-errors, pin the SDK/toolchain and analyzer level so a toolchain bump cannot silently break the build; track the support end date of a bundled runtime and retarget before it, since an EOL runtime ships unpatched in every installer.
- [M] Release artifacts carry the release version stamp and checksums or signatures, and dev builds are distinguishable from releases; packaging and signing scripts fail fast (`set -e`, check every exit code), so a failed sign or notarize step never yields a shipped artifact.
- [M] Committed prebuilt assets get a rebuild step in CI, so dependency updates actually reach what ships.
