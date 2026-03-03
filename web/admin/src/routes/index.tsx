import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import { Clapperboard, Film, LayoutDashboard, PlayCircle, Users } from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboard';
import type { DashboardTimeUnit } from '../api/types';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

type TrendMetric = 'videos' | 'videoFiles' | 'playCount' | 'users';

const scanStatusLabelMap: Record<string, string> = {
  pending: '等待中',
  processing: '索引中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
  aborted: '已取消',
  stopped: '已停止',
};

function formatScanStatus(status?: string): string {
  if (!status) return '未开始';
  return scanStatusLabelMap[status] ?? status;
}

function formatInferTaskStatus(status?: string): string {
  if (status === 'processing') return '进行中';
  if (status === 'paused') return '已暂停';
  return '空闲';
}

function formatReencodeTaskStatus(status?: string): string {
  if (status === 'processing') return '进行中';
  return '空闲';
}

function formatShortNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(Math.floor(value));
}

function DashboardLineChart(props: {
  title: string;
  color: string;
  metric: TrendMetric;
  points: Array<{
    label: string;
    videos: number;
    videoFiles: number;
    playCount: number;
    users: number;
  }>;
}) {
  const { title, color, metric, points } = props;
  const width = 640;
  const height = 220;
  const paddingX = 26;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;
  const values = points.map((p) => p[metric]);
  const maxValue = Math.max(1, ...values);
  const minValue = 0;
  const xStep = points.length > 1 ? chartW / (points.length - 1) : chartW;
  const coords = points.map((point, idx) => {
    const x = paddingX + idx * xStep;
    const raw = point[metric];
    const normalized = maxValue === minValue ? 0 : (raw - minValue) / (maxValue - minValue);
    const y = paddingY + chartH - normalized * chartH;
    return { x, y, value: raw };
  });
  const linePath = coords
    .map((coord, idx) => `${idx === 0 ? 'M' : 'L'} ${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(' ');
  const areaPath = coords.length
    ? `${linePath} L ${(paddingX + (coords.length - 1) * xStep).toFixed(2)} ${(paddingY + chartH).toFixed(2)} L ${paddingX.toFixed(2)} ${(paddingY + chartH).toFixed(2)} Z`
    : '';

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: '100%', height: 220, display: 'block' }}>
          <line
            x1={paddingX}
            y1={paddingY + chartH}
            x2={paddingX + chartW}
            y2={paddingY + chartH}
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={paddingY}
            x2={paddingX}
            y2={paddingY + chartH}
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth="1"
          />
          {areaPath ? (
            <path d={areaPath} fill={color} fillOpacity="0.14" />
          ) : null}
          {linePath ? (
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" />
          ) : null}
          {coords.map((coord, idx) => (
            <circle
              key={idx}
              cx={coord.x}
              cy={coord.y}
              r="2.8"
              fill={color}
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </Box>
      </Box>
      <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {points[0]?.label ?? '-'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          峰值 {formatShortNumber(maxValue)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {points[points.length - 1]?.label ?? '-'}
        </Typography>
      </Box>
    </Paper>
  );
}

function DashboardPage() {
  const [unit, setUnit] = useState<DashboardTimeUnit>('day');
  const span = unit === 'day' ? 30 : 12;
  const { data, isLoading } = useDashboardStats(unit, span);

  const metricCards = useMemo(
    () => [
      {
        key: 'videos',
        title: '视频总量',
        value: formatShortNumber(data?.totals.videos ?? 0),
        icon: <Clapperboard size={18} />,
      },
      {
        key: 'videoFiles',
        title: '视频文件总量',
        value: formatShortNumber(data?.totals.videoFiles ?? 0),
        icon: <Film size={18} />,
      },
      {
        key: 'playCount',
        title: '累计播放量',
        value: formatShortNumber(data?.totals.playCount ?? 0),
        icon: <PlayCircle size={18} />,
      },
      {
        key: 'users',
        title: '用户总量',
        value: formatShortNumber(data?.totals.users ?? 0),
        icon: <Users size={18} />,
      },
    ],
    [data?.totals.playCount, data?.totals.users, data?.totals.videoFiles, data?.totals.videos]
  );

  const scanTask = data?.scanTask ?? null;
  const inferTask = data?.inferTask ?? null;
  const reencodeTask = data?.reencodeTask ?? null;
  const scanProgressPercent =
    scanTask && scanTask.totalFileCount > 0
      ? Math.min(100, Math.floor((scanTask.currentFileCount / scanTask.totalFileCount) * 100))
      : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={600}>
          仪表盘
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={unit}
          onChange={(_, next: DashboardTimeUnit | null) => {
            if (next) setUnit(next);
          }}
        >
          <ToggleButton value="day">按天</ToggleButton>
          <ToggleButton value="week">按周</ToggleButton>
          <ToggleButton value="month">按月</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isLoading && !data ? (
        <Paper sx={{ p: 5, mt: 2, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            正在加载仪表盘数据…
          </Typography>
        </Paper>
      ) : (
        <>
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {metricCards.map((card) => (
              <Paper key={card.key} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                  {card.icon}
                  <Typography variant="body2">{card.title}</Typography>
                </Box>
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.75 }}>
                  {card.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            <DashboardLineChart
              title="视频新增趋势"
              color="#0284c7"
              metric="videos"
              points={data?.points ?? []}
            />
            <DashboardLineChart
              title="视频文件新增趋势"
              color="#ea580c"
              metric="videoFiles"
              points={data?.points ?? []}
            />
            <DashboardLineChart
              title="播放量趋势（按最后播放时间聚合）"
              color="#16a34a"
              metric="playCount"
              points={data?.points ?? []}
            />
            <DashboardLineChart
              title="用户新增趋势"
              color="#7c3aed"
              metric="users"
              points={data?.points ?? []}
            />
          </Box>

          <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 2.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <LayoutDashboard size={18} />
              <Typography variant="subtitle1" fontWeight={700}>
                当前任务状态
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr', xl: '1fr 1fr 1fr' },
                gap: 2,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body1" fontWeight={600}>
                    索引任务
                  </Typography>
                  <Chip size="small" label={formatScanStatus(scanTask?.status)} color={scanTask?.status === 'processing' ? 'warning' : 'default'} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {scanTask
                    ? `目录：${scanTask.dir?.path ?? '-'} · 进度：${scanTask.currentFileCount}/${scanTask.totalFileCount || '-'}`
                    : '当前无索引任务'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {scanTask?.currentFile ? `当前文件：${scanTask.currentFile}` : '当前文件：-'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {scanTask?.error ? `错误：${scanTask.error}` : `进度百分比：${scanProgressPercent}%`}
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body1" fontWeight={600}>
                    推理任务
                  </Typography>
                  <Chip size="small" label={formatInferTaskStatus(inferTask?.status)} color={inferTask?.status === 'processing' ? 'warning' : 'default'} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  排队：{inferTask?.waitingCount ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {inferTask?.current
                    ? `当前目标：${inferTask.current.target}`
                    : inferTask?.lastFinishedAt
                      ? `最近完成：${new Date(inferTask.lastFinishedAt).toLocaleString()}`
                      : '暂无推理任务记录'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {inferTask?.lastError ? `最近错误：${inferTask.lastError}` : '最近错误：-'}
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body1" fontWeight={600}>
                    重编码任务
                  </Typography>
                  <Chip
                    size="small"
                    label={formatReencodeTaskStatus(reencodeTask?.status)}
                    color={reencodeTask?.status === 'processing' ? 'warning' : 'default'}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  排队：{reencodeTask?.waitingCount ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {reencodeTask?.current
                    ? `当前文件：${reencodeTask.current.sourceFileKey}`
                    : reencodeTask?.lastFinishedAt
                      ? `最近完成：${new Date(reencodeTask.lastFinishedAt).toLocaleString()}`
                      : '暂无重编码任务记录'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {reencodeTask?.lastOutputFileKey
                    ? `最近输出：${reencodeTask.lastOutputFileKey}`
                    : reencodeTask?.lastError
                      ? `最近错误：${reencodeTask.lastError}`
                      : '最近输出：-'}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              时间范围：{data ? `${new Date(data.from).toLocaleDateString()} 至 ${new Date(data.to).toLocaleDateString()}` : '-'}
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  );
}
