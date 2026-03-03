import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Search } from 'lucide-react';
import { ActorCard } from '../components/ActorCard/ActorCard';
import { CreatorCard } from '../components/CreatorCard/CreatorCard';
import { EntityPreview } from '../components/EntityPreview/EntityPreview';
import { VideoCard } from '../components/VideoCard/VideoCard';
import { useResourceSearch, useResourceTagOptions } from '../hooks/useResources';
import type { ResourceCategory, SearchTag } from '../api/types';

const CATEGORY_OPTIONS: { value: ResourceCategory; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'video', label: '视频' },
  { value: 'actor', label: '演员' },
  { value: 'creator', label: '创作者' },
  { value: 'distributor', label: '发行方' },
  { value: 'tag', label: '标签' },
];

function parseCategory(value: unknown): ResourceCategory {
  const found = CATEGORY_OPTIONS.find((opt) => opt.value === value);
  return found?.value ?? 'all';
}

function dedupeTags(tags: SearchTag[]) {
  const map = new Map<number, SearchTag>();
  for (const tag of tags) {
    map.set(tag.id, tag);
  }
  return Array.from(map.values());
}

export const Route = createFileRoute('/resources')({
  validateSearch: (s: Record<string, unknown>) => {
    const pageRaw = Number(s?.page);
    const pageSizeRaw = Number(s?.pageSize);
    return {
      q: (s?.q as string) ?? '',
      category: parseCategory(s?.category),
      page: Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
      pageSize:
        Number.isInteger(pageSizeRaw) && pageSizeRaw >= 1 && pageSizeRaw <= 100
          ? pageSizeRaw
          : 12,
    };
  },
  component: ResourcesPage,
});

function ResourcesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { q, category, page, pageSize } = Route.useSearch();
  const [searchInput, setSearchInput] = useState(q);
  const [tagInput, setTagInput] = useState('');
  const [includeTags, setIncludeTags] = useState<SearchTag[]>([]);
  const [excludeTags, setExcludeTags] = useState<SearchTag[]>([]);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const includeTagIds = includeTags.map((tag) => tag.id);
  const excludeTagIds = excludeTags.map((tag) => tag.id);

  const queryPage = category === 'all' ? 1 : page;
  const { data, isLoading } = useResourceSearch({
    q: q || undefined,
    category,
    page: queryPage,
    pageSize,
    includeTagIds,
    excludeTagIds,
  });
  const { data: tagOptionsData } = useResourceTagOptions(tagInput, 50);

  const tagOptions = useMemo(() => {
    return dedupeTags([...(tagOptionsData?.items ?? []), ...includeTags, ...excludeTags]);
  }, [tagOptionsData?.items, includeTags, excludeTags]);

  const handleSearch = () => {
    navigate({ search: { q: searchInput || '', category, page: 1, pageSize } });
  };

  const handleCategoryChange = (value: ResourceCategory) => {
    navigate({ search: { q: q || '', category: value, page: 1, pageSize } });
  };

  const handleIncludeChange = (next: SearchTag[]) => {
    const nextInclude = dedupeTags(next);
    const includeIdSet = new Set(nextInclude.map((tag) => tag.id));
    const nextExclude = excludeTags.filter((tag) => !includeIdSet.has(tag.id));
    setIncludeTags(nextInclude);
    setExcludeTags(nextExclude);
    if (page !== 1) {
      navigate({ search: { q: q || '', category, page: 1, pageSize } });
    }
  };

  const handleExcludeChange = (next: SearchTag[]) => {
    const nextExclude = dedupeTags(next);
    const excludeIdSet = new Set(nextExclude.map((tag) => tag.id));
    const nextInclude = includeTags.filter((tag) => !excludeIdSet.has(tag.id));
    setIncludeTags(nextInclude);
    setExcludeTags(nextExclude);
    if (page !== 1) {
      navigate({ search: { q: q || '', category, page: 1, pageSize } });
    }
  };

  const videoData = data?.videos;
  const actorData = data?.actors;
  const creatorData = data?.creators;
  const distributorData = data?.distributors;
  const tagData = data?.tags;

  const currentData =
    category === 'video'
      ? videoData
      : category === 'actor'
        ? actorData
        : category === 'creator'
          ? creatorData
          : category === 'distributor'
            ? distributorData
            : category === 'tag'
              ? tagData
              : undefined;

  const total = currentData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        资源
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="综合搜索：标题 / fileKey / 演员 / 创作者 / 发行方 / 标签"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: { xs: '100%', sm: 360 }, flex: 1 }}
          />
          <Button variant="contained" onClick={handleSearch}>
            搜索
          </Button>
          {category !== 'all' ? (
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>每页</InputLabel>
              <Select
                value={pageSize}
                label="每页"
                onChange={(e) =>
                  navigate({
                    search: { q: q || '', category, page: 1, pageSize: Number(e.target.value) },
                  })
                }
              >
                <MenuItem value={12}>12</MenuItem>
                <MenuItem value={24}>24</MenuItem>
                <MenuItem value={48}>48</MenuItem>
              </Select>
            </FormControl>
          ) : null}
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <ToggleButtonGroup
            value={category}
            exclusive
            size="small"
            onChange={(_, value) => {
              if (value) handleCategoryChange(value as ResourceCategory);
            }}
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <ToggleButton key={opt.value} value={opt.value}>
                {opt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
          <Autocomplete
            multiple
            options={tagOptions}
            value={includeTags}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) =>
              option.tagType?.name ? `${option.tagType.name}: ${option.name}` : option.name
            }
            onInputChange={(_, value) => setTagInput(value)}
            onChange={(_, value) => handleIncludeChange(value)}
            renderInput={(params) => (
              <TextField {...params} size="small" label="标签白名单（保留）" placeholder="输入标签名搜索" />
            )}
          />
          <Autocomplete
            multiple
            options={tagOptions}
            value={excludeTags}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) =>
              option.tagType?.name ? `${option.tagType.name}: ${option.name}` : option.name
            }
            onInputChange={(_, value) => setTagInput(value)}
            onChange={(_, value) => handleExcludeChange(value)}
            renderInput={(params) => (
              <TextField {...params} size="small" label="标签黑名单（排除）" placeholder="输入标签名搜索" />
            )}
          />
        </Box>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : category === 'all' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <CategorySection
            title="视频"
            total={videoData?.total ?? 0}
            onViewAll={() => handleCategoryChange('video')}
          >
            <VideoGrid items={videoData?.items ?? []} />
          </CategorySection>

          <CategorySection
            title="演员"
            total={actorData?.total ?? 0}
            onViewAll={() => handleCategoryChange('actor')}
          >
            <ActorGrid items={actorData?.items ?? []} />
          </CategorySection>

          <CategorySection
            title="创作者"
            total={creatorData?.total ?? 0}
            onViewAll={() => handleCategoryChange('creator')}
          >
            <CreatorGrid items={creatorData?.items ?? []} />
          </CategorySection>

          <CategorySection
            title="发行方"
            total={distributorData?.total ?? 0}
            onViewAll={() => handleCategoryChange('distributor')}
          >
            <DistributorGrid items={distributorData?.items ?? []} />
          </CategorySection>

          <CategorySection
            title="标签"
            total={tagData?.total ?? 0}
            onViewAll={() => handleCategoryChange('tag')}
          >
            <TagGrid items={tagData?.items ?? []} />
          </CategorySection>
        </Box>
      ) : (
        <>
          {category === 'video' ? <VideoGrid items={videoData?.items ?? []} /> : null}
          {category === 'actor' ? <ActorGrid items={actorData?.items ?? []} /> : null}
          {category === 'creator' ? <CreatorGrid items={creatorData?.items ?? []} /> : null}
          {category === 'distributor' ? <DistributorGrid items={distributorData?.items ?? []} /> : null}
          {category === 'tag' ? <TagGrid items={tagData?.items ?? []} /> : null}

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, nextPage) =>
                  navigate({
                    search: { q: q || '', category, page: nextPage, pageSize },
                  })
                }
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function CategorySection({
  title,
  total,
  onViewAll,
  children,
}: {
  title: string;
  total: number;
  onViewAll: () => void;
  children: ReactNode;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
        <Button size="small" onClick={onViewAll}>
          查看全部 ({total})
        </Button>
      </Box>
      {children}
    </Box>
  );
}

function VideoGrid({ items }: { items: import('../api/types').VideoDetail[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">暂无视频结果</Typography>;
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(4, 1fr)',
          lg: 'repeat(5, 1fr)',
          xl: 'repeat(6, 1fr)',
        },
        gap: 2,
      }}
    >
      {items.map((item) => (
        <VideoCard key={item.id} video={item} />
      ))}
    </Box>
  );
}

function ActorGrid({ items }: { items: import('../api/types').SearchActor[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">暂无演员结果</Typography>;
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(4, 1fr)',
        },
        gap: 2,
      }}
    >
      {items.map((item) => (
        <ActorCard key={item.id} actor={item} />
      ))}
    </Box>
  );
}

function CreatorGrid({ items }: { items: import('../api/types').SearchCreator[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">暂无创作者结果</Typography>;
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(4, 1fr)',
        },
        gap: 2,
      }}
    >
      {items.map((item) => (
        <CreatorCard key={item.id} creator={item} />
      ))}
    </Box>
  );
}

function DistributorGrid({ items }: { items: import('../api/types').Distributor[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">暂无发行方结果</Typography>;
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(1, 1fr)',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        },
        gap: 2,
      }}
    >
      {items.map((item) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
          <Typography fontWeight={600}>{item.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            ID: {item.id}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}

function TagGrid({ items }: { items: import('../api/types').SearchTag[] }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">暂无标签结果</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {items.map((item) => (
        <EntityPreview key={item.id} entityType="tag" entity={item} size="md" />
      ))}
    </Box>
  );
}
