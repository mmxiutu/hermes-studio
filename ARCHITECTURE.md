# Architecture

Hermes Web UI is a TypeScript monorepo that ships a self-hosted web console
and Koa backend. It integrates Ekko Agent, Hermes Agent, and coding agents for
chat, coding, and workflows.

## Package Boundaries

| Area | Path | Responsibility |
| --- | --- | --- |
| Client | `packages/client/src` | Vue UI, routing, Pinia stores, API wrappers, i18n, browser-visible state. |
| Server | `packages/server/src` | HTTP API, auth, Socket.IO, SQLite stores, file access, Hermes runtime integration. |
| Ekko Agent | `packages/ekko-agent` | Canonical Ekko runtime, profile facade, providers, tools, memory, skills, conversations, and package API. |
| Tests | `tests` | Required focused tests for new features; the legacy suite has been removed. |
| CI | `.github/workflows` | Independent Build, Test and E2E checks, lockfile, Web UI release, and Docker publishing. |

## Request Flow

1. The browser loads the Vite-built client from the Koa server.
2. Client modules call API helpers from `packages/client/src/api`.
3. Server routes in `packages/server/src/modules/*/routes` wire HTTP paths to controllers.
4. Controllers validate request concerns and delegate reusable behavior to services.
5. Services own side effects: files, SQLite, Hermes profiles, subprocesses, bridges, and credentials.
6. Long-running chat and group-chat flows use Socket.IO namespaces managed by server services.

Keep each layer narrow. Routes should not grow business logic, and client code
should not duplicate server persistence rules.

## State And Data Ownership

- Web UI state defaults to `~/.hermes-web-ui` through `config.appHome`.
- `HERMES_WEB_UI_HOME` and `HERMES_WEBUI_STATE_DIR` override Web UI state location.
- Hermes Agent state lives under Hermes profile directories and must stay distinct from Web UI state.
- Uploads default to `config.uploadDir`, which is derived from the Web UI home unless `UPLOAD_DIR` is set.
- Runtime data directories must also live under the Web UI home, not beside built `dist` assets.
- Profile-scoped Hermes data should use existing profile helpers instead of manually joining paths.
- Studio Provider state is isolated by account under `providers/users/<user-id>`; all of an account's Profiles share its Provider records, credentials, catalog and internal gateway key. Profile files retain import provenance and runtime model selections only.

## Server Structure

Server code is separated by business ownership under `modules/studio`,
`modules/hermes`, `modules/ekko`, and `modules/coding-agents`; concrete module
composition belongs in `bootstrap`.
See `docs/harness/server-module-boundaries.md` for the complete target tree,
ownership decisions, allowed dependency matrix, and migration rules.

- Module `routes/` register HTTP entry points; `sockets/` own Socket.IO transports.
- Module `controllers/` handle request-level behavior.
- Module `services/` own reusable IO, domain behavior, processes, and integrations.
- Studio `repositories/` and `infrastructure/` own application persistence.
- Studio `middleware/legacy-app-api.ts` is the only released App URL compatibility map.
- Plugin Agent IDs use `plugin:<plugin-id>/<agent-id>` and retain that identity in chat, group chat, workflow and usage records. Studio owns registration, per-user/Profile run contexts and transport; plugins own their engine and settings UI. Bootstrap adapts existing Coding Agent management and model proxies into the shared Studio registry, preserving native runtime dispatch and released APIs. See `docs/plugins.md` for the runtime contract.
- Independent plugin projects are registered by `ekko-studio plugins` under the Web UI home in `plugins/development`. Registration does not execute code. Administrator activation starts host-owned source watching, optional builds and snapshot replacement through the ordinary PluginManager; project sources stay outside the Studio checkout. See `docs/plugins.md`.
- Studio does not bundle or automatically install OMP. It is installed and updated independently through the plugin center or a development link. Existing installations keep their package snapshots and data. The generic `plugins/builtin` catalog is currently empty; demo packages live only in `tests/fixtures/plugins`. Stable `ctx.paths.dataDir` holds plugin-owned engine files independently of package versions, and Studio supplies scoped model proxies through the existing Agent contract.

Architecture rules:

- Register local API routes before proxy catch-all routes.
- Keep auth behavior under `packages/server/src/modules/studio/services/auth`.
- Prefer `execFile` or `spawn` with argument arrays over shell command strings.
- Use structured file and YAML/JSON parsers when editing structured data.

## Client Structure

- `views/` contains route-level screens.
- `components/` contains reusable UI.
- `stores/` contains Pinia state.
- `api/` contains HTTP clients and should use `packages/client/src/api/client.ts`.
- `i18n/` contains locale messages for user-facing strings.
- `styles/` contains global styling and theme primitives.

Frontend rules:

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Use existing Naive UI patterns before adding new UI conventions.
- Add visible text to all locale files.
- Keep component styles scoped unless the style is intentionally global.

## Web UI Release Flow

- Pull requests run the repository harness and web UI build in `.github/workflows/build.yml`.
- Published GitHub Releases run Web UI artifact packaging (`.github/workflows/webui-release.yml`)
  and Docker image publishing without marking the release as GitHub latest.

Studio owns imported Provider configuration under the authenticated user's
`providers/users/<id>` directory in the application home. Hermes receives an
`ekkostudio` Provider and qualified model IDs for primary inference. Existing
auxiliary, MoA, fallback and delegation settings retain their native configuration
and credentials; only slots edited in Studio are projected to the gateway. The
page continues to use logical Provider/model names. See [Model API](docs/model-api.md)
for routing, migration boundaries and protocol support.

Hermes, Ekko and scoped Coding/plugin Agents share the model gateway. Ingress
adapters handle Responses, Chat Completions, Anthropic Messages and Gemini
Contents. Bootstrap composes the existing protocol codecs with the Studio account
store, upstream authentication and transport. Run credentials never authenticate
management APIs. Studio exchanges Copilot OAuth credentials itself, without
installing a Hermes plugin for the gateway's inference path. Native configurations
kept for untouched auxiliary models retain their previous behavior.

## Validation Surface

The minimum mechanical harness is:

- `npm run harness:check` for repository docs, workflow, and package-script invariants.
- Focused `npm run test -- <file>` for each new feature's logic.
- Focused `npm run test:e2e -- <file>` for new browser journeys.
- Independent Test (`test.yml`) and E2E (`playwright.yml`) workflows run all
  current Vitest and Playwright tests. Build (`build.yml`) runs the harness and
  production build. Each workflow reports its own status and can fail independently.
- Empty suites are allowed during the reset, without waiving the requirement to
  test new features.
- CI does not require blanket coverage or browser shards.
- `npm run build` for type checking and production bundles.

See `docs/harness/validation.md` for change-specific commands.
