# AGENTS.md

## 目标与范围
本文件用于快速定位本仓库需求与代码修改入口，覆盖：
- 根目录（后端 API + 扫描入库 + 数据模型）
- `web/app`（C 端）
- `web/admin`（管理端）

原始需求文档：`docs/feature.md`

## 需求摘要（来自 docs/feature.md）
- 多维度实体：创作者、发行方、演员、标签等可关联到视频。
- 基于文件事实：维护 `file_dirs`，扫描视频文件，计算 `uniqueId` 去重，一视频可关联多文件。
- 智能元数据提取：从文件名提取 title/creator/actors/distributors 并匹配落库数据。
- 便捷批量管理：支持批量打标签、批量绑定演员/创作者等。

## 项目结构总览
- `src/`：后端（Bun + Elysia + Drizzle）
- `src/routes/`：API 路由层（`/api/auth`、`/api/admin`、`/api/common`）
- `src/services/`：业务层（扫描、绑定策略、视频与实体管理）
- `src/entities/`：Drizzle 实体定义（各表及关系）
- `web/app/`：C 端（Rsbuild + React + TanStack Router + React Query）
- `web/admin/`：管理端（Rsbuild + React + TanStack Router + React Query）
- `docs/feature.md`：需求原文

## 后端核心索引（根目录）

### 入口与全局行为
- `src/index.ts`：服务启动、监听端口、初始化 `videoFileManager.init()`。
- `src/routes/index.ts`：统一响应封装、全局错误处理、挂载各路由前缀。

### API 路由分层
- `src/routes/auth.ts`：OIDC 登录、回调、`/me`、登出。
- `src/routes/admin/`：管理端接口（需要 admin/owner）。
- `src/routes/common/`：C 端接口（可配置 REQUIRE_LOGIN）。
- `src/middleware/adminAuth.ts`、`src/middleware/commonAuth.ts`：鉴权守卫。

### 文件扫描与入库链路
- `src/services/videoFileManager.ts`
  - 目录 watcher（chokidar）
  - 扫描任务（start/pause/resume/stop/cancel）
  - 文件变化自动入库、自动建视频、自动应用绑定策略
- `src/utils/file.ts`
  - `getFileUniqueId`：头/25%/50%/75%/尾分块 + 文件大小 hash
- `src/services/ffmpegManager.ts`
  - `ffprobe` 获取时长、`ffmpeg` 生成缩略图
- `src/services/fileDirs.ts`
  - 目录增删改后触发 `videoFileManager.init()` 重新挂载监听

### 视频与实体业务
- `src/services/videos.ts`
  - 视频 CRUD、批量绑定（tags/actors/creators）
  - `insertVideoFromVideoFile`、`captureThumbnail`
  - `inferVideoInfo` / `reExtractVideoInfo`（OpenAI 提取）
- `src/services/bindingStrategies.ts`
  - folder/regex 策略管理与应用
- `src/services/videoFiles.ts`
  - 视频文件列表/搜索/详情（含关联视频与目录信息）
- `src/services/{actors,creators,distributors,tags,tagTypes}.ts`
  - 各维度实体 CRUD 与关联查询

### 文件服务与签名播放
- `src/services/file.ts`
  - 文件上传/读取/删除（avatars/thumbnails/misc）
  - 视频签名 URL、Range 流式播放
- `src/utils/videoFileSign.ts`
  - HMAC 签名生成与校验

### 数据模型
- `src/entities/`：所有表定义与关系
- `src/db/schema.ts`：统一导出 schema
- `src/db/index.ts`：数据库连接（`DATABASE_URL`）

重点表（按需求语义）：
- `file_dirs`、`video_files`、`video_file_uniques`、`video_unique_contents`
- `videos`、`video_tags`、`video_actors`、`video_creators`、`video_distributors`
- `actors`、`creators`、`distributors`、`tags`、`tag_types`
- `binding_strategies`、`users`

## 前端索引

### web/app（C 端）
详见：`web/app/AGENTS.md`

- 路由入口：`web/app/src/routes`
- API 封装：`web/app/src/api`
- 查询逻辑：`web/app/src/hooks`
- 布局与卡片：`web/app/src/components`

