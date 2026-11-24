# Review lessons: SQL, databases and migrations

Part of the review-lessons catalog (see "Catalog and caps" in section 8 of `SKILL.md`). Tag = highest severity seen: [H] High, [M] Medium, [L] Low.

## 1. SQL and queries

- [H] Never sort, window or DISTINCT rows carrying a large JSON column: sort narrow keys, extract needed fields after. Measure with realistic payload sizes.
- [H] A per-group "newest first, stop at first match" probe with a filter (`LATERAL ... LIMIT 1` + `NOT EXISTS`) degrades to a full per-row walk when nothing matches; bound it where the answer stops mattering and benchmark the no-match data shape against the old query.
- [H] Push date filters into the scan itself (semi-join on index), not only a window aggregate. A speedup that depends on an index or plan shape is pinned by an EXPLAIN plan test (seqscan disabled) asserting the index is used and no Sort sits under the probes; a test that only pins the index definition text lets column order, direction or a bound regress to the slow plan with every test green. Cover every probe the speedup relies on (not only the easy ones), and where small test data keeps the fast plan anyway (a per-row instead of a constant bound), assert the Index Cond text of each probe.
- [M] A skip-scan or probe range predicate must land in an index-condition column (leading-column order); behind an inequality column it is only a filter and the scan walks the whole group range. Check Index Cond vs Filter in EXPLAIN ANALYZE and benchmark at several times today's history; state the headroom.
- [M] Queries whose best plan depends on parameter values (ranges, bounds, lists, or a partial-index predicate that must be proven from bound values) run unprepared (custom plan) or inline the literals; the rule is documented once and every site, fallback COUNT included, carries it or a comment why not.
- [M] Dynamically assembled SQL lives in a pure builder function (not nested closures) with a snapshot or plan test; binds shared by the main query and its fallback COUNT go through one helper, and fixtures vary same-typed adjacent binds so a swap fails.
- [M] An expensive expression (correlated subquery, probe) referenced twice in a SELECT runs twice; compute it once (e.g. one `COALESCE`/`jsonb_set` over a single reference) and test both branches.
- [L] Generated SQL lists columns explicitly; `SELECT *`/`t.*` couples results to column order.
- [H] Batch writes are one set-based statement (`UNNEST`/`push_values`); chunked statements re-scanning in one transaction add cost and release no locks. A multi-row `VALUES` with tens of thousands of binds spends most of its time in parse/plan and caches one prepared statement per chunk size; prefer one array per column. An array batch still keeps a fixed row cap per statement when the input is unbounded: each array is one datum (1 GB server limit), held whole in client and server memory.
- [M] Upserts carry a change predicate (`WHERE existing IS DISTINCT FROM EXCLUDED`); a retrying backfill writes only what is new or changed. The compared columns and the `SET` columns come from one list (or a row-form `SET (a, b) = (...)` beside the predicate), and a test pins what happens when only a non-compared column changes. Skipped rows are still row-locked and WAL-logged: document "no new row version", not "no write"; where a sync re-sends a large unchanged window, drop unchanged rows before the insert (`WHERE NOT EXISTS (... same key AND same data)`), keep the predicate for races, and prove it with `xmax = 0` on an unchanged row.
- [L] JSONB equality is semantic (key order, numeric scale such as `1` vs `1.0`), so a change predicate on a JSONB column treats such re-sends as unchanged; pin that in a test when the raw form matters.
- [M] Don't load every candidate row into memory for a repair; stream or aggregate in SQL. Extract per page; keep only a seen-set for dedup.
- [L] `$1 IS NULL OR x = ANY($1)` defeats indexes under generic plans; `ORDER BY CASE` plus `OFFSET` sorts the whole set per page. Split queries or keyset-page.
- [M] A statement-wide bound taken as MIN/MAX over all groups lets one outlier (a lagging group) widen every group's scan; take it over the requested subset only, or give outliers their own branch, and benchmark with one stale group.
- [M] A page and its total share one pass over an expensive CTE (`COUNT(*) OVER ()` before `LIMIT`, a separate COUNT only when the page is empty past the end), not two executions of the same scan.
- [L] Existence checks select only ids, never full rows with PII.
- [L] Shared SQL guard fragments are one parameterized helper doing one job.
- [M] Multi-table state-changing deletes run in one transaction.
- [H] App code must not depend on deploy order: SQL that works before and after the migration when it may not have run.
- [M] A race fix is proven against the in-progress case (concurrent transaction mid-delete), not only the committed case: plain `EXISTS` sees an uncommitted delete; `FOR KEY SHARE` waits it out.
- [H] Lock rows across tables in one global order; same-table rows `ORDER BY id`. Batch upserts that two writers can run on overlapping keys sort their rows by the conflict key first.
- [M] Rewriting a DB URL keeps its query string (`sslmode`); use the driver's options API, not string splicing.
- [M] Tests run migrations, and compare upgraded vs fresh schema; schema definitions kept in several places are checked for consistency.
- [M] Filter the large fact table on its own column (`a.teammate_id = ANY($n)`), not only on a joined lookup table: the planner does not carry an `= ANY` condition across the join, so the scan reads every row in the window.
- [L] When rows are day buckets, align range bounds to the bucket (floor/ceil to the UTC day) both where days are counted and where rows are selected, so a mid-day bound neither drops a bucket nor dilutes a per-day average.
- [L] A conflict key never depends on a time-varying column default (`DEFAULT CURRENT_DATE`): require the producer to set it, or each later re-fetch inserts a second row and sums double.
- [L] A restate of a full snapshot also clears what the new snapshot omits (a value that dropped to zero and emits no row), or the stale row stays.
- [L] Casting JSON text (`(data->>'k')::numeric`) fails the whole statement on one bad value; guard with `jsonb_typeof` where the producer is external, or pin the type in the producer contract.
- [M] A read that needs only keys and dates selects those columns, never the JSON payload; several sequential per-type reads of one table become one query with an IN list.

