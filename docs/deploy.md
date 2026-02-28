# 部署与打包流程

## 目标拓扑
- `/` -> `web/app`（C 端）
- `/admin` -> `web/admin`（管理端）
- `/api/*` -> 后端 API 路由

后端已内置静态托管与 SPA fallback：
- C 端：根路径与普通前端路由回退到 `web/app/dist/index.html`
- 管理端：`/admin/*` 前端路由回退到 `web/admin/dist/index.html`
- API：`/api/*` 不会被前端 fallback 覆盖

## 本地构建
- 构建前端（app + admin）：
  - `bun run build:web`
- 构建后端：
  - `bun run build:server`
- 一次性构建全部：
  - `bun run build:all`

启动：
- `bun run start`
- 默认端口 `39994`，可通过 `PORT` 覆盖

## 目录约定
默认读取以下前端构建目录：
- `web/app/dist`
- `web/admin/dist`

可通过环境变量覆盖：
- `APP_DIST_DIR`
- `ADMIN_DIST_DIR`

## Docker 打包
### 构建镜像
- `bun run docker:build`

### 运行容器
- `docker run --rm -p 39994:39994 --env-file .env al-media:latest`

如需持久化数据目录，请额外挂载卷并设置 `DATA_PATH`。

## 二进制打包（Bun compile）
- 生成二进制：`bun run build:binary`
- 生成发布目录（含前端资源）：`bun run package:binary`

发布目录：
- `dist/release/al-media`（可执行文件）
- `dist/release/web/app/*`
- `dist/release/web/admin/*`

运行二进制时，工作目录需包含上述 `web/*` 资源（或通过 `APP_DIST_DIR`/`ADMIN_DIST_DIR` 指向实际路径）。

## 生产环境建议变量
单端口部署（同域）建议：
- `BASE_URL=https://your-domain.com`
- `APP_URL=https://your-domain.com`
- `ADMIN_APP_URL=https://your-domain.com/admin`
- `API_BASE_URL=https://your-domain.com`

如果启用 OIDC，请确保回调地址与实际域名一致。
