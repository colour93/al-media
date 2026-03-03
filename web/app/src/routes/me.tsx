import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type MouseEvent, useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Pagination,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from "@mui/material";
import {
  User,
  LogOut,
  ExternalLink,
  Download,
  Search,
  Heart,
  History,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAuthMe, logout } from "../api/auth";
import { fetchCommonMetadata } from "../api/metadata";
import { VideoCard } from "../components/VideoCard/VideoCard";
import { useFavoriteVideos, useWatchHistory } from "../hooks/useVideos";
import { formatDurationFromSeconds } from "../utils/format";
import {
  type ThemePreference,
  useThemeMode,
} from "../contexts/ThemeModeContext";
import { usePwaInstall } from "../contexts/PwaInstallContext";

export const Route = createFileRoute("/me")({
  validateSearch: (s: Record<string, unknown>) => {
    const pageRaw = Number(s?.page);
    const pageSizeRaw = Number(s?.pageSize);
    const tabRaw = String(s?.tab ?? "favorites");
    const tab = tabRaw === "history" ? "history" : "favorites";
    return {
      tab,
      page: Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
      pageSize:
        Number.isInteger(pageSizeRaw) && pageSizeRaw >= 1 && pageSizeRaw <= 100
          ? pageSizeRaw
          : 12,
      q: typeof s?.q === "string" ? s.q : "",
    };
  },
  beforeLoad: async () => {
    const user = await fetchAuthMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  component: MePage,
});

const canAccessAdmin = (role: string) => role === "owner" || role === "admin";

function formatPlayedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function MePage() {
  const { tab, page, pageSize, q } = Route.useSearch();
  const isFavoritesTab = tab === "favorites";

  const [installingPwa, setInstallingPwa] = useState(false);
  const [pwaMessage, setPwaMessage] = useState("");
  const [searchInput, setSearchInput] = useState(q);
  const { preference, setPreference } = useThemeMode();
  const { isStandalone, canPromptInstall, canInstall, requestInstall } =
    usePwaInstall();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const { data: user } = useQuery({
    queryKey: ["authMe"],
    queryFn: fetchAuthMe,
  });
  const { data: metadata } = useQuery({
    queryKey: ["commonMetadata"],
    queryFn: fetchCommonMetadata,
    enabled: !!user && canAccessAdmin(user.role),
  });
  const {
    data: favoritesData,
    isLoading: favoritesLoading,
    isFetching: favoritesFetching,
  } = useFavoriteVideos(page, pageSize, !!user && isFavoritesTab, {
    q: q || undefined,
  });
  const {
    data: historyData,
    isLoading: historyLoading,
    isFetching: historyFetching,
  } = useWatchHistory(page, pageSize, !!user && !isFavoritesTab, {
    q: q || undefined,
  });

  const handleLogout = async () => {
    await logout();
    queryClient.setQueryData(["authMe"], null);
    navigate({ to: "/login" });
  };

  if (!user) return null;

  const displayName = user.name || user.email || "用户";
  const showAdminLink = canAccessAdmin(user.role) && metadata?.adminPanelUrl;
  let adminSameOrigin = false;
  if (showAdminLink && metadata) {
    try {
      adminSameOrigin =
        new URL(metadata.adminPanelUrl).origin === window.location.origin;
    } catch (error) {
      void error;
    }
  }
  const favorites = favoritesData?.items ?? [];
  const historyItems = historyData?.items ?? [];
  const favoritesTotal = favoritesData?.total ?? 0;
  const historyTotal = historyData?.total ?? 0;
  const activeTotal = isFavoritesTab ? favoritesTotal : historyTotal;
  const activeLoading = isFavoritesTab ? favoritesLoading : historyLoading;
  const activeFetching = isFavoritesTab ? favoritesFetching : historyFetching;
  const activePages = Math.max(1, Math.ceil(activeTotal / pageSize));

  const updateSearch = (
    next: Partial<{
      tab: "favorites" | "history";
      page: number;
      pageSize: number;
      q: string;
    }>,
  ) => {
    navigate({
      search: {
        tab: next.tab ?? tab,
        page: next.page ?? page,
        pageSize: next.pageSize ?? pageSize,
        q: next.q ?? q,
      },
    });
  };

  const handleThemeChange = (
    _: MouseEvent<HTMLElement>,
    next: ThemePreference | null,
  ) => {
    if (!next) return;
    setPreference(next);
  };
  const handleInstallPwa = async () => {
    setPwaMessage("");
    setInstallingPwa(true);
    try {
      const result = await requestInstall();
      if (result === "accepted") {
        setPwaMessage("安装提示已打开，请按系统弹窗完成安装。");
        return;
      }
      if (result === "dismissed") {
        setPwaMessage("已取消安装。");
        return;
      }
      setPwaMessage(
        "当前浏览器未提供安装弹窗，请使用浏览器菜单中的“添加到主屏幕”。",
      );
    } finally {
      setInstallingPwa(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        我的
      </Typography>
      <Paper sx={{ p: 3, mt: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <User size={48} style={{ opacity: 0.5 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {displayName}
              </Typography>
              {user.email && (
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {showAdminLink && (
              <Button
                variant="outlined"
                startIcon={<ExternalLink size={18} />}
                href={metadata!.adminPanelUrl}
                {...(adminSameOrigin
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer" })}
              >
                管理面板
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogOut size={18} />}
              onClick={handleLogout}
            >
              退出登录
            </Button>
          </Box>
        </Box>
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            主题模式
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={preference}
            onChange={handleThemeChange}
          >
            <ToggleButton value="system">系统</ToggleButton>
            <ToggleButton value="light">浅色</ToggleButton>
            <ToggleButton value="dark">深色</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {!isStandalone && canInstall ? (
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                添加到设备
              </Typography>
              <Typography variant="caption" color="text.secondary">
                可安装为应用，从桌面直接打开。
              </Typography>
              {pwaMessage ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {pwaMessage}
                </Typography>
              ) : null}
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={handleInstallPwa}
              disabled={installingPwa}
            >
              {installingPwa
                ? "处理中…"
                : canPromptInstall
                  ? "添加到设备"
                  : "查看添加指引"}
            </Button>
          </Box>
        ) : null}
      </Paper>

      <Paper sx={{ mt: 2, p: { xs: 1.25, md: 2 } }}>
        <Tabs
          value={tab}
          onChange={(_, next: "favorites" | "history") =>
            updateSearch({ tab: next, page: 1 })
          }
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ px: 0.5 }}
        >
          <Tab
            value="favorites"
            icon={<Heart size={16} />}
            iconPosition="start"
            label={`收藏夹${favoritesTotal > 0 ? ` (${favoritesTotal})` : ""}`}
          />
          <Tab
            value="history"
            icon={<History size={16} />}
            iconPosition="start"
            label={`播放历史${historyTotal > 0 ? ` (${historyTotal})` : ""}`}
          />
        </Tabs>

        <Box
          sx={{
            px: { xs: 0.5, md: 1 },
            pt: 1.25,
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
          }}
        >
          <TextField
            size="small"
            placeholder={
              isFavoritesTab ? "搜索收藏视频标题…" : "搜索历史视频标题…"
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateSearch({ page: 1, q: searchInput || "" });
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: { xs: "100%", sm: 280 } }}
          />
          <Button
            variant="outlined"
            onClick={() => updateSearch({ page: 1, q: searchInput || "" })}
          >
            搜索
          </Button>
          {q ? (
            <Button onClick={() => updateSearch({ page: 1, q: "" })}>
              清除
            </Button>
          ) : null}
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>每页</InputLabel>
            <Select
              value={pageSize}
              label="每页"
              onChange={(e) =>
                updateSearch({ page: 1, pageSize: Number(e.target.value) })
              }
            >
              <MenuItem value={12}>12</MenuItem>
              <MenuItem value={24}>24</MenuItem>
              <MenuItem value={48}>48</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ px: { xs: 0.5, md: 1 }, mt: 1.25 }}>
          {activeFetching && !activeLoading ? (
            <LinearProgress sx={{ mb: 1.25 }} />
          ) : null}

          {activeLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : activeTotal === 0 ? (
            <Box sx={{ py: 5 }}>
              <Typography color="text.secondary">
                {isFavoritesTab ? "还没有收藏视频" : "暂无播放历史"}
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(3, minmax(0, 1fr))",
                    md: "repeat(4, minmax(0, 1fr))",
                    lg: "repeat(5, minmax(0, 1fr))",
                    xl: "repeat(6, minmax(0, 1fr))",
                  },
                  gap: { xs: 1.5, md: 2 },
                }}
              >
                {isFavoritesTab
                  ? favorites.map((video) => (
                      <VideoCard key={video.id} video={video} />
                    ))
                  : historyItems.map((item) => {
                      const duration =
                        item.durationSeconds ??
                        item.video.videoDuration ??
                        null;
                      const progressPercent =
                        duration && duration > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (item.progressSeconds / duration) * 100,
                              ),
                            )
                          : 0;
                      const progressText = `看到 ${formatDurationFromSeconds(item.progressSeconds, "--:--")} / ${formatDurationFromSeconds(duration, "--:--")}${item.completed ? "（已看完）" : ""}`;
                      return (
                        <Box key={item.video.id} sx={{ minWidth: 0 }}>
                          <VideoCard video={item.video} showActors={false} />
                          <Paper
                            variant="outlined"
                            sx={{ mt: 0.75, p: 1, borderRadius: 1.5 }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              title={formatPlayedAt(item.lastPlayedAt)}
                              sx={{ display: "block" }}
                            >
                              上次播放：{formatPlayedAt(item.lastPlayedAt)}
                            </Typography>
                            <Box
                              sx={{
                                mt: 0.35,
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                title={progressText}
                                sx={{ display: "block", flex: 1, minWidth: 0 }}
                              >
                                {progressText}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {duration && duration > 0
                                  ? `${progressPercent}%`
                                  : "--"}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={
                                duration && duration > 0 ? progressPercent : 0
                              }
                              sx={{ mt: 0.6 }}
                            />
                          </Paper>
                        </Box>
                      );
                    })}
              </Box>

              {activePages > 1 ? (
                <Box
                  sx={{ display: "flex", justifyContent: "center", mt: 2.5 }}
                >
                  <Pagination
                    count={activePages}
                    page={page}
                    onChange={(_, nextPage) => updateSearch({ page: nextPage })}
                  />
                </Box>
              ) : null}
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
