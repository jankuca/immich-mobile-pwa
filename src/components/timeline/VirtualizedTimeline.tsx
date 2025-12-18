import pluralize from 'pluralize'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { useAnchoredScroll } from '../../hooks/useAnchoredScroll'
import { useBucketNavigation } from '../../hooks/useBucketNavigation'
import { useScrollAnchor } from '../../hooks/useScrollAnchor'
import { useSections } from '../../hooks/useSections'
import { useThumbnailRegistry } from '../../hooks/useThumbnailRegistry'
import type { TimelineBucket } from '../../hooks/useTimelineBucketLoader'
import { type LayoutItem, useTimelineLayout } from '../../hooks/useTimelineLayout'
import { useTimelineScroll } from '../../hooks/useTimelineScroll'
import { useVirtualization } from '../../hooks/useVirtualization'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import type { AssetOrder, AssetTimelineItem } from '../../services/api'
import type { TimelineControllerRef } from './TimelineController'
import { TimelineEmptyState } from './TimelineEmptyState'
import { TimelineHeaderItem, TimelinePlaceholderRow, TimelineRow } from './TimelineItem'
import { TimelineStickyHeader } from './TimelineStickyHeader'

// Target thumbnail size in pixels - columns are calculated to fit this size
const TARGET_THUMBNAIL_SIZE = 130
const MIN_COLUMNS = 3
const ROW_GAP = 2

// Re-export types for consumers
export type { TimelineBucket }
export type { TimelineController, TimelineControllerRef } from './TimelineController'
export type GetThumbnailPosition = (assetId: string) => ThumbnailPosition | null

interface VirtualizedTimelineProps<A extends AssetTimelineItem> {
  /** Loaded assets to display */
  assets: A[]
  /** All buckets defining the full timeline structure (for reserving space) */
  buckets: TimelineBucket[]
  /** Set of bucket indices that are currently loading */
  loadingBucketIndices?: Set<number>
  /** Display options */
  showDateHeaders?: boolean
  order?: AssetOrder
  /** Whether to include top padding for the page header offset (default: true) */
  includeHeaderOffset?: boolean
  /** Callback when user clicks an asset */
  onAssetClick: (asset: A, info: { position: ThumbnailPosition | null }) => void
  /** Callback to request loading a specific bucket by index */
  onBucketLoadRequest?: (bucketIndex: number) => void
  /** ID of the asset to anchor/keep visible after orientation changes (e.g., the currently viewed photo) */
  anchorAssetId?: string | null | undefined
  /** Callback when the visible date changes (throttled) */
  onVisibleDateChange?: (date: string) => void
  /** Controller ref for imperative actions (getThumbnailPosition, scrollToBucket, etc.) */
  controllerRef?: TimelineControllerRef
}

