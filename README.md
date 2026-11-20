# Hermes Web UI

自用的 **Hermes Web UI** 控制台：浏览器里的页面 + 本仓库的 Koa 后端。不包含 Electron 桌面应用和 MCU 固件。

本仓库**不自带** Hermes Agent。对话真正跑在本机的 Hermes Gateway 上。

`ekko-studio` / `ekko-studio-web` 是 CLI 别名，和 `hermes-web-ui` 指向同一脚本。

## 运行逻辑（机器 A）

机器上是三类进程，不要把端口混在一起：

```text
浏览器
   │
   ▼
本项目 Web UI（页面 + 本项目后端）
   │  生产：一个 Node 进程，默认 :8648
   │  开发：两个进程，前端 :8649 → 后端 :8647
   ▼
本机 Hermes Agent（hermes 命令，数据在 ~/.hermes）
   │
   ▼
Hermes Gateway（默认 :8642）  ← 真正跑对话
```

| 端口 | 谁在听 | 什么时候出现 |
| --- | --- | --- |
| **8642** | **Hermes Gateway** | 你手动 `hermes gateway start`，或 Web UI 打开了「Gateway 自动启动」之后 |
| **8647** | **本项目后端**（仅开发） | `npm run dev` 时 nodemon 把 `PORT` 设成 8647 |
| **8649** | **Vite 开发前端** | 仅 `npm run dev`；浏览器打开这个地址，API 被代理到 8647 |
| **8648** | **本项目生产进程**（页面 + API 合在一起） | `hermes-web-ui start` 或 `node dist/server/index.js` |

**8647 不是 Hermes Gateway。** 开发时它是本项目后端；生产不再使用 8647/8649，浏览器只开 **http://localhost:8648**。

### 要不要自己 `hermes gateway start`

1. 在 A 上安装 Hermes Agent，保证终端能执行 `hermes`（或设置 `HERMES_BIN`）。
2. Gateway 要处于运行状态，对话才能走 Hermes。
3. **默认不会自动起 Gateway**（`~/.hermes-web-ui/config.json` 里 `gatewayAutoStart.enabled` 必须为 `true` 才自动拉起）。
4. 因此：要么自己执行 `hermes gateway start`，要么在 Web UI 设置里打开「Gateway 自动启动」。已经在跑则 Web UI 会跳过。

没有 Gateway 时，Web UI 页面仍能打开，但走 Hermes 的对话会失败。

### 前端 / 后端分别是什么

都是 **本项目自己的两层**，不是 Hermes 自带的：

- **前端**：浏览器里的 Vue 页面。源码 `packages/client`，打包进 `dist/client/`。
- **后端**：本项目 Koa。登录、会话、文件、Socket.IO，并调用本机 `hermes` / Gateway。源码 `packages/server`，打包进 `dist/server/index.js`。

不要用 `file://` 直接打开 `dist/client`。必须由后端托管页面并提供 `/api`。

## 环境

- Node.js `>= 23`
- 本机 Hermes Agent（`hermes` 或 `HERMES_BIN`）

Web UI 状态默认 `~/.hermes-web-ui`（`HERMES_WEB_UI_HOME` / `HERMES_WEBUI_STATE_DIR`）。Hermes 数据在 `~/.hermes`，两套目录不要混用。

## 本地开发

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:8649（代理到后端 8647）。

```bash
npm run harness:check
npm test
npm run build          # 只生成 dist/，不是可拷贝的 tar 安装包
```

## `dist/` 是什么（不是安装包）

`npm run build` 每次都会**清空并重写** `dist/`：

| 路径 | 作用 |
| --- | --- |
| `dist/client/` | 给浏览器用的静态页面（由后端托管） |
| `dist/server/index.js` | 生产后端 |
| `dist/skills/` 等 | 随包技能/插件 |

它**不是**拷到另一台机器的完整安装包：没有 `bin/`、没有生产 `node_modules`，而且下一轮 `build` 会把 `dist/` 里的东西删掉重来。所以 **不要把 `hermes-web-ui-*.tar.gz` 放到 `dist/` 里**，会被下次编译冲掉。

产物写到仓库内的 **`release/webui/`**（和 `.github/workflows/webui-release.yml` 一致）。不要把 `hermes-web-ui-*.tar.gz` 放进 `dist/`。

## 打包

`npm run build` **只编译本仓库**，把前端打进 `dist/client/`、后端打进 `dist/server/`。它不会：

- 装好或裁剪 `node_modules`
- 编译 `node-pty` 等原生模块
- 生成可以拷到另一台机器的 `tar.gz`

另一台机器上没有源码、没有 Vite、也没有开发依赖。要能 `node bin/hermes-web-ui.mjs start`，必须带上 **CLI、`dist`、生产 `node_modules`**。完整流程对应 [`.github/workflows/webui-release.yml`](.github/workflows/webui-release.yml)。