### web/admin（管理端）
详见：`web/admin/AGENTS.md`

- 路由入口：`web/admin/src/routes`
- API 封装：`web/admin/src/api`
- 页面查询/变更：`web/admin/src/hooks`
- 通用表格与对话框：`web/admin/src/components`

## 需求变更 -> 修改入口（高频）

### 1) 调整“文件扫描/去重/自动入库”
- `src/services/videoFileManager.ts`
- `src/utils/file.ts`
- `src/services/ffmpegManager.ts`
- `src/services/fileDirs.ts`
- 管理端页面：`web/admin/src/routes/file-dirs.tsx`、`web/admin/src/routes/video-files.tsx`

### 2) 调整“从文件名提取元数据（LLM）”
- `src/services/videos.ts`（`inferVideoInfo`、`reExtractVideoInfo`）
- 管理端触发入口：`web/admin/src/routes/videos.tsx`（重提取）

### 3) 调整“绑定策略（folder/regex）”
- 后端：`src/routes/admin/bindingStrategies.ts`、`src/services/bindingStrategies.ts`
- 管理端：`web/admin/src/routes/strategies.tsx`

### 4) 调整“视频推荐/轮播/最新”
- 后端：`src/services/videos.ts`、`src/routes/common/videos.ts`
- C 端：首页与详情：`web/app/src/routes/index.tsx`、`web/app/src/routes/videos.$id.tsx`

### 5) 调整“多维度实体与标签关系”
- 后端：`src/services/{actors,creators,tags,tagTypes,distributors,videos}.ts`
- 管理端：`web/admin/src/routes/{actors,creators,tags,tag-types,distributors,videos}.tsx`
- C 端详情页：`web/app/src/routes/{actors.$id,creators.$id,tags.$id}.tsx`

### 6) 调整“登录鉴权/OIDC/权限”
- 后端：`src/routes/auth.ts`、`src/services/auth.ts`、`src/services/users.ts`、`src/middleware/*.ts`
- 前端登录页：`web/app/src/routes/login.tsx`、`web/admin/src/routes/login.tsx`
- 前端鉴权入口：`web/app/src/routes/__root.tsx`、`web/admin/src/routes/__root.tsx`

## 本地运行与联调

### 端口约定
- 后端 API：`39994`
- 管理端：`39995`（basepath `/admin`）
- C 端：`39996`

### 常用命令
- 根目录后端
  - `bun run dev`
  - `bun run build`
  - `bun run start`
- C 端
  - `cd web/app && bun run dev`
  - `cd web/app && bun run build`
  - `cd web/app && bun run lint`
- 管理端
  - `cd web/admin && bun run dev`
  - `cd web/admin && bun run build`
  - `cd web/admin && bun run lint`

## 环境变量（后端）
- 数据库：`DATABASE_URL`
- 服务地址：`PORT`、`BASE_URL`、`API_BASE_URL`、`APP_URL`、`ADMIN_APP_URL`
- 登录鉴权：`REQUIRE_LOGIN`、`JWT_SECRET`、`COOKIE_DOMAIN`
- OIDC：`OIDC_ISSUER`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`、`OIDC_REDIRECT_URI`、`OIDC_ROLE_CLAIM`
- 文件与签名：`DATA_PATH`、`FILE_SIGN_SECRET`
- 视频处理：`THUMBNAIL_SEEK_SEC`、`THUMBNAIL_WIDTH`
- LLM：`OPENAI_API_KEY`、`OPENAI_BASE_URL`

前端变量：
- `web/app`、`web/admin`：`VITE_API_BASE`（默认 `/api`）

## 修改约定（建议）
- 新增/修改接口时优先保持现有响应结构 `{ success, data/error }`。
- 列表接口沿用 `page/pageSize/sortBy/sortOrder/q` 约定（见 `src/utils/pagination.ts`）。
- 不手改 `web/*/src/routeTree.gen.ts`（由 TanStack Router 插件生成）。
- 需求变化先更新本文件和对应子项目 `AGENTS.md`，保证后续索引可追踪。
