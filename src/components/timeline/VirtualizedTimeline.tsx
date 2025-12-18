import pluralize from 'pluralize'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import type { AssetOrder, AssetTimelineItem } from '../../services/api'
import { SectionPill } from '../common/SectionPill'
import type { ThumbnailPositionGetter } from './TimelineThumbnail'
import { TimelineThumbnail } from './TimelineThumbnail'

// Target thumbnail size in pixels - columns are calculated to fit this size
const TARGET_THUMBNAIL_SIZE = 130
const MIN_COLUMNS = 3
const HEADER_HEIGHT = 48
const ROW_GAP = 2
// Buffer rows above and below viewport for smooth scrolling
const BUFFER_ROWS = 5

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

interface TimelineSection<A extends AssetTimelineItem> {
  date: string
  assets: A[]
}

// Layout item represents either a header or a row of assets
interface LayoutItem<A extends AssetTimelineItem> {
  type: 'header' | 'row'
  key: string
  top: number
  height: number
  date: string
  // For rows
  assets?: A[]
  rowIndex?: number
  // For placeholder items (unloaded buckets)
  isPlaceholder?: boolean
  // For collapsed bucket placeholders (single item spanning entire unloaded bucket far from view)
  isBucketPlaceholder?: boolean
}

export function VirtualizedTimeline<A extends AssetTimelineItem>({
  assets,
  allBuckets,
  loadedBucketIndices,
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
  const [sections, setSections] = useState<TimelineSection<A>[]>([])
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const internalScrollContainerRef = useRef<HTMLDivElement>(null)
  // Use external ref if provided, otherwise use internal
  const scrollContainerRef = externalScrollContainerRef ?? internalScrollContainerRef

  // Registry of thumbnail position getters by asset ID
  const thumbnailPositionGettersRef = useRef<Map<string, ThumbnailPositionGetter>>(new Map())

  // Track the first visible asset for anchoring when no photo is open
  const firstVisibleAssetIdRef = useRef<string | null>(null)

  // Throttle scroll state updates
  const scrollRafRef = useRef<number | null>(null)

  // Throttle visible date updates to avoid excessive re-renders
  const lastVisibleDateRef = useRef<string | null>(null)

  // Get actual scroll position from DOM (fallback to state for SSR/initial render)
  const getScrollTop = useCallback(() => {
    return scrollContainerRef.current?.scrollTop ?? scrollTop
  }, [scrollTop, scrollContainerRef])

  // Function to get thumbnail position by asset ID
  const getThumbnailPosition = useCallback((assetId: string): ThumbnailPosition | null => {
    const getter = thumbnailPositionGettersRef.current.get(assetId)
    return getter ? getter() : null
  }, [])

  // Register a thumbnail position getter
  const handleThumbnailRegister = useCallback(
    (assetId: string, getPosition: ThumbnailPositionGetter) => {
      thumbnailPositionGettersRef.current.set(assetId, getPosition)
    },
    [],
  )

  // Unregister a thumbnail position getter
  const handleThumbnailUnregister = useCallback((assetId: string) => {
    thumbnailPositionGettersRef.current.delete(assetId)
  }, [])

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

  // Calculate bucket positions based on bucket metadata (for skeleton/placeholder layout)
  // This gives us the absolute position for each bucket, enabling accurate scroll-to-bucket
  interface BucketPosition {
    bucketIndex: number
    timeBucket: string
    top: number
    height: number
    loaded: boolean
  }

  const bucketPositions: BucketPosition[] = useMemo(() => {
    if (!allBuckets || allBuckets.length === 0 || rowHeight === 0) {
      return []
    }

    const positions: BucketPosition[] = []
    let currentTop = 0

    for (let i = 0; i < allBuckets.length; i++) {
      const bucket = allBuckets[i]
      if (!bucket) {
        continue
      }

      const isLoaded = loadedBucketIndices?.has(i) ?? false

      // Each bucket is one DAY (size: 'DAY' from API), so we can calculate exact height:
      // - 1 header per bucket (if showing headers)
      // - Exact row count based on bucket.count from API
      const bucketRowCount = Math.ceil(bucket.count / columnCount)
      const headerHeight = showDateHeaders ? HEADER_HEIGHT : 0
      const bucketHeight = headerHeight + bucketRowCount * rowHeight

      positions.push({
        bucketIndex: i,
        timeBucket: bucket.timeBucket,
        top: currentTop,
        height: bucketHeight,
        loaded: isLoaded,
      })

      currentTop += bucketHeight
    }

    return positions
  }, [allBuckets, loadedBucketIndices, columnCount, rowHeight, showDateHeaders])

  // Total height from bucket skeleton (if available) or sections
  const skeletonTotalHeight = useMemo(() => {
    if (bucketPositions.length === 0) {
      return 0
    }
    const lastBucket = bucketPositions.at(-1)
    return lastBucket ? lastBucket.top + lastBucket.height : 0
  }, [bucketPositions])

  // Scroll to a specific bucket index
  const scrollToBucket = useCallback(
    (bucketIndex: number) => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) {
        return
      }

      const bucketPos = bucketPositions[bucketIndex]
      if (bucketPos) {
        scrollContainer.scrollTop = bucketPos.top
      }
    },
    [bucketPositions, scrollContainerRef],
  )

  // Provide scroll-to-bucket function to parent
  useEffect(() => {
    if (onScrollToBucketReady && bucketPositions.length > 0) {
      onScrollToBucketReady(scrollToBucket)
    }
  }, [scrollToBucket, onScrollToBucketReady, bucketPositions.length])

  // Calculate the layout of all items (headers and rows) with their positions
  const { layout, totalHeight } = (() => {
    // If we have bucket positions, use skeleton-based layout
    if (bucketPositions.length > 0 && thumbnailSize > 0) {
      const items: LayoutItem<A>[] = []

      // Determine visible range for layout generation (with generous buffer to avoid layout recalc)
      const currentScrollTop = getScrollTop()
      const layoutBuffer = viewportHeight * 3 // 3 screens worth of buffer
      const layoutVisibleTop = Math.max(0, currentScrollTop - layoutBuffer)
      const layoutVisibleBottom = currentScrollTop + viewportHeight + layoutBuffer

      // Group sections by day to match with DAY buckets
      // Section dates are in YYYY-MM-DD format (from toISOString().split('T')[0])
      const sectionsByDay = new Map<string, TimelineSection<A>>()
      for (const section of sections) {
        // section.date is already YYYY-MM-DD format
        sectionsByDay.set(section.date, section)
      }

      // Iterate through bucket positions and build layout
      for (const bucketPos of bucketPositions) {
        const bucketBottom = bucketPos.top + bucketPos.height
        const isNearVisible = bucketBottom > layoutVisibleTop && bucketPos.top < layoutVisibleBottom

        // Extract day key from bucket timeBucket (format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS...)
        const dayKey = bucketPos.timeBucket.split('T')[0] ?? bucketPos.timeBucket
        const daySection = sectionsByDay.get(dayKey)

        if (daySection) {
          // Bucket is loaded - render the day's section within the bucket's reserved space
          let offsetWithinBucket = 0

          // Add header if showing date headers
          if (showDateHeaders) {
            items.push({
              type: 'header',
              key: `header-${daySection.date}`,
              top: bucketPos.top + offsetWithinBucket,
              height: HEADER_HEIGHT,
              date: daySection.date,
            })
            offsetWithinBucket += HEADER_HEIGHT
          }

          // Add rows for this day's assets
          const sectionRowCount = Math.ceil(daySection.assets.length / columnCount)
          for (let rowIndex = 0; rowIndex < sectionRowCount; rowIndex++) {
            const startAsset = rowIndex * columnCount
            const endAsset = Math.min(startAsset + columnCount, daySection.assets.length)
            items.push({
              type: 'row',
              key: `row-${daySection.date}-${rowIndex}`,
              top: bucketPos.top + offsetWithinBucket,
              height: rowHeight,
              date: daySection.date,
              assets: daySection.assets.slice(startAsset, endAsset),
              rowIndex,
            })
            offsetWithinBucket += rowHeight
          }
        } else if (isNearVisible) {
          // Bucket is not loaded but near visible range - render placeholder header and rows
          let offsetWithinBucket = 0

          // Add placeholder header
          if (showDateHeaders) {
            items.push({
              type: 'header',
              key: `header-placeholder-${bucketPos.timeBucket}`,
              top: bucketPos.top + offsetWithinBucket,
              height: HEADER_HEIGHT,
              date: bucketPos.timeBucket,
              isPlaceholder: true,
            })
            offsetWithinBucket += HEADER_HEIGHT
          }

          // Add placeholder rows based on bucket count
          const estimatedRows = Math.ceil(
            (bucketPos.height - (showDateHeaders ? HEADER_HEIGHT : 0)) / rowHeight,
          )
          for (let rowIndex = 0; rowIndex < estimatedRows; rowIndex++) {
            items.push({
              type: 'row',
              key: `row-placeholder-${bucketPos.timeBucket}-${rowIndex}`,
              top: bucketPos.top + offsetWithinBucket,
              height: rowHeight,
              date: bucketPos.timeBucket,
              isPlaceholder: true,
              rowIndex,
            })
            offsetWithinBucket += rowHeight
          }
        } else {
          // For buckets far from visible range and not loaded, generate a single
          // bucket-sized placeholder so there's always an item to find when scrolling
          items.push({
            type: 'header',
            key: `header-placeholder-${bucketPos.timeBucket}`,
            top: bucketPos.top,
            height: bucketPos.height,
            date: bucketPos.timeBucket,
            isPlaceholder: true,
            isBucketPlaceholder: true, // Marks this as a collapsed bucket placeholder
          })
        }
      }

      return { layout: items, totalHeight: skeletonTotalHeight }
    }

    // Fallback: no bucket metadata - use original section-based layout
    if (thumbnailSize === 0 || sections.length === 0) {
      return { layout: [] as LayoutItem<A>[], totalHeight: 0 }
    }

    const items: LayoutItem<A>[] = []
    let currentTop = 0

    for (const section of sections) {
      // Add header if showing date headers
      if (showDateHeaders) {
        items.push({
          type: 'header',
          key: `header-${section.date}`,
          top: currentTop,
          height: HEADER_HEIGHT,
          date: section.date,
        })
        currentTop += HEADER_HEIGHT
      }

      // Add rows for this section
      const rowCount = Math.ceil(section.assets.length / columnCount)
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const startAsset = rowIndex * columnCount
        const endAsset = Math.min(startAsset + columnCount, section.assets.length)
        items.push({
          type: 'row',
          key: `row-${section.date}-${rowIndex}`,
          top: currentTop,
          height: rowHeight,
          date: section.date,
          assets: section.assets.slice(startAsset, endAsset),
          rowIndex,
        })
        currentTop += rowHeight
      }
    }

    return { layout: items, totalHeight: currentTop }
  })()

  // Calculate visible range and spacer heights for flow-based virtualization
  // This approach renders items in normal document flow (not absolute) so sticky headers work
  const { visibleItems, topSpacerHeight, bottomSpacerHeight, stickyHeader } = (() => {
    if (layout.length === 0 || viewportHeight === 0) {
      return {
        visibleItems: [] as LayoutItem<A>[],
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        stickyHeader: null as LayoutItem<A> | null,
      }
    }

    const currentScrollTop = getScrollTop()
    const bufferPx = BUFFER_ROWS * rowHeight
    const visibleTop = Math.max(0, currentScrollTop - bufferPx)
    const visibleBottom = currentScrollTop + viewportHeight + bufferPx

    // Find the "current" sticky header - the last header with top <= scrollTop
    // This is rendered separately at the top, not as part of the flow
    let currentStickyHeader: LayoutItem<A> | null = null
    for (const item of layout) {
      if (item.type === 'header' && item.top <= currentScrollTop) {
        currentStickyHeader = item
      } else if (item.type === 'header' && item.top > currentScrollTop) {
        break // Headers are sorted, no need to continue
      }
    }

    // Filter items that are in the visible range (don't include sticky header here)
    const filtered: LayoutItem<A>[] = []
    for (const item of layout) {
      const itemBottom = item.top + item.height
      const isInVisibleRange = itemBottom > visibleTop && item.top < visibleBottom

      if (isInVisibleRange) {
        filtered.push(item)
      } else if (filtered.length > 0 && item.top >= visibleBottom) {
        // Past visible range, stop iterating
        break
      }
    }

    // Calculate spacer heights based on actually visible items (not sticky header)
    const firstVisible = filtered[0]
    const lastVisible = filtered.at(-1)
    const topHeight = firstVisible ? firstVisible.top : 0
    const bottomHeight = lastVisible ? totalHeight - (lastVisible.top + lastVisible.height) : 0

    return {
      visibleItems: filtered,
      topSpacerHeight: topHeight,
      bottomSpacerHeight: Math.max(0, bottomHeight),
      stickyHeader: currentStickyHeader,
    }
  })()

  // Group assets by date
  useEffect(() => {
    if (assets?.length === 0) {
      return
    }

    // If showDateHeaders is false, merge all assets into a single section
    if (!showDateHeaders) {
      // Sort assets by date based on order prop
      const sortedAssets = [...assets].sort((a, b) => {
        const dateA = a.fileCreatedAt ? new Date(a.fileCreatedAt).getTime() : 0
        const dateB = b.fileCreatedAt ? new Date(b.fileCreatedAt).getTime() : 0
        return order === 'asc' ? dateA - dateB : dateB - dateA
      })

      // Create a single section with all assets
      const mergedSection = {
        date: 'all-assets',
        assets: sortedAssets,
      }
      setSections([mergedSection])
      return
    }

    // If showDateHeaders is true, group by date as before
    const groupedByDate: { [key: string]: A[] } = {}
    for (const asset of assets) {
      if (!asset.fileCreatedAt) {
        continue // Skip assets without date, don't abort the whole grouping
      }

      // Use the timeBucket if available (set by API based on localDateTime),
      // otherwise fall back to deriving from fileCreatedAt (UTC)
      const date = asset.timeBucket ?? new Date(asset.fileCreatedAt).toISOString().split('T')[0]
      if (!date) {
        continue
      }

      if (!groupedByDate[date]) {
        groupedByDate[date] = []
      }

      groupedByDate[date].push(asset)
    }

    // Convert to array and sort by date based on order prop
    const sortedSections = Object.entries(groupedByDate)
      .map(([date, assets]) => ({ date, assets }))
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime()
        const timeB = new Date(b.date).getTime()
        return order === 'asc' ? timeA - timeB : timeB - timeA
      })
    setSections(sortedSections)
  }, [assets, showDateHeaders, order])

  // Helper function to get the asset index in the flat list
  const getAssetIndex = useCallback(
    (assetId: string): number => {
      let index = 0
      for (const section of sections) {
        for (const asset of section.assets) {
          if (asset.id === assetId) {
            return index
          }
          index++
        }
      }
      return -1
    },
    [sections],
  )

  // Helper function to calculate scroll position for an asset given a specific column count
  const calculateScrollPositionForAsset = useCallback(
    (assetId: string, width: number): number | null => {
      const assetIndex = getAssetIndex(assetId)
      if (assetIndex === -1) {
        return null
      }

      // Calculate column count for the given width
      const cols = width
        ? Math.max(MIN_COLUMNS, Math.floor(width / TARGET_THUMBNAIL_SIZE))
        : MIN_COLUMNS
      const thumbSize = width ? Math.floor(width / cols) - 1 : 0

      // Calculate which row the asset is in
      // Need to account for date headers if shown
      let currentAssetIndex = 0
      let scrollPosition = 0
      const headerHeight = showDateHeaders ? 48 : 0 // Approximate header height

      for (const section of sections) {
        if (showDateHeaders) {
          // Add header height
          scrollPosition += headerHeight
        }

        const assetsInSection = section.assets.length
        const rowsInSection = Math.ceil(assetsInSection / cols)
        const assetRowOffset = Math.floor((assetIndex - currentAssetIndex) / cols)

        if (assetIndex >= currentAssetIndex && assetIndex < currentAssetIndex + assetsInSection) {
          // Asset is in this section
          scrollPosition += assetRowOffset * (thumbSize + 2) // +2 for gap
          return scrollPosition
        }

        // Add all rows in this section
        scrollPosition += rowsInSection * (thumbSize + 2)
        currentAssetIndex += assetsInSection
      }

      return null
    },
    [getAssetIndex, sections, showDateHeaders],
  )

  // Track previous container width for resize detection
  const prevContainerWidthRef = useRef<number>(0)

  // Update container width on resize using ResizeObserver for reliable orientation change detection
  useEffect(() => {
    const container = containerRef.current
    const scrollContainer = scrollContainerRef.current
    if (!container) {
      return
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use contentBoxSize for more accurate measurement
        const newWidth = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
        const oldWidth = prevContainerWidthRef.current

        // Only do anchoring logic if width actually changed (not just re-trigger)
        if (oldWidth > 0 && Math.abs(newWidth - oldWidth) > 1) {
          // Determine which asset to anchor to
          const assetIdToAnchor = anchorAssetId ?? firstVisibleAssetIdRef.current
          if (assetIdToAnchor && scrollContainer) {
            // Calculate the scroll position for the anchor asset before and after resize
            const oldScrollPos = calculateScrollPositionForAsset(assetIdToAnchor, oldWidth)
            const newScrollPos = calculateScrollPositionForAsset(assetIdToAnchor, newWidth)

            if (oldScrollPos !== null && newScrollPos !== null) {
              // Calculate the offset from the asset's position to the current scroll position
              const currentScroll = scrollContainer.scrollTop
              const offsetFromAnchor = currentScroll - oldScrollPos

              // Apply the same offset to the new position
              // Use requestAnimationFrame to wait for the DOM to update
              requestAnimationFrame(() => {
                if (scrollContainer) {
                  scrollContainer.scrollTop = newScrollPos + offsetFromAnchor
                }
              })
            }
          }
        }

        prevContainerWidthRef.current = newWidth
        setContainerWidth(newWidth)
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [anchorAssetId, calculateScrollPositionForAsset])

  // Handle scroll events - update scroll position for virtualization
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) {
      return
    }

    // Use RAF to batch scroll updates
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      const { scrollTop: newScrollTop, scrollHeight, clientHeight } = scrollContainer

      // Update scroll position for virtualization
      setScrollTop(newScrollTop)
      if (clientHeight !== viewportHeight) {
        setViewportHeight(clientHeight)
      }

      // Find visible date from layout (loaded assets)
      const visibleItem = layout.find(
        (item) => item.top + item.height > newScrollTop && item.type === 'row',
      )
      let visibleDate = visibleItem?.date ?? null

      // Track first visible asset for anchoring
      if (visibleItem?.type === 'row' && visibleItem.assets && !anchorAssetId) {
        firstVisibleAssetIdRef.current = visibleItem.assets[0]?.id ?? null
      }

      // Always check for unloaded buckets in the visible viewport and request loading
      // This is needed even when some loaded content is visible, because the user may be
      // scrolling into an unloaded area while still seeing loaded content from another bucket
      if (bucketPositions.length > 0 && onBucketLoadRequest) {
        // Binary search to find first bucket that might be visible
        let lo = 0
        let hi = bucketPositions.length - 1
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2)
          const bp = bucketPositions[mid]
          if (bp && bp.top + bp.height <= newScrollTop) {
            lo = mid + 1
          } else {
            hi = mid
          }
        }

        // Check buckets starting from the first potentially visible one
        for (let i = lo; i < bucketPositions.length; i++) {
          const bp = bucketPositions[i]
          if (!bp) {
            continue
          }

          // Early exit if we've passed the viewport
          if (bp.top >= newScrollTop + clientHeight) {
            break
          }

          // Check if bucket is in viewport
          if (bp.top + bp.height > newScrollTop) {
            if (!bp.loaded) {
              onBucketLoadRequest(bp.bucketIndex)
            }
            // Use first visible bucket's date if we don't have a visible loaded item
            if (!visibleDate) {
              visibleDate = bp.timeBucket
            }
          }
        }
      }

      // Report visible date if changed
      if (onVisibleDateChange && visibleDate && visibleDate !== lastVisibleDateRef.current) {
        lastVisibleDateRef.current = visibleDate
        onVisibleDateChange(visibleDate)
      }

      // Check if we're near the end and need to load more
      if (onLoadMoreRequest) {
        const scrollPosition = newScrollTop / (scrollHeight - clientHeight)
        const isNearEnd = scrollPosition > 0.8

        if (isNearEnd && hasMoreContent && !isLoadingMore) {
          onLoadMoreRequest()
        }
      }
    })
  }, [
    anchorAssetId,
    bucketPositions,
    hasMoreContent,
    isLoadingMore,
    layout,
    onBucketLoadRequest,
    onLoadMoreRequest,
    onVisibleDateChange,
    viewportHeight,
  ])

  // Sync scroll position when sections change (to maintain position after content loads)
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer && sections.length > 0) {
      // Read current scroll position and update state if different
      const currentScroll = scrollContainer.scrollTop
      setScrollTop(currentScroll)
      if (scrollContainer.clientHeight > 0) {
        setViewportHeight(scrollContainer.clientHeight)
      }
    }
  }, [sections])

  // Add scroll event listener
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to check if we want to request more after adding sections
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)

      // Initialize viewport height for virtualization
      if (scrollContainer.clientHeight > 0 && viewportHeight === 0) {
        setViewportHeight(scrollContainer.clientHeight)
      }

      // Check if we need to load more content initially (if container isn't filled)
      if (
        scrollContainer.scrollHeight <= scrollContainer.clientHeight &&
        hasMoreContent &&
        !isLoadingMore &&
        onLoadMoreRequest
      ) {
        onLoadMoreRequest()
      }
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [handleScroll, hasMoreContent, isLoadingMore, onLoadMoreRequest, sections, viewportHeight])

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
