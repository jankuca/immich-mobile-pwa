import pluralize from 'pluralize'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { useBucketNavigation } from '../../hooks/useBucketNavigation'
import { useScrollAnchor } from '../../hooks/useScrollAnchor'
import { useSections } from '../../hooks/useSections'
import { useThumbnailRegistry } from '../../hooks/useThumbnailRegistry'
import { type LayoutItem, useTimelineLayout } from '../../hooks/useTimelineLayout'
import { useTimelineScroll } from '../../hooks/useTimelineScroll'
import { useVirtualization } from '../../hooks/useVirtualization'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import type { AssetOrder, AssetTimelineItem } from '../../services/api'
import { SectionPill } from '../common/SectionPill'
import { TimelineThumbnail } from './TimelineThumbnail'

// Target thumbnail size in pixels - columns are calculated to fit this size
const TARGET_THUMBNAIL_SIZE = 130
const MIN_COLUMNS = 3
const HEADER_HEIGHT = 48
const ROW_GAP = 2

export type GetThumbnailPosition = (assetId: string) => ThumbnailPosition | null

/** Bucket metadata for timeline skeleton */
export interface TimelineBucket {
  timeBucket: string
  count: number
}

interface VirtualizedTimelineProps<A extends AssetTimelineItem> {
  assets: A[]
  /** All buckets defining the full timeline structure (for reserving space) */
  allBuckets?: TimelineBucket[]
  /** Set of bucket indices that have been loaded */
  loadedBucketIndices?: Set<number>
  showDateHeaders?: boolean
  hasMoreContent?: boolean
  isLoadingMore?: boolean
  order?: AssetOrder
  /** Whether to include top padding for the page header offset (default: true) */
  includeHeaderOffset?: boolean
  onAssetOpenRequest: (asset: A, info: { position: ThumbnailPosition | null }) => void
  onLoadMoreRequest?: () => void
  /** Callback to provide the getThumbnailPosition function to parent */
  onThumbnailPositionGetterReady?: (getter: GetThumbnailPosition) => void
  /** ID of the asset to anchor/keep visible after orientation changes (e.g., the currently viewed photo) */
  anchorAssetId?: string | null | undefined
  /** Callback when the visible date changes (throttled) */
  onVisibleDateChange?: (date: string) => void
  /** Ref to the scroll container for external control */
  scrollContainerRef?: { current: HTMLDivElement | null }
  /** Callback to request loading a specific bucket by index */
  onBucketLoadRequest?: (bucketIndex: number) => void
  /** Callback to provide the scroll-to-bucket function to parent */
  onScrollToBucketReady?: (scrollToBucket: (bucketIndex: number) => void) => void
}

