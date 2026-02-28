# AGENTS.md (web/app)

## 范围
本文件仅覆盖 `web/app`（C 端用户前台）。
全局需求与后端索引请看根目录 `AGENTS.md`。

## 技术栈
- Rsbuild + React + TypeScript
- TanStack Router（文件路由）
- TanStack Query
- MUI

## 常用命令
- `bun run dev`：启动开发服务（默认 `http://localhost:39996`）
- `bun run build`：生产构建
- `bun run preview`：预览构建
- `bun run lint`：ESLint

## 目录索引
- `src/routes/`：页面路由（核心改动入口）
- `src/api/`：HTTP 封装与接口函数
- `src/hooks/`：Query hooks
- `src/components/`：页面组件（卡片、布局、播放器等）
- `src/config/api.ts`：API 前缀配置

## 页面路由索引
- `/`：`src/routes/index.tsx`
  - 首页：轮播、推荐、最新
- `/videos`：`src/routes/videos.index.tsx`
  - 视频列表 + 搜索 + 分页
- `/videos/$id`：`src/routes/videos.$id.tsx`
  - 视频详情、播放器、侧栏推荐
- `/actors/$id`：`src/routes/actors.$id.tsx`
- `/creators/$id`：`src/routes/creators.$id.tsx`
- `/tags/$id`：`src/routes/tags.$id.tsx`
- `/me`：`src/routes/me.tsx`
- `/login`：`src/routes/login.tsx`
- 根鉴权与布局：`src/routes/__root.tsx`

## API 索引
- `src/api/videos.ts`
  - 对应后端 `/api/common/videos/*`
- `src/api/metadata.ts`
  - 对应后端 `/api/common/metadata`
- `src/api/auth.ts`
  - 对应后端 `/api/auth/*`
- `src/api/entities.ts`
  - 复用管理接口读取实体详情（`/api/admin/*`）
- `src/api/file.ts`
  - 文件 URL 构造（缩略图、头像）
- `src/api/client.ts`
  - 通用 GET 客户端、错误处理与 401 重定向

## 常见需求改动入口

### 1) 首页展示规则（轮播/推荐/最新）
- 页面：`src/routes/index.tsx`
- 数据：`src/hooks/useHomeData.ts`、`src/hooks/useVideos.ts`
- API：`src/api/videos.ts`

### 2) 视频详情页布局/播放器行为
- 页面：`src/routes/videos.$id.tsx`
- 播放器组件：`src/components/MUIPlayer/MUIPlayer.tsx`
- 侧栏卡片：`src/components/VideoSidebarCard/VideoSidebarCard.tsx`

### 3) 实体详情页（演员/创作者/标签）
- 页面：`src/routes/actors.$id.tsx`、`src/routes/creators.$id.tsx`、`src/routes/tags.$id.tsx`
- 数据：`src/hooks/useEntities.ts`
- API：`src/api/entities.ts`

### 4) 登录流程与权限跳转
- 登录页：`src/routes/login.tsx`
- 根路由鉴权：`src/routes/__root.tsx`
- 个人页：`src/routes/me.tsx`
- API：`src/api/auth.ts`

### 5) 卡片样式与实体预览
- 视频卡片：`src/components/VideoCard/VideoCard.tsx`
- 演员卡片：`src/components/ActorCard/ActorCard.tsx`
- 创作者卡片：`src/components/CreatorCard/CreatorCard.tsx`
- 通用实体预览：`src/components/EntityPreview/EntityPreview.tsx`

## 联调约定
- 默认 `VITE_API_BASE=/api`（见 `src/config/api.ts`）。
- 开发代理在 `rsbuild.config.ts`：
  - `/api -> http://localhost:39994`
  - `/admin -> http://localhost:39995`

## 注意事项
- `src/routeTree.gen.ts` 为自动生成文件，不手动修改。
- 页面数据优先走 hooks 层，不在页面直接散落 fetch。
- 若改了后端返回结构，同步更新 `src/api/types.ts` 与对应 hook/page。
