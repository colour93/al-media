import { Box, Typography } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { getThumbnailUrl } from "../../api/file";
import { EntityPreview } from "../EntityPreview/EntityPreview";
import type { VideoDetail } from "../../api/types";
import {
  formatDurationFromSeconds,
  formatShortPlayCount,
} from "../../utils/format";

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface VideoSidebarCardProps {
  video: VideoDetail;
}

export function VideoSidebarCard({ video }: VideoSidebarCardProps) {
  const navigate = useNavigate();
  const thumbUrl = getThumbnailUrl(video.thumbnailKey);
  const duration = formatDurationFromSeconds(video.videoDuration);
  const fileSize = formatFileSize(video.fileSize);
  const playCount = formatShortPlayCount(video.playCount);
  const metaParts = [duration, fileSize].filter(Boolean).join(" · ");
  const actors = video.actors ?? [];
  const creators = video.creators ?? [];
  const tags = video.tags ?? [];
  const actorPreview = actors.slice(0, 2);
  const creatorPreview = actors.length === 0 ? creators.slice(0, 2) : [];
  const tagPreview =
    actors.length === 0 && creators.length === 0 ? tags.slice(0, 2) : [];
  const hiddenPreviewCount =
    actors.length > 0
      ? Math.max(0, actors.length - actorPreview.length)
      : creators.length > 0
        ? Math.max(0, creators.length - creatorPreview.length)
        : Math.max(0, tags.length - tagPreview.length);

  return (
    <Box
      onClick={() => {
        navigate({
          to: "/videos/$id",
          params: { id: String(video.id) },
        });
      }}
      sx={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 1.5,
        p: 0.75,
        border: "1px solid",
        borderColor: "divider",
        transition: "background-color 0.18s ease, border-color 0.18s ease",
        "@media (hover: hover) and (pointer: fine)": {
          "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
        },
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "108px minmax(0,1fr)",
            sm: "126px minmax(0,1fr)",
          },
          gap: 1,
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            overflow: "hidden",
            borderRadius: 1,
            bgcolor: "action.hover",
          }}
        >
          <Box
            component="img"
            src={thumbUrl || undefined}
            alt={video.title}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </Box>
        <Box
          sx={{
            minWidth: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="body2"
            fontWeight={600}
            title={video.title}
            sx={{
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "2.6em",
            }}
          >
            {video.title}
          </Typography>
          <Box
            sx={{
              mt: 0.25,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              color: "text.secondary",
            }}
          >
            <Eye size={12} />
            <Typography variant="caption" color="inherit">
              {playCount}
            </Typography>
          </Box>
          {metaParts && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              noWrap
            >
              {metaParts}
            </Typography>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          mt: 0.35,
          display: "flex",
          flexWrap: "wrap",
          gap: 0.35,
          alignItems: "center",
        }}
      >
        {actorPreview.map((a) => (
          <EntityPreview
            key={a.id}
            entityType="actor"
            entity={a}
            size="sm"
            disableLink
          />
        ))}
        {creatorPreview.map((c) => (
          <EntityPreview
            key={c.id}
            entityType="creator"
            entity={c}
            size="sm"
            disableLink
          />
        ))}
        {tagPreview.map((t) => (
          <EntityPreview
            key={t.id}
            entityType="tag"
            entity={t}
            size="sm"
            disableLink
          />
        ))}
        {hiddenPreviewCount > 0 ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 0.25 }}
          >
            +{hiddenPreviewCount}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