export function VirtualizedTimeline<A extends AssetTimelineItem>({
  assets,
  allBuckets,
  loadedBucketIndices: _loadedBucketIndices,
  showDateHeaders = true,
  hasMoreContent = false,
  isLoadingMore = false,
  order = 'desc',
  includeHeaderOffset = true,
  onAssetOpenRequest,
  onLoadMoreRequest,
  onThumbnailPositionGetterReady,
  anchorAssetId,
  onVisibleDateChange,
  scrollContainerRef: externalScrollContainerRef,
  onBucketLoadRequest,
  onScrollToBucketReady,
}: VirtualizedTimelineProps<A>) {
  // Group assets into sections by date
  const { sections, sectionsByBucket } = useSections({ assets, showDateHeaders, order })

  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const internalScrollContainerRef = useRef<HTMLDivElement>(null)
  // Use external ref if provided, otherwise use internal
  const scrollContainerRef = externalScrollContainerRef ?? internalScrollContainerRef

  // Thumbnail position registry
  const {
    getThumbnailPosition,
    registerThumbnail: handleThumbnailRegister,
    unregisterThumbnail: handleThumbnailUnregister,
  } = useThumbnailRegistry()

  // Get actual scroll position from DOM (fallback to state for SSR/initial render)
  const getScrollTop = useCallback(() => {
    return scrollContainerRef.current?.scrollTop ?? scrollTop
  }, [scrollTop, scrollContainerRef])

  // Provide the getter to parent component
  useEffect(() => {
    if (onThumbnailPositionGetterReady) {
      onThumbnailPositionGetterReady(getThumbnailPosition)
    }
  }, [getThumbnailPosition, onThumbnailPositionGetterReady])

  // Calculate column count based on container width to maintain square thumbnails
  // Use a reasonable default width for initial calculations before ResizeObserver fires
  const effectiveWidth = containerWidth || 390 // Approximate mobile width as fallback
  const columnCount = Math.max(MIN_COLUMNS, Math.floor(effectiveWidth / TARGET_THUMBNAIL_SIZE))

  // Calculate thumbnail size based on container width and column count
  const thumbnailSize = Math.floor(effectiveWidth / columnCount) - 1 // 1px for gap
  const rowHeight = thumbnailSize + ROW_GAP

  // Use bucket navigation hook for position tracking and navigation
  const {
    bucketPositions,
    totalHeight: skeletonTotalHeight,
    currentBucketIndex,
    scrollToBucket: bucketScrollToBucket,
    updateCurrentBucket,
    getBucketsToLoad,
  } = useBucketNavigation({
    allBuckets,
    sectionsByBucket,
    columnCount,
    rowHeight,
    showDateHeaders,
    scrollContainerRef,
  })

  // Wrap scrollToBucket to also set the adjusting flag
  const scrollToBucket = useCallback(
    (bucketIndex: number) => {
      isAdjustingScrollRef.current = true
      bucketScrollToBucket(bucketIndex)
    },
    [bucketScrollToBucket],
  )

  // Provide scroll-to-bucket function to parent
  useEffect(() => {
    if (onScrollToBucketReady && bucketPositions.length > 0) {
      onScrollToBucketReady(scrollToBucket)
    }
  }, [scrollToBucket, onScrollToBucketReady, bucketPositions.length])

  // Calculate the layout of all items (headers and rows) with their positions
  const { layout, totalHeight } = useTimelineLayout({
    sections,
    sectionsByBucket,
    bucketPositions,
    skeletonTotalHeight,
    columnCount,
    rowHeight,
    thumbnailSize,
    showDateHeaders,
    scrollTop: getScrollTop(),
    viewportHeight,
  })

  // Calculate visible range and spacer heights for flow-based virtualization
  const { visibleItems, topSpacerHeight, bottomSpacerHeight, stickyHeader } = useVirtualization({
    layout,
    totalHeight,
    scrollTop: getScrollTop(),
    viewportHeight,
    rowHeight,
  })

  // Handle scroll anchoring on resize/orientation change
  const { setFirstVisibleAssetId } = useScrollAnchor({
    sections,
    showDateHeaders,
    scrollContainerRef,
    containerRef,
    anchorAssetId,
    onWidthChange: setContainerWidth,
  })

  // Handle scroll events - update scroll position for virtualization
  const { isAdjustingScrollRef } = useTimelineScroll({
    layout,
    bucketPositions,
    currentBucketIndex,
    scrollContainerRef,
    viewportHeight,
    hasMoreContent,
    isLoadingMore,
    anchorAssetId,
    setScrollTop,
    setViewportHeight,
    updateCurrentBucket,
    getBucketsToLoad,
    onBucketLoadRequest,
    onVisibleDateChange,
    onLoadMoreRequest,
    setFirstVisibleAssetId,
  })

  // Parse a YYYY-MM-DD date string as local time (not UTC)
  // This prevents timezone shifts when displaying dates
  const parseDateAsLocal = (dateStr: string): Date => {
    // Extract date portion (handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS..." formats)
    const datePart = dateStr.split('T')[0] ?? dateStr
    const [year, month, day] = datePart.split('-').map(Number)
    // Create date at noon local time to avoid any DST edge cases
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0)
  }

  // Render a virtualized item (header or row) - uses normal flow, not absolute positioning
  const renderItem = (item: LayoutItem<A>) => {
    if (item.type === 'header') {
      // For placeholder headers, show month/year format; for loaded headers, show full date
      // Parse as local time to prevent timezone-related date shifts
      const headerDate = parseDateAsLocal(item.date)
      const formattedDate = item.isPlaceholder
        ? headerDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
        : headerDate.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

      // Bucket placeholders span the entire bucket height (header + content area)
      // We render a sticky header at normal height, plus a spacer for the content area
      if (item.isBucketPlaceholder) {
        const contentHeight = item.height - HEADER_HEIGHT
        return (
          <div key={item.key} style={{ height: `${item.height}px` }}>
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                height: `${HEADER_HEIGHT}px`,
              }}
            >
              <SectionPill sticky={true}>{formattedDate}</SectionPill>
            </div>
            {/* Spacer for the content area - takes up remaining bucket height */}
            <div style={{ height: `${contentHeight}px` }} />
          </div>
        )
      }

      // Regular headers use position: sticky for native browser-controlled stickiness
      return (
        <div
          key={item.key}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: `${item.height}px`,
          }}
        >
          <SectionPill sticky={true}>{formattedDate}</SectionPill>
        </div>
      )
    }

    // Row type - placeholder or loaded
    if (item.isPlaceholder) {
      // Render placeholder thumbnails
      return (
        <div
          key={item.key}
          class="timeline-row timeline-row-placeholder"
          style={{
            height: `${item.height}px`,
            display: 'flex',
            gap: '1px',
          }}
        >
          {Array.from({ length: columnCount }).map((_, j) => (
            <div
              key={`placeholder-${j}`}
              style={{
                width: `${thumbnailSize}px`,
                height: `${thumbnailSize}px`,
                backgroundColor: 'var(--color-gray-light, #e0e0e0)',
                opacity: 0.3,
              }}
            />
          ))}
        </div>
      )
    }

    // Loaded row with actual assets
    const rowAssets = item.assets ?? []
    return (
      <div
        key={item.key}
        class="timeline-row"
        style={{
          height: `${item.height}px`,
          display: 'flex',
          gap: '1px',
        }}
      >
        {rowAssets.map((asset) => (
          <TimelineThumbnail
            key={asset.id}
            asset={asset}
            size={thumbnailSize}
            onClick={(info) => onAssetOpenRequest(asset, info)}
            onRegister={handleThumbnailRegister}
            onUnregister={handleThumbnailUnregister}
          />
        ))}

        {/* Add empty placeholders to fill the row */}
        {columnCount - rowAssets.length > 0 &&
          Array.from({ length: columnCount - rowAssets.length }).map((_, j) => (
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

  return (
    <div
      ref={containerRef}
      class="virtualized-timeline"
      style={{
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {sections.length > 0 || bucketPositions.length > 0 ? (
        <div
          ref={scrollContainerRef}
          class="virtualized-timeline-scroll"
          style={{
            height: '100%',
            overflow: 'auto',
            backgroundColor: 'var(--color-background)',
            paddingTop: includeHeaderOffset ? 'var(--timeline-header-offset)' : undefined,
            paddingBottom: 'var(--timeline-bottom-offset, var(--tabbar-height))',
          }}
        >
          {/* Sticky header overlay - rendered separately from the flow to avoid spacer instability */}
          {showDateHeaders && stickyHeader && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                height: `${HEADER_HEIGHT}px`,
                marginBottom: `-${HEADER_HEIGHT}px`,
                pointerEvents: 'none',
              }}
            >
              <SectionPill sticky={true}>
                {(() => {
                  const headerDate = parseDateAsLocal(stickyHeader.date)
                  return stickyHeader.isPlaceholder
                    ? headerDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
                    : headerDate.toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                })()}
              </SectionPill>
            </div>
          )}

          {/* Top spacer - reserves space for items above visible range */}
          <div style={{ height: `${topSpacerHeight}px` }} />

          {/* Visible items rendered in normal document flow */}
          {visibleItems.map((item) => renderItem(item))}

          {/* Bottom spacer - reserves space for items below visible range */}
          <div style={{ height: `${bottomSpacerHeight}px` }} />

          {/* Loading indicator */}
          {isLoadingMore && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: 'var(--spacing-md)',
                color: 'var(--color-gray)',
              }}
            >
              <div
                class="loading-spinner"
                style={{
                  width: '24px',
                  height: '24px',
                  border: '3px solid var(--color-gray-light)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          )}

          {/* End of content message */}
          {!hasMoreContent && sections.length > 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                color: 'var(--color-gray)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {assets.length} {pluralize('photo', assets.length)}
            </div>
          )}

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <div
          class="timeline-empty"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-gray)',
            backgroundColor: 'var(--color-background)',
          }}
        >
          {assets.length > 0 && sections.length === 0 ? (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 8V12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 16H12.01"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p style={{ marginTop: 'var(--spacing-md)' }}>Error grouping photos by date</p>
            </>
          ) : (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 15L16 10L5 21"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p style={{ marginTop: 'var(--spacing-md)' }}>No photos to display</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