## 2. Migrations

- [H] Migration squashes don't rely on `CREATE TABLE IF NOT EXISTS`; verify the squashed files never shipped, or repair/refuse partial states.
- [M] Replayed-on-boot migrations are idempotent and cheap (early exit when done). Runners fail fast (`ON_ERROR_STOP`).
- [M] Destructive or unique-index migrations have a preflight for violating data, with statement and lock timeouts, checking the right DB.
- [H] No `CREATE INDEX` without `CONCURRENTLY` on large hot tables; confirm by EXPLAIN that a query needs it.
- [H] Re-check migration numbers for collisions with the target branch; merge one branch's migrations into one before merge.
- [M] An index-replacing migration verifies the drop is covered (leading columns, direction, partiality), records the new size and write cost, the lock behavior (`DROP INDEX` is ACCESS EXCLUSIVE: `lock_timeout` or a traffic stop), a rollback line and a manual `CONCURRENTLY` runbook step in its header; after a query rewrite, check `pg_stat_user_indexes` for indexes now unused.
- [L] Old migrations referencing dropped columns are guarded; one-release shims get a removal note; headers stay accurate.
- [L] Standard SQL over vendor-specific forms where one exists (`FETCH FIRST n ROWS ONLY`/`OFFSET n ROWS` not `LIMIT`, `CAST(x AS T)` not `::T`), also on new lines of a file that already mixes them; no `GROUP BY` output alias.
- [L] Day boundaries compared in explicit UTC on both bounds; test under a non-UTC TZ.
- [L] Multi-column rows read into named structs, not same-typed positional tuples.

## 3. SQL tests

- [H] Destructive or set-based statements fed parallel arrays (`UNNEST`): test data has several rows whose paired columns all differ, so a misaligned or cross-joined result fails.
- [M] When a query splits rows or groups into ranges by a cut-off (several scans, `UNION ALL` arms), the test puts one item exactly on each cut-off, so a `<`/`<=` slip that drops or double-counts it fails.
- [M] A test that depends on a session setting (time zone, search path, role) asserts the setting is in effect on the same connection right after the query, since it often passes vacuously under the default (a larger pool or a reset hook would silently drop the setting).
- [M] A tie-break test stores the rows so that insertion, id and physical order all favor the wrong winner (or covers both orders), so dropping the tie-break key turns it red.
- [M] When a returned count moves from the database (`rows_affected`) to an application value (input length), a test feeds input where the two can differ (in-batch duplicates, filtered or skipped rows) and pins the exact count.
- [L] DB test suites state the thread limit that fits the test DB's `max_connections` (nextest group or `RUST_TEST_THREADS`).
- [H] DB-backed tests skip loudly or fail through one shared helper; never `Err(_) => return`, never a dev DB fallback.
