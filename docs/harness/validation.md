# Validation Guide

Task reports and temporary verification files belong outside all checkouts.
`npm run harness:check` includes the read-only artifact guard; use
`npm run artifacts:check` for a standalone check and
`npm test -- tests/harness/task-artifacts.test.ts` when changing the policy.
See [task artifacts](task-artifacts.md) for report defaults, exemptions and limits.

The legacy automated tests and fixtures have been removed. Every new feature
must include small, focused tests; run the relevant files locally. See
`tests/README.md`.
Do not restore full coverage, browser sweeps or cross-platform test matrices as a
routine requirement.

## Always Run Locally

```bash
npm run harness:check
npm run build
```

For a new feature, add and run focused Vitest tests for that behavior. New browser
journeys must also have focused Playwright tests, run locally.
The generic test commands allow an empty suite during the reset; existing
assertions still fail. This does not exempt new features from adding tests.

## Keep new tests small

- Cover behavior with local fixtures, mocked external APIs/sockets and temporary state.
- Keep setup local to the feature; avoid loading complete business runtimes for
  simple cases and duplicating source-level architecture checks.
- Avoid exact source-string/CSS assertions and exhaustive OS/theme/viewport products.
- Test and E2E CI automatically run all current Vitest and Playwright tests;
  adding new feature tests does not require editing either workflow.
- For workflow changes, run `actionlint` when available. For dependency changes,
  run `npm ci --ignore-scripts` and keep the lockfile synchronized.

## Managed MCP launch environment

Every MCP definition injected by Studio (Hermes, Ekko, or Coding Agent) must
include `ELECTRON_RUN_AS_NODE: '1'` in that MCP subprocess's `env`. Independent
Node ignores the flag; the Electron executable fallback requires it to execute
the MCP script instead of opening another desktop instance. External Gateway
processes may not inherit the desktop server's environment.

`npm run harness:check` inspects all three configuration factories. New managed
MCP injection paths must be added to that check. Keep configuration comparison
and migration aware of the flag so previously injected entries are repaired;
do not overwrite user-owned MCP definitions or globally enable Node mode for
the Web UI process. Validate changes with the MCP injection and launch tests.

## CI Mapping

- Build (`build.yml`) runs `npm run harness:check` and the production build.
- Test (`test.yml`) runs `npm test` and reports its own Test check.
- E2E (`playwright.yml`) runs `npm run test:e2e` across four Chromium shards,
  each with one worker. Shards finish independently after failures and upload
  blob reports plus available screenshots/traces. A final `E2E` check merges
  reports into one HTML artifact and requires all four shards and reports to
  succeed. Chromium is installed only when browser test files are present.
- All three workflows run independently on pushes to `main`. Test and E2E also
  support manual dispatch. Any test failure fails its own check. Coverage is not
  required.
- The old coding-agent, P2P and desktop-isolation test matrices remain removed.
- The NPM lockfile workflow still verifies dependency lockfile synchronization.
- Web UI release and Docker publishing remain unchanged.

## Web UI packaging

Published GitHub Releases trigger Web UI artifact packaging and Docker image
publishing. Those workflows must keep the GitHub Release out of latest.

## Failure Handling

When a command fails:

1. Read the first actionable error, not just the final stack trace.
2. Check whether the failure indicates missing context, missing test coverage,
   or a missing mechanical rule.
3. Fix the product bug when there is one.
4. Update docs or `scripts/harness-check.mjs` when the same class of mistake
   should be prevented next time.

## DSH module boundary

DSH source discovery, Web composition, plugin commands, permission policy, ACP
lifecycle and protocol translation belong in
`packages/server/src/modules/coding-agents/services/dsh/`. Shared registry and
runtime files may pass configuration and generic callbacks, but must not own
DSH Web patches, permission defaults or ACP construction. DSH modules receive
platform helpers rather than importing the shared agent registry.
`npm run harness:check` runs `scripts/dsh-module-harness.mjs` to enforce this.

For Web/ACP adapter upgrades, verify supported installed DSH versions, including new/resumed presets,
scoped/global model routing, Web bundle tool execution, child inheritance and
unrestricted filesystem/shell access. Do not reject an otherwise compatible
installation by version number or whole-file hash. Validate the required adapter integration points and dependencies before
writing the private copy, and report the specific missing/ambiguous capability.
Keep the source hash as diagnostic metadata. Test an unlisted version with an
unrelated artifact change as well as incompatible integration points.

DSH plugin management has two client tabs under `components/coding-agents/dsh`
and one DSH API module under `api/coding-agents/dsh.ts`. Shared views may render
the entry component; they must not implement DSH transport or plugin forms.
The harness rejects obsolete `managedPluginPatches` / `getDshPluginStore` runtime
references. Keep native profile operations, the owned settings host and plugin
adapters in server `services/dsh`.

For new settings features, add focused tests for the new behavior and inspect the
real native slot through the production HTTP/WebSocket transport from isolated
state. Verify form saving, engine-dependent fields, tab navigation and native
package removal as applicable.

For packaging changes run the Web build. The slot browser code must also be exercised from a minified server
bundle; runtime serialization must not capture build-generated helper closures.

The DSH Agent presets page is a Studio Vue component, separate from the native
plugin configuration iframe. Preset operations stay in `services/dsh/agent-presets.ts`
and use the existing management host. For new preset features, verify native RPC,
source directory persistence, default updates, restart retention, read-only
shipped presets and plugin UI startup with isolated state.

For DSH chat, group-member and workflow modes, keep the selector and roster API
in the DSH client module, and validation/ACP metadata in `services/dsh`. Shared
chat code may carry and store only the generic preset identifier. For new preset
behavior, add focused tests and verify a non-default preset, session tool
isolation, resume and default changes.

For new shared Coding Agent skill permissions, add focused tests for read-only
shared aliases, rejected deletion without Hermes fallback and writable DSH-private
skills. Register native skill formats from bootstrap; agent modules must not
import another agent's implementation.

## Plugin development documentation

When Studio changes plugin structures, context capabilities or return contracts,
directly edit the relevant Markdown under `packages/plugin-sdk/docs` in the same
change. Explain compatibility or defaults in the affected section. The scaffolder
copies these guides and SDK types into each new project; there is no documentation
generation command, digest or change-record bookkeeping.

`npm run harness:check` and `npm run build` require the guides/types and inspect
Git changes: SDK edits must include architecture, context or return documentation.
Local checks inspect staged/unstaged/untracked work; Build CI uses the PR base or
push-before commit with full checkout history. Source archives without Git can
only check file presence. This detects missing companion documentation, not its
semantic correctness; reviewers and boundary tests must assess that.

The generated project harness checks declared fields, model references and required
files. Markdown remains directly editable. Run the focused tests when changing
this flow:

`npm test -- tests/server/studio-plugin-harness.test.ts tests/server/studio-plugin-development.test.ts tests/server/studio-plugin-manifest.test.ts`

Verify the packed CLI creates a standalone project with docs, SDK, harness and
working tests from a node_modules layout.
