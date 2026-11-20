# Hermes Web UI

本仓库是自用的 **Hermes Web UI** 控制台：浏览器前端 + Koa BFF。不包含 Electron 桌面应用和 MCU 固件，也不走上游 PR / Issue 流程。

`ekko-studio` / `ekko-studio-web` 仍是 CLI 别名，方便沿用已有脚本。

## 环境

- Node.js `>= 23`（与 `package.json` 的 `engines` 一致）
- 生产/发布流水线使用 Node `24.22.1`

## 本地开发

```bash
npm install
npm run dev
```

- 前端 Vite：http://localhost:8649
- BFF 服务器：http://localhost:8647（`HERMES_WEB_UI_BACKEND_PORT`，默认 8647）

常用命令：

```bash
npm run harness:check   # 仓库约束检查
npm test                # Vitest
npm run build           # 产物输出到 dist/
```

更细的编码约定见 [DEVELOPMENT.md](./DEVELOPMENT.md)，包边界与状态目录见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

Web UI 状态默认写在 `~/.hermes-web-ui`，可用 `HERMES_WEB_UI_HOME` 或 `HERMES_WEBUI_STATE_DIR` 覆盖。Hermes Agent 自己的数据仍在 Hermes Home（默认 `~/.hermes`），不要和 Web UI 状态混用。

## 打包（与 CI 对齐）

GitHub Release 发布，或手动 `workflow_dispatch` 并指定已有 tag 时，[`.github/workflows/webui-release.yml`](.github/workflows/webui-release.yml) 会构建并挂上三个文件。该 workflow **不会**把该 Release 标成 GitHub latest。

本地等价步骤：

```bash
npm ci --ignore-scripts
npm rebuild node-pty
npm run build
npm prune --omit=dev --no-audit --no-fund
npm run verify:sharp-runtime
```

然后按版本号打 tar 包。CI 实际打进包的内容是：

- `package.json`、`package-lock.json`
- `bin/`
- `dist/`
- `node_modules/`（prune 之后的生产依赖）

产物：

| 文件 | 说明 |
| --- | --- |
| `hermes-web-ui-<version>.tar.gz` | 可部署目录 `webui/` |
| `hermes-web-ui-<version>.tar.gz.sha256` | SHA-256 |
| `hermes-web-ui-<version>.json` | 含 `webUiVersion`、`asset.name/sha256/size` 的 manifest |

解压后进入 `webui/`，用包内 CLI 启动，例如：

```bash
node bin/hermes-web-ui.mjs start
```

## 其它分发

- Docker：根目录 `Dockerfile`、`docker-compose.yml`；镜像发布见 `.github/workflows/docker-publish.yml`
- npm：`npm run pack:npm` 会打出 `ekko-studio` 与 `hermes-web-ui` 两个同版本包（源码 `package.json` 的 `name` 仍是 `ekko-studio`）

## CLI

主命令是 `hermes-web-ui`（`ekko-studio-web` / `ekko-studio` 为别名）：

| 命令 | 说明 |
| --- | --- |
| `hermes-web-ui start [port]` | 后台启动；可用 `--port` |
| `hermes-web-ui client [port]` | 面向远程客户端：关闭 Gateway 自动启动并允许跨域 |
| `hermes-web-ui restart [port]` | 重启 |
| `hermes-web-ui stop` | 停止后台进程 |
| `hermes-web-ui status` | 运行状态 |
| `hermes-web-ui version` | 版本 |
| `hermes-web-ui update` / `upgrade` | 升级到 latest 并重启 |

`start` / `client` 可加 `--no-open`，不自动打开浏览器。

## 常用环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8648` | HTTP 监听端口 |
| `HERMES_WEB_UI_HOME` | `~/.hermes-web-ui` | Web UI 数据目录 |
| `HERMES_WEBUI_STATE_DIR` | 同 `HERMES_WEB_UI_HOME` | 状态目录覆盖 |
| `AUTH_TOKEN` | 自动生成 | Bearer Token |
| `HERMES_HOME` | `~/.hermes` | Hermes 数据目录 |
| `HERMES_BIN` | `hermes` | Hermes CLI 路径 |
| `HERMES_WEB_UI_BACKEND_PORT` | `8647` | 开发时代理到的后端端口 |
| `HERMES_WEB_UI_FRONTEND_PORT` | `8649` | 开发时前端端口 |

## 许可证

[BSL-1.1](./LICENSE)
