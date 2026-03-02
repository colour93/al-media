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
镜像已在运行层安装 `ffmpeg` 与 `ffprobe`，满足服务端缩略图/时长解析能力。
镜像启动命令会先执行数据库迁移（读取 `drizzle/`），再启动服务。

### 构建镜像
- `bun run docker:build`
- 或 `docker build -t colour93/al-media:latest .`

### 精简镜像（不内置 ffmpeg/ffprobe）
- 构建：`bun run docker:build:slim`
- 或 `docker build -f Dockerfile.slim -t colour93/al-media:slim .`
- 该镜像不包含 `ffmpeg`/`ffprobe`，启动时需通过环境变量指定可执行路径，或保证它们在容器 `PATH` 可见：
  - `FFMPEG_BIN`（默认 `ffmpeg`）
  - `FFPROBE_BIN`（默认 `ffprobe`）

### 运行容器
- 默认镜像：`docker run --rm -p 39994:39994 --env-file .env colour93/al-media:latest`
- 精简镜像：`docker run --rm -p 39994:39994 --env-file .env -e FFMPEG_BIN=/path/to/ffmpeg -e FFPROBE_BIN=/path/to/ffprobe colour93/al-media:slim`

如需持久化数据目录，请额外挂载卷并设置 `DATA_PATH`。
如需自定义迁移目录，可设置：
- `MIGRATIONS_DIR`（默认 `drizzle`）
如果视频目录来自 NAS/NFS/CIFS 挂载，建议启用轮询监听，避免 `watch EINVAL`：
- `FILE_WATCH_USE_POLLING=1`
- `FILE_WATCH_INTERVAL=1000`（可选，单位毫秒）

### Docker Compose 模板
- 仓库提供模板：`docker-compose.template.yml`
- 使用方式：
  - 复制为 `docker-compose.yml`
  - 默认镜像启动：`docker compose up -d app`
  - 精简镜像启动：`docker compose --profile slim up -d app-slim`

## 二进制打包（Bun compile）
- 生成二进制：`bun run build:binary`
- 生成发布目录（含前端资源）：`bun run package:binary`

## 数据库迁移
- 生成迁移：`bun run db:generate`
- 执行迁移：`bun run db:migrate`

注意：二进制发布时，目标机器也需要安装 `ffmpeg` 与 `ffprobe`（本项目通过系统 PATH 调用）。
如非 PATH 默认位置，可设置：
- `FFMPEG_BIN`
- `FFPROBE_BIN`

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