export function VirtualizedTimeline<A extends AssetTimelineItem>({
  assets,
  buckets,
  loadingBucketIndices,
  showDateHeaders = true,
  order = 'desc',
  includeHeaderOffset = true,
  onAssetClick,
  onBucketLoadRequest,
  anchorAssetId,
  onVisibleDateChange,
  controllerRef,
}: VirtualizedTimelineProps<A>) {
  // Group assets into sections by date
  const { sections, sectionsByBucket } = useSections({ assets, showDateHeaders, order })

  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // Flag to mark programmatic scrolls (used to skip side effects in scroll handler)
  const isAdjustingScrollRef = useRef(false)

  // State for virtual scroll position (used for layout calculations)
  // Updated via useTimelineScroll which calls handleAnchoredScroll
  const [virtualScrollTop, setVirtualScrollTop] = useState(0)

  // Track physical scroll position for transform calculation
  // This needs to be in sync with virtualScrollTop for correct positioning
  const [physicalScrollTop, setPhysicalScrollTop] = useState(0)

  // Thumbnail position registry
  const {
    getThumbnailPosition,
    registerThumbnail: handleThumbnailRegister,
    unregisterThumbnail: handleThumbnailUnregister,
  } = useThumbnailRegistry()

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
    updateCurrentBucket,
    getBucketsToLoad,
  } = useBucketNavigation({
    allBuckets: buckets,
    sectionsByBucket,
    columnCount,
    rowHeight,
    showDateHeaders,
    scrollContainerRef,
  })

  // Use anchored scroll for virtual scrolling beyond browser limits
  const {
    getVirtualScrollTop,
    scrollBufferHeight,
    handleScroll: handleAnchoredScroll,
    scrollToAnchor,
  } = useAnchoredScroll({
    bucketPositions,
    totalContentHeight: skeletonTotalHeight,
    scrollContainerRef,
    onAnchorChange: (bucketIndex: number) => {
      // Update current bucket tracking when anchor changes
      updateCurrentBucket(bucketPositions[bucketIndex]?.top ?? 0)
    },
  })

  // Scroll to a specific bucket (for scrubbing)
  const scrollToBucket = useCallback(
    (bucketIndex: number) => {
      isAdjustingScrollRef.current = true
      scrollToAnchor(bucketIndex)
    },
    [scrollToAnchor],
  )

  // Function to refresh scroll position state
  // With anchored scrolling, this re-reads virtual position from the getter
  const refreshScroll = useCallback(() => {
    setVirtualScrollTop(getVirtualScrollTop())
  }, [getVirtualScrollTop])

  // Expose controller functions to parent via ref
  useEffect(() => {
    if (controllerRef) {
      controllerRef.current = {
        getThumbnailPosition,
        scrollToBucket,
        refreshScroll,
        getScrollContainer: () => scrollContainerRef.current,
      }
    }
  }, [controllerRef, getThumbnailPosition, scrollToBucket, refreshScroll])

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
    scrollTop: virtualScrollTop,
    viewportHeight,
  })

  // Calculate visible range and spacer heights for flow-based virtualization
  const { visibleItems, topSpacerHeight, stickyHeader } = useVirtualization({
    layout,
    totalHeight,
    scrollTop: virtualScrollTop,
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
  useTimelineScroll({
    layout,
    bucketPositions,
    currentBucketIndex,
    scrollContainerRef,
    viewportHeight,
    anchorAssetId,
    setScrollTop: setVirtualScrollTop,
    setViewportHeight,
    updateCurrentBucket,
    getBucketsToLoad,
    onBucketLoadRequest,
    onVisibleDateChange,
    setFirstVisibleAssetId,
    isAdjustingScrollRef,
    // Anchored scroll integration
    handleAnchoredScroll,
    setPhysicalScrollTop,
  })

  // Render a virtualized item (header or row) - uses normal flow, not absolute positioning
  const renderItem = (item: LayoutItem<A>) => {
    if (item.type === 'header') {
      return (
        <TimelineHeaderItem
          key={item.key}
          itemKey={item.key}
          date={item.date}
          height={item.height}
          isPlaceholder={item.isPlaceholder}
          isBucketPlaceholder={item.isBucketPlaceholder}
        />
      )
    }

    // Row type - placeholder or loaded
    if (item.isPlaceholder) {
      const isLoading =
        item.bucketIndex !== undefined &&
        loadingBucketIndices !== undefined &&
        loadingBucketIndices.has(item.bucketIndex)
      return (
        <TimelinePlaceholderRow
          key={item.key}
          itemKey={item.key}
          height={item.height}
          columnCount={columnCount}
          thumbnailSize={thumbnailSize}
          isLoading={isLoading}
        />
      )
    }

    // Loaded row with actual assets
    return (
      <TimelineRow
        key={item.key}
        itemKey={item.key}
        height={item.height}
        assets={item.assets ?? []}
        columnCount={columnCount}
        thumbnailSize={thumbnailSize}
        onAssetClick={onAssetClick}
        onThumbnailRegister={handleThumbnailRegister}
        onThumbnailUnregister={handleThumbnailUnregister}
      />
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
            <TimelineStickyHeader
              date={stickyHeader.date}
              isPlaceholder={stickyHeader.isPlaceholder}
            />
          )}

          {/* Scroll buffer - fixed height container for anchored scrolling */}
          <div style={{ height: scrollBufferHeight, position: 'relative' }}>
            {/* Content wrapper - positioned using transform based on virtual scroll position */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                // Transform to position content at the correct virtual scroll position
                // topSpacerHeight = virtual Y of first visible item
                // virtualScrollTop = current virtual scroll position
                // physicalScrollTop = current physical scroll position in the buffer
                // We want: content at virtual topSpacerHeight to appear at physical physicalScrollTop
                transform: `translateY(${topSpacerHeight - virtualScrollTop + physicalScrollTop}px)`,
              }}
            >
              {/* Visible items rendered in normal document flow */}
              {visibleItems.map((item) => renderItem(item))}
            </div>
          </div>

          {/* End of content message */}
          {buckets.length > 0 && sections.length > 0 && (
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
        <TimelineEmptyState hasAssets={assets.length > 0 && sections.length === 0} />
      )}
    </div>
  )
}
