# Review lessons: Rust backend

Part of the review-lessons catalog (see "Catalog and caps" in section 8 of `SKILL.md`). Tag = highest severity seen: [H] High, [M] Medium, [L] Low.

## 1. Rust specifics

- [L] Per-item async blocks return `Result` and the consumer classifies once; erasing errors into `Option` prevents policy.
- [L] Prefer the workspace's existing primitives (`LazyLock`, `DashMap`) over `OnceLock`/`Mutex<HashMap>` with poison branches.
- [L] Process-wide statics for clients, caches and gates move into app state when the codebase already owns state there; runtime-keyed maps and immortal cleanup tasks that exist only for tests are a smell.
- [L] Env-var mutating tests restore via a Drop guard.
- [L] Bind captured state as references before `async move` in `FnMut` closures (E0507).
- [L] `QueryBuilder::push_values` over hand-formatted placeholder lists.
- [L] Dev-only derives under `[dev-dependencies]` with `cfg_attr(test, ...)`, workspace-inherited.
- [L] Non-test helpers that unwrap get the crate-level allow, or return `Result`.
- [L] `impl IntoIterator<Item = &str>` over `&[&str]`; returned counters over `&mut` budget out-params; `..config` struct update over `.clone()`; `if` for one-arm matches; merged identical arms; `sort_by_cached_key` when the sort key allocates; hash `Copy` enums directly, not their `to_string()`.
- [L] Replace positional bool/Option params with an enum or options struct and same-typed tuples with named key types (`type PrKey = (String, i64)`); repeated predicates (`Closed | Cancelled`) become a method; repeated large struct literals get a constructor or `Default` with `..`; fetch an entity once per request.
- [L] `pub(crate)` by default; explicit imports, no deep `use super::*` in guard modules.
- [L] Use `std::sync::Mutex` for maps never locked across an `.await`; `tokio::sync::Mutex` only where the guard spans an await.
- [L] A failed rollback that ends a read-only transaction is logged (`tracing::warn!`), not returned as a request error after all reads succeeded.
- [L] Arithmetic on upstream-supplied integers (header timestamps, counts) uses `saturating_*`/`checked_*` ops: a hostile or broken value must not panic in debug or wrap in release.
- [L] A wall-clock budget next to `tokio::time::sleep` uses `tokio::time::Instant`, so a paused-time test can exercise the real budget instead of a seam.
- [L] rustfmt silently skips a block it cannot fit (long string literal in `format!`): `cargo fmt --check` passes on misindented code, so check new arms by eye or split the literal.