### 本地手动打包（可直接复制）

在仓库根目录执行。`npm prune --omit=dev` 会删掉本仓库的开发依赖；打完包后若还要 `npm run dev`，再跑一次 `npm ci`。

**Windows（PowerShell）：**

```powershell
npm ci --ignore-scripts
npm rebuild node-pty
npm run build
npm prune --omit=dev --no-audit --no-fund
npm run verify:sharp-runtime

$version = node -p "require('./package.json').version"
$stage = Join-Path $env:TEMP "hermes-web-ui-package\webui"
Remove-Item -Recurse -Force (Split-Path $stage) -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage, "release\webui" | Out-Null
Copy-Item package.json, package-lock.json $stage
Copy-Item -Recurse bin, dist, node_modules $stage
if (Test-Path README.md) { Copy-Item README.md $stage }
if (Test-Path LICENSE) { Copy-Item LICENSE $stage }

$asset = "hermes-web-ui-$version.tar.gz"
tar -czf "release/webui/$asset" -C (Split-Path $stage) webui
Get-FileHash "release\webui\$asset" -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLower())  $asset" } |
  Set-Content -Encoding ascii "release\webui\$asset.sha256"

Write-Host "packed: $(Resolve-Path release\webui\$asset)"
```

**Linux / macOS：**

```bash
npm ci --ignore-scripts
npm rebuild node-pty
npm run build
npm prune --omit=dev --no-audit --no-fund
npm run verify:sharp-runtime

version="$(node -p "require('./package.json').version")"
asset="hermes-web-ui-${version}.tar.gz"
mkdir -p release/webui /tmp/hermes-web-ui-package/webui
cp package.json package-lock.json /tmp/hermes-web-ui-package/webui/
cp -R bin dist node_modules /tmp/hermes-web-ui-package/webui/
[ -f README.md ] && cp README.md /tmp/hermes-web-ui-package/webui/
[ -f LICENSE ] && cp LICENSE /tmp/hermes-web-ui-package/webui/
tar -czf "release/webui/${asset}" -C /tmp/hermes-web-ui-package webui
shasum -a 256 "release/webui/${asset}" | awk '{print $1 "  " $2}' > "release/webui/${asset}.sha256"
echo "packed: release/webui/${asset}"
```

打完后的文件：

| 文件 | 说明 |
| --- | --- |
| `release/webui/hermes-web-ui-<version>.tar.gz` | 解压后是 `webui/` |
| `release/webui/hermes-web-ui-<version>.tar.gz.sha256` | SHA-256 |

恢复本仓库开发环境：

```bash
npm ci
```

### 每条命令做什么

| 步骤 | 命令 | 作用 |
| --- | --- | --- |
| 1. 按 lock 安装 | `npm ci --ignore-scripts` | 干净安装，且先**不跑**依赖的 install 脚本 |
| 2. 原生模块 | `npm rebuild node-pty` | 终端 PTY 按**当前机器的 OS/CPU** 编一次 |
| 3. 编译 | `npm run build` | 生成 `dist/` |
| 4. 裁依赖 | `npm prune --omit=dev --no-audit --no-fund` | 删掉 vitest/vite 等开发包 |
| 5. 冒烟 | `npm run verify:sharp-runtime` | 确认 prune 之后 `sharp` 还能处理图片 |
| 6. 归档 | 拷进 `webui/` 再 `tar.gz` | 给另一台机器用的安装包 |

打进 tar 的内容：`package.json`、`package-lock.json`、`bin/`、`dist/`、`node_modules/`（第 4 步之后）。可选 `README.md`、`LICENSE`。

只拷 `dist/` **不够**。`sharp`、`node-pty`、`socket.io` 没有打进 `dist/server/index.js`，运行必须靠旁边的 `node_modules`。

**注意：** `node-pty` / `sharp` 是按打包那台机器的系统编的。Windows 打的包拷到 Linux（或反过来）时，解压后要在目标机再执行 `npm rebuild node-pty`，并确认 `sharp` 可用。

也可 `npm run pack:npm` 打 npm tarball；Docker 见根目录 `Dockerfile` / `docker-compose.yml`。那是另一套分发，不是这份 `webui/` tar。

## 在 GitHub 上用 `webui-release.yml` 打包

**够用。** 这份 workflow 就是官方「打 `hermes-web-ui-<version>.tar.gz` 并挂到 Release」的流程。它**不会**在每次 push 时跑，只在下面两种情况触发：

1. **发布 GitHub Release**（`on.release.types: [published]`）  
   在仓库 Releases 里创建一个 tag（例如 `v0.8.29`）并发布。workflow 会 checkout **该 tag**，按上面的 6 步打包，把三个文件挂到这个 Release 上，并且 **`make_latest: false`**（不会把这次标成 GitHub 的 Latest）。
