import type { ThumbnailPositionGetter } from '../../hooks/useThumbnailRegistry'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import type { AssetTimelineItem } from '../../services/api'
import { SectionPill } from '../common/SectionPill'
import { TimelineThumbnail } from './TimelineThumbnail'

const HEADER_HEIGHT = 48

/**
 * Parse a YYYY-MM-DD date string as local time (not UTC).
 * This prevents timezone shifts when displaying dates.
 */
function parseDateAsLocal(dateStr: string): Date {
  const datePart = dateStr.split('T')[0] ?? dateStr
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0)
}

interface TimelineHeaderItemProps {
  itemKey: string
  date: string
  height: number
  isPlaceholder?: boolean | undefined
  isBucketPlaceholder?: boolean | undefined
}

/**
 * Header item for the timeline (date section header).
 */
export function TimelineHeaderItem({
  itemKey,
  date,
  height,
  isPlaceholder,
  isBucketPlaceholder,
}: TimelineHeaderItemProps) {
  const headerDate = parseDateAsLocal(date)
  const formattedDate = isPlaceholder
    ? headerDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : headerDate.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

  // Bucket placeholders span the entire bucket height (header + content area)
  // No sticky positioning since they're inside a transformed container
  if (isBucketPlaceholder) {
    const contentHeight = height - HEADER_HEIGHT
    return (
      <div key={itemKey} style={{ height: `${height}px` }}>
        <div
          style={{
            height: `${HEADER_HEIGHT}px`,
          }}
        >
          <SectionPill sticky={false}>{formattedDate}</SectionPill>
        </div>
        {/* Spacer for the content area - takes up remaining bucket height */}
        <div style={{ height: `${contentHeight}px` }} />
      </div>
    )
  }

  // Regular headers - no sticky positioning since they're inside a transformed container
  // The TimelineStickyHeader component handles the sticky date display separately
  return (
    <div
      key={itemKey}
      style={{
        height: `${height}px`,
      }}
    >
      <SectionPill sticky={false}>{formattedDate}</SectionPill>
    </div>
  )
}

interface TimelinePlaceholderRowProps {
  itemKey: string
  height: number
  columnCount: number
  thumbnailSize: number
  /** Whether this bucket is currently being loaded */
  isLoading?: boolean
}

/**
 * Placeholder row for unloaded timeline content.
 */
export function TimelinePlaceholderRow({
  itemKey,
  height,
  columnCount,
  thumbnailSize,
  isLoading = false,
}: TimelinePlaceholderRowProps) {
  return (
    <div
      key={itemKey}
      class="timeline-row timeline-row-placeholder"
      style={{
        height: `${height}px`,
        display: 'flex',
        gap: '1px',
      }}
    >
      {Array.from({ length: columnCount }).map((_, j) => (
        <div
          key={`placeholder-${j}`}
          class={isLoading ? 'placeholder-loading' : ''}
          style={{
            width: `${thumbnailSize}px`,
            height: `${thumbnailSize}px`,
            backgroundColor: 'var(--color-gray-light, #e0e0e0)',
            opacity: isLoading ? 0.5 : 0.3,
          }}
        />
      ))}
    </div>
  )
}

interface TimelineRowProps<A extends AssetTimelineItem> {
  itemKey: string
  height: number
  assets: A[]
  columnCount: number
  thumbnailSize: number
  onAssetClick: (asset: A, info: { position: ThumbnailPosition | null }) => void
  onThumbnailRegister: (assetId: string, getPosition: ThumbnailPositionGetter) => void
  onThumbnailUnregister: (assetId: string) => void
  /** Whether selection mode is active */
  isSelectionMode?: boolean | undefined
  /** Set of selected asset IDs */
  selectedAssetIds?: Set<string> | undefined
  /** Callback when asset selection is toggled */
  onSelectionToggle?: ((assetId: string) => void) | undefined
}

/**
 * Row of thumbnails for the timeline.
 */
export function TimelineRow<A extends AssetTimelineItem>({
  itemKey,
  height,
  assets,
  columnCount,
  thumbnailSize,
  onAssetClick,
  onThumbnailRegister,
  onThumbnailUnregister,
  isSelectionMode = false,
  selectedAssetIds,
  onSelectionToggle,
}: TimelineRowProps<A>) {
  return (
    <div
      key={itemKey}
      class="timeline-row"
      style={{
        height: `${height}px`,
        display: 'flex',
        gap: '1px',
      }}
    >
      {assets.map((asset) => (
        <TimelineThumbnail
          key={asset.id}
          asset={asset}
          size={thumbnailSize}
          onClick={(info) => onAssetClick(asset, info)}
          onRegister={onThumbnailRegister}
          onUnregister={onThumbnailUnregister}
          isSelectionMode={isSelectionMode}
          isSelected={selectedAssetIds?.has(asset.id) ?? false}
          onSelectionToggle={onSelectionToggle}
        />
      ))}

      {/* Add empty placeholders to fill the row */}
      {columnCount - assets.length > 0 &&
        Array.from({ length: columnCount - assets.length }).map((_, j) => (
          <div
            key={`placeholder-${j}`}
            style={{
              width: `${thumbnailSize}px`,
              height: `${thumbnailSize}px`,
            }}
          />
        ))}
    </div>
  )
}
