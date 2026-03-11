# DebugPilot — Task Plan

## Goal
Ship DebugPilot v0.2.0 to VS Code Marketplace as a production-ready extension.

---

## Phase 1: Core Read Tools (MVP) — COMPLETE
- [x] Extension scaffold (TypeScript, esbuild)
- [x] MCP server with Streamable HTTP transport
- [x] `debug_sessions` — list sessions
- [x] `debug_state` — location + source + locals + stack
- [x] `debug_variables` — expand objects
- [x] `debug_evaluate` — eval expressions
- [x] `debug_console` — read output with filtering
- [x] `debug_breakpoints_list` — list breakpoints
- [x] Tests for all Phase 1 tools (56 tests passing)

## Phase 2: Control Tools — COMPLETE
- [x] `debug_continue` — resume execution
- [x] `debug_step` — step over/into/out
- [x] `debug_pause` — pause running session
- [x] `debug_breakpoint_set` — set breakpoints with conditions
- [x] `debug_breakpoint_remove` — remove by ID
- [x] `debug_exception_config` — configure exception breakpoints
- [x] Tests for Phase 2 tools (21 tests across 6 files)

## Phase 3: Marketplace Submission — IN PROGRESS

### Step 3a: Package Metadata (required) — COMPLETE
- [x] README.md
- [x] Logo assets (SVG + PNG)
- [x] LICENSE (MIT)
- [x] Create CHANGELOG.md (v0.1.0 scaffold, v0.2.0 Phase 2 + transport)
- [x] Add `"icon": "assets/icon.png"` to package.json
- [x] Add `"homepage"` to package.json
- [x] Update .vscodeignore: add `!assets/**`

### Step 3b: Validate Package — COMPLETE
- [x] Run `node esbuild.config.mjs` — build passes
- [x] Run `npx tsc --noEmit` — type check passes
- [x] Run `npx vitest run` — 77 tests pass (56 + 21 new)
- [x] Run `npx vsce package --no-dependencies` — .vsix builds (454.98 KB, 12 files)
- [x] Inspect .vsix contents: dist/extension.js, assets/icon.png, README, LICENSE, CHANGELOG present

### Step 3c: Phase 2 Tests — COMPLETE
- [x] debug-continue.test.ts (3 tests)
- [x] debug-step.test.ts (5 tests)
- [x] debug-pause.test.ts (3 tests)
- [x] debug-breakpoint-set.test.ts (3 tests)
- [x] debug-breakpoint-remove.test.ts (3 tests)
- [x] debug-exception-config.test.ts (4 tests)

### Step 3d: Commit & Push — COMPLETE
- [x] Commit marketplace fixes (CHANGELOG, icon, .vscodeignore)
- [x] Commit Phase 2 tests
- [x] Fix publisher to `inkan-link`
- [x] Push to origin/main (5 commits)

### Step 3e: Publish — PENDING (user action)
- [x] Publisher identified: `inkan-link`
- [ ] Run `npx vsce publish` OR upload `debugpilot-0.2.0.vsix` at marketplace
- [ ] Verify extension page on marketplace

## Phase 4: Post-Launch (Future)
- [ ] MCP resources with subscriptions
- [ ] Pre-built prompts (debug_investigate, debug_trace)
- [ ] Multi-runtime validation (Python, Go, Rust)
- [ ] debug_launch / debug_stop
- [ ] debug_run_to

---

## Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | Streamable HTTP (port 45853) | Avoids OAuth/SSE issues, works with all MCP clients |
| Build tool | esbuild | Fast, single-file output for extension host |
| Test framework | vitest | Fast, good TS support |
| Activation | onStartupFinished | Always available, no debug-specific trigger needed |
