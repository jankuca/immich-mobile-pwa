import { useCallback, useEffect, useRef } from 'preact/hooks'
import type { BucketPosition } from './useBucketNavigation'
import type { LayoutItem } from './useTimelineLayout'

interface UseTimelineScrollOptions<A> {
  /** Layout of all visible items */
  layout: LayoutItem<A>[]
  /** Bucket positions for the skeleton */
  bucketPositions: BucketPosition[]
  /** Current bucket index being tracked */
  currentBucketIndex: number
  /** Ref to the scroll container */
  scrollContainerRef: { current: HTMLDivElement | null }
  /** Current viewport height (for change detection) */
  viewportHeight: number
  /** ID of the asset to anchor to (skip first visible tracking when set) */
  anchorAssetId?: string | null | undefined
  /** Callback to update scroll position state (virtual scroll position) */
  setScrollTop: (scrollTop: number) => void
  /** Callback to update viewport height state */
  setViewportHeight: (height: number) => void
  /** Callback to update the current bucket based on scroll position */
  updateCurrentBucket: (scrollTop: number) => void
  /** Get bucket indices to load around current position */
  getBucketsToLoad: (buffer: number) => number[]
  /** Callback to request loading a specific bucket */
  onBucketLoadRequest?: ((bucketIndex: number) => void) | undefined
  /** Callback when the visible date changes */
  onVisibleDateChange?: ((date: string) => void) | undefined
  /** Callback to update first visible asset ID for anchoring */
  setFirstVisibleAssetId: (assetId: string | null) => void
  /** Ref flag to mark programmatic scrolls (shared with parent) */
  isAdjustingScrollRef: { current: boolean }
  /** Optional anchored scroll handler - when provided, scroll events are processed through it */
  handleAnchoredScroll?: (() => { virtual: number; physical: number }) | undefined
  /** Callback to update physical scroll position state */
  setPhysicalScrollTop?: (scrollTop: number) => void
}

/**
 * Handles scroll events for the virtualized timeline.
 *
 * Manages visible date detection, bucket loading, and load-more detection.
 * Scroll state (scrollTop, viewportHeight) is managed by the parent component.
 */
export function useTimelineScroll<A extends { id: string }>({
  layout,
  bucketPositions,
  currentBucketIndex,
  scrollContainerRef,
  viewportHeight,
  anchorAssetId,
  setScrollTop,
  setViewportHeight,
  updateCurrentBucket,
  getBucketsToLoad,
  onBucketLoadRequest,
  onVisibleDateChange,
  setFirstVisibleAssetId,
  isAdjustingScrollRef,
  handleAnchoredScroll,
  setPhysicalScrollTop,
}: UseTimelineScrollOptions<A>): void {
  // Throttle scroll state updates
  const scrollRafRef = useRef<number | null>(null)

  // Throttle visible date updates to avoid excessive re-renders
  const lastVisibleDateRef = useRef<string | null>(null)

  // Helper to process anchored scroll and update both virtual and physical positions
  const processAnchoredScroll = useCallback(
    (scrollContainer: HTMLElement): number => {
      if (handleAnchoredScroll) {
        const result = handleAnchoredScroll()
        if (setPhysicalScrollTop) {
          setPhysicalScrollTop(result.physical)
        }
        return result.virtual
      }
      return scrollContainer.scrollTop
    },
    [handleAnchoredScroll, setPhysicalScrollTop],
  )

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) {
      return
    }

    // Check if this is a programmatic scroll adjustment
    const isProgrammaticScroll = isAdjustingScrollRef.current
    if (isProgrammaticScroll) {
      isAdjustingScrollRef.current = false
      // For programmatic scrolls, update scrollTop immediately (no RAF)
      // This ensures layout recalculates correctly after scrubbing
      const newScrollTop = processAnchoredScroll(scrollContainer)
      const { clientHeight } = scrollContainer
      setScrollTop(newScrollTop)
      if (clientHeight !== viewportHeight) {
        setViewportHeight(clientHeight)
      }
      return
    }

    // Use RAF to batch scroll updates for user scrolling
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      // Use anchored scroll handler if available, otherwise use DOM scrollTop
      const newScrollTop = processAnchoredScroll(scrollContainer)
      const { clientHeight } = scrollContainer

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
        setFirstVisibleAssetId(visibleItem.assets[0]?.id ?? null)
      }

      // Update current bucket tracking based on scroll position
      updateCurrentBucket(newScrollTop)

      // Request loading of buckets around the TRACKED current bucket
      if (bucketPositions.length > 0 && onBucketLoadRequest) {
        const bucketsToLoad = getBucketsToLoad(2)
        for (const bucketIndex of bucketsToLoad) {
          onBucketLoadRequest(bucketIndex)
        }

        // Use tracked bucket's date for visible date if we don't have loaded content
        if (!visibleDate) {
          const currentBp = bucketPositions[currentBucketIndex]
          if (currentBp) {
            visibleDate = currentBp.timeBucket
          }
        }
      }

      // Report visible date if changed
      if (onVisibleDateChange && visibleDate && visibleDate !== lastVisibleDateRef.current) {
        lastVisibleDateRef.current = visibleDate
        onVisibleDateChange(visibleDate)
      }
    })
  }, [
    anchorAssetId,
    bucketPositions,
    currentBucketIndex,
    getBucketsToLoad,
    processAnchoredScroll,
    isAdjustingScrollRef,
    layout,
    onBucketLoadRequest,
    onVisibleDateChange,
    scrollContainerRef,
    setFirstVisibleAssetId,
    setScrollTop,
    setViewportHeight,
    updateCurrentBucket,
    viewportHeight,
  ])

  // Sync scroll position when layout changes (to maintain position after content loads)
  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when layout changes
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer && layout.length > 0) {
      // Use anchored scroll handler if available, otherwise use DOM scrollTop
      const currentScroll = processAnchoredScroll(scrollContainer)
      setScrollTop(currentScroll)
      if (scrollContainer.clientHeight > 0) {
        setViewportHeight(scrollContainer.clientHeight)
      }
    }
  }, [layout])

  // Add scroll event listener
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to check if we want to request more after adding layout
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)

      // Initialize viewport height for virtualization
      if (scrollContainer.clientHeight > 0 && viewportHeight === 0) {
        setViewportHeight(scrollContainer.clientHeight)
      }
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [handleScroll, layout, viewportHeight])
}