2. **手动跑**（`workflow_dispatch`）  
   GitHub → Actions → **Publish Web UI Artifact to Release** → Run workflow，填已有 **tag 名**。会把产物挂到那个已有 Release 上。没有对应 tag/Release 时不要用这条。

需要：仓库已推到 GitHub、Actions 已启用、有权创建 Release。打包跑在 **ubuntu-22.04 + Node 24.22.1**，打出来的 `node-pty`/`sharp` 是 **Linux x64**。拷到 Windows 目标机要在那边 `npm rebuild node-pty`。

产物在该 Release 的 Assets 里下载，不在仓库的 `dist/`。

## 打包后怎么安装、怎么跑

目标机器同样需要 Node `>= 23` 和已安装的 Hermes Agent。

### 方式一：解压 tar（推荐自用）

```bash
tar -xzf hermes-web-ui-<version>.tar.gz
cd webui
```

Windows 可用 7-Zip 解压后进入 `webui` 目录。

这个目录就是安装根：**不要**只把 `dist` 拷走。之后用下一节的命令启动。

### 方式二：本仓库构建完直接跑

在已经 `npm run build`、且仍有 `node_modules` 的仓库根目录，同样按下一节启动。`npm prune --omit=dev` 之后也可以，开发依赖不是运行所必需。

### 方式三：npm 全局安装（才会在 PATH 里出现 `hermes-web-ui`）

```bash
# 解压后的 webui/，或本仓库根
npm install -g --omit=dev

# 或安装 pack:npm 打出来的包
npm install -g hermes-web-ui-<version>.tgz
```

全局安装后，终端里可以直接打 `hermes-web-ui`。若提示找不到命令，把 npm 全局 bin 加进 PATH（`npm prefix -g` 下的 `bin`，Windows 一般是 `%AppData%\npm`）。

## 怎么运行 `hermes-web-ui` 命令

`hermes-web-ui` **不会**在 `npm run build` 之后自动进系统 PATH。脚本是 `bin/hermes-web-ui.mjs`，必须从安装根调用，或先全局安装。

**不依赖 PATH（任何机器都可用）：**

```bash
# 在 webui/ 或仓库根
node bin/hermes-web-ui.mjs start
```

**本仓库 `npm install` 之后（用项目本地 bin）：**

```bash
npx hermes-web-ui start
```

Windows 也可以：

```bat
node_modules\.bin\hermes-web-ui start
```

**全局安装之后：**

```bash
hermes-web-ui start
hermes-web-ui status
hermes-web-ui stop
```

`start` 会后台拉起 `dist/server/index.js`（`NODE_ENV=production`），默认 **http://localhost:8648**，日志 `~/.hermes-web-ui/server.log`。浏览器打开这个地址即可，不必再单独「运行前端」。

| 命令 | 说明 |
| --- | --- |
| `hermes-web-ui start [port]` | 后台启动，默认 8648；可用 `--port` |
| `hermes-web-ui client [port]` | 给远程浏览器用：关闭 Gateway 自动启动并放宽 CORS |
| `hermes-web-ui restart [port]` | 重启 |
| `hermes-web-ui stop` | 停止 |
| `hermes-web-ui status` | 是否在跑 |
| `hermes-web-ui version` | 版本 |
| `hermes-web-ui reset-default-login` | 重置默认账号 `admin` / `123456` |

`start` / `client` 加 `--no-open` 则不自动打开浏览器。

前台跑（不走 CLI 守护进程）也可以：

```bash
# PowerShell
$env:NODE_ENV = "production"
node dist/server/index.js

# Unix
NODE_ENV=production node dist/server/index.js
```

默认账号可用 `hermes-web-ui reset-default-login` 写成 `admin` / `123456`。Token 在 `~/.hermes-web-ui/.token`。

## 常用环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8648` | 生产 HTTP 端口（页面 + API） |
| `HERMES_WEB_UI_HOME` | `~/.hermes-web-ui` | Web UI 数据目录 |
| `HERMES_WEBUI_STATE_DIR` | 同左 | 状态目录覆盖 |
| `AUTH_TOKEN` | 自动生成 | Bearer Token |
| `HERMES_HOME` | `~/.hermes` | Hermes Agent 数据目录 |
| `HERMES_BIN` | `hermes` | Hermes CLI 路径 |
| `GATEWAY_HOST` | `127.0.0.1` | Hermes Gateway 地址 |
| `GATEWAY_PORT` | `8642` | Hermes Gateway 端口 |
| `HERMES_GATEWAY_URL` | （由 host/port 推导） | Gateway URL 覆盖 |
| `HERMES_WEB_UI_BACKEND_PORT` | `8647` | **仅开发**：Vite 代理到的后端端口 |
| `HERMES_WEB_UI_FRONTEND_PORT` | `8649` | **仅开发**：Vite 端口 |

## 许可证

[BSL-1.1](./LICENSE)
