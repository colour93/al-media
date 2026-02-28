# AGENTS.md (web/admin)

## 范围
本文件仅覆盖 `web/admin`（管理后台）。
全局需求与后端索引请看根目录 `AGENTS.md`。

## 技术栈
- Rsbuild + React + TypeScript
- TanStack Router（basepath `/admin`）
- TanStack Query
- MUI

## 常用命令
- `bun run dev`：启动管理端（默认 `http://localhost:39995/admin`）
- `bun run build`：生产构建
- `bun run preview`：预览构建
- `bun run lint`：ESLint

## 目录索引
- `src/routes/`：后台页面（主要改动入口）
- `src/api/`：后台 API 封装（默认前缀 `/api/admin`）
- `src/hooks/`：列表查询、CRUD、批量操作 hooks
- `src/components/`：通用后台组件（表格、表单、上传、预览）
- `src/schemas/listSearch.ts`：统一列表页查询参数校验

## 页面路由索引
- `/`：`src/routes/index.tsx`（仪表盘）
- `/login`：`src/routes/login.tsx`
- `/videos`：`src/routes/videos.tsx`
- `/video-files`：`src/routes/video-files.tsx`
- `/strategies`：`src/routes/strategies.tsx`（绑定策略）
- `/file-dirs`：`src/routes/file-dirs.tsx`
- `/tags`：`src/routes/tags.tsx`
- `/tag-types`：`src/routes/tag-types.tsx`
- `/actors`：`src/routes/actors.tsx`
- `/creators`：`src/routes/creators.tsx`
- `/distributors`：`src/routes/distributors.tsx`
- 根鉴权与布局：`src/routes/__root.tsx`

## API 模块索引
- `src/api/videos.ts` 对应 `/api/admin/videos/*`
- `src/api/videoFiles.ts` 对应 `/api/admin/video-files/*`
- `src/api/bindingStrategies.ts` 对应 `/api/admin/binding-strategies/*`
- `src/api/fileDirs.ts` 对应 `/api/admin/file-dirs/*`
- `src/api/tags.ts` 对应 `/api/admin/tags/*`
- `src/api/tagTypes.ts` 对应 `/api/admin/tag-types/*`
- `src/api/actors.ts` 对应 `/api/admin/actors/*`
- `src/api/creators.ts` 对应 `/api/admin/creators/*`
- `src/api/distributors.ts` 对应 `/api/admin/distributors/*`
- `src/api/file.ts` 对应 `/api/admin/file/*`
- `src/api/auth.ts` 对应 `/api/auth/*`

## 高价值改动入口

### 1) 视频管理（增删改、标签/实体关联、推荐位）
- 页面：`src/routes/videos.tsx`
- 数据：`src/hooks/useVideos.ts`
- API：`src/api/videos.ts`

### 2) 视频文件管理（预览、从文件建视频、批量绑定）
- 页面：`src/routes/video-files.tsx`
- 数据：`src/hooks/useVideoFiles.ts`
- API：`src/api/videoFiles.ts`、`src/api/videos.ts`

### 3) 绑定策略（folder/regex + apply）
- 页面：`src/routes/strategies.tsx`
- 数据：`src/hooks/useBindingStrategies.ts`
- API：`src/api/bindingStrategies.ts`

### 4) 文件目录（扫描入口配置）
- 页面：`src/routes/file-dirs.tsx`
- 数据：`src/hooks/useFileDirs.ts`
- API：`src/api/fileDirs.ts`

### 5) 维度实体管理（演员/创作者/发行方/标签/标签类型）
- 页面：
  - `src/routes/actors.tsx`
  - `src/routes/creators.tsx`
  - `src/routes/distributors.tsx`
  - `src/routes/tags.tsx`
  - `src/routes/tag-types.tsx`
- 对应 hooks：`src/hooks/useActors.ts`、`useCreators.ts`、`useDistributors.ts`、`useTags.ts`、`useTagTypes.ts`

### 6) 文件上传与资源展示（头像、缩略图、misc）
- 组件：`src/components/FileUpload/FileUpload.tsx`
- API：`src/api/file.ts`

## 通用页面行为约定
- 列表页 URL 查询参数走 `validateListSearch`：
  - `page`、`pageSize`、`keyword`、`sortBy`、`sortOrder`、`editId`
- 列表渲染统一使用 `src/components/DataTable/DataTable.tsx`
- 表单弹窗统一使用 `src/components/FormDialog/FormDialog.tsx`
- 删除确认统一使用 `src/components/DeleteConfirm/DeleteConfirm.tsx`

## 联调约定
- 默认 `VITE_API_BASE=/api`（见 `src/config/api.ts`）
- 开发代理（`rsbuild.config.ts`）：`/api -> http://localhost:39994`
- 前端 basepath：`/admin`

## 注意事项
- `src/routeTree.gen.ts` 为自动生成文件，不手动修改。
- 需要新增列表筛选/排序时：
  - 先改对应 route `validateSearch`
  - 再改 hook 参数与 API query
  - 最后对齐后端 `src/utils/pagination.ts` 与对应 route/service。
