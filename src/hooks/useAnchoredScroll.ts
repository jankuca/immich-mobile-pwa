import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { BucketPosition } from './useBucketNavigation'

/**
 * Configuration for anchored scrolling
 */
const SCROLL_BUFFER_HEIGHT = 50000 // Total scroll height to maintain
const SCROLL_RESET_THRESHOLD = 15000 // Reset when within this distance from edge
const SCROLL_MIDDLE = SCROLL_BUFFER_HEIGHT / 2 // Middle position to reset to

export interface AnchorState {
  /** The bucket index that serves as the anchor */
  bucketIndex: number
  /** Offset within the anchor bucket (pixels from bucket top) */
  offsetWithinBucket: number
}

interface UseAnchoredScrollOptions {
  /** Calculated bucket positions */
  bucketPositions: BucketPosition[]
  /** Ref to the scroll container */
  scrollContainerRef: { current: HTMLDivElement | null }
  /** Callback when anchor changes (for loading buckets) */
  onAnchorChange?: (bucketIndex: number) => void
}

interface ScrollResult {
  virtual: number
  physical: number
}

interface UseAnchoredScrollResult {
  /** Current anchor state */
  anchor: AnchorState
  /** Get the current virtual scroll position (calculated from anchor + DOM scroll offset) */
  getVirtualScrollTop: () => number
  /** The physical scroll height to use for the container */
  scrollBufferHeight: number
  /** Handle scroll events and return the new virtual and physical scroll positions */
  handleScroll: () => ScrollResult
  /** Scroll to a specific bucket (for scrubbing) */
  scrollToAnchor: (bucketIndex: number, offset?: number) => void
  /** Whether a scroll reset is in progress (skip side effects) */
  isResetting: boolean
}

/**
 * Hook for anchor-based virtual scrolling.
 *
 * Instead of using actual scroll position to determine content,
 * we track an "anchor" bucket and offset. When scroll approaches
 * the edges of the buffer, we reset scroll position to the middle
 * while maintaining visual position by updating the anchor.
 *
 * This allows infinite virtual scrolling with native scroll physics.
 */
export function useAnchoredScroll({
  bucketPositions,
  scrollContainerRef,
  onAnchorChange,
}: UseAnchoredScrollOptions): UseAnchoredScrollResult {
  // Anchor state - which bucket is at the "reference point" (at SCROLL_MIDDLE)
  const [anchor, setAnchor] = useState<AnchorState>({
    bucketIndex: 0,
    offsetWithinBucket: 0,
  })

  // Track pending anchor to handle async state updates
  const pendingAnchorRef = useRef<AnchorState | null>(null)

  // Flag to skip side effects during programmatic scroll reset
  const isResettingRef = useRef<boolean>(false)

  // Debounce timer for detecting scroll end
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Calculate the anchor's virtual position (the position at SCROLL_MIDDLE)
  // Uses pending anchor if available to handle async state updates
  const getAnchorPosition = useCallback(() => {
    const effectiveAnchor = pendingAnchorRef.current ?? anchor
    const bucketPos = bucketPositions[effectiveAnchor.bucketIndex]
    if (!bucketPos) {
      return 0
    }
    return bucketPos.top + effectiveAnchor.offsetWithinBucket
  }, [bucketPositions, anchor])

  // Clear pending anchor when state catches up
  useEffect(() => {
    pendingAnchorRef.current = null
  }, [anchor])

  // Get the current virtual scroll position based on anchor + DOM scroll offset
  // This should be called during render to get the most up-to-date position
  const getVirtualScrollTop = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || bucketPositions.length === 0) {
      return 0
    }
    const anchorPos = getAnchorPosition()
    const scrollOffset = scrollContainer.scrollTop - SCROLL_MIDDLE
    return Math.max(0, anchorPos + scrollOffset)
  }, [bucketPositions, scrollContainerRef, getAnchorPosition])

  // Find bucket at a given virtual position (binary search)
  const findBucketAtPosition = useCallback(
    (virtualPos: number): { bucketIndex: number; offset: number } => {
      if (bucketPositions.length === 0) {
        return { bucketIndex: 0, offset: 0 }
      }

      // Binary search
      let low = 0
      let high = bucketPositions.length - 1

      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2)
        const bucket = bucketPositions[mid]
        if (bucket && bucket.top <= virtualPos) {
          low = mid
        } else {
          high = mid - 1
        }
      }

      const bucket = bucketPositions[low]
      const offset = bucket ? virtualPos - bucket.top : 0
      return { bucketIndex: low, offset: Math.max(0, offset) }
    },
    [bucketPositions],
  )

  // Perform the scroll reset (called when scrolling has stopped)
  const performReset = useCallback(
    (scrollContainer: HTMLElement, newVirtual: number) => {
      const { bucketIndex: newBucketIndex, offset } = findBucketAtPosition(newVirtual)
      const newAnchor = { bucketIndex: newBucketIndex, offsetWithinBucket: offset }
      // Set pending anchor first so getAnchorPosition uses it immediately
      pendingAnchorRef.current = newAnchor
      setAnchor(newAnchor)
      isResettingRef.current = true
      scrollContainer.scrollTop = SCROLL_MIDDLE
    },
    [findBucketAtPosition],
  )

  // Handle scroll events and return the new virtual and physical scroll positions
  const handleScroll = useCallback((): ScrollResult => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || bucketPositions.length === 0) {
      return { virtual: getVirtualScrollTop(), physical: SCROLL_MIDDLE }
    }

    const currentScrollTop = scrollContainer.scrollTop

    // Skip if this is a reset scroll
    if (isResettingRef.current) {
      isResettingRef.current = false
      return { virtual: getVirtualScrollTop(), physical: currentScrollTop }
    }

    const anchorPos = getAnchorPosition()
    const scrollOffset = currentScrollTop - SCROLL_MIDDLE

    // Calculate virtual position
    let newVirtual = anchorPos + scrollOffset

    // Clamp to top boundary - prevent scrolling above content
    if (newVirtual < 0) {
      newVirtual = 0
      // Don't adjust scrollTop here - let it hit the edge naturally
      // We'll reset when scrolling stops
    }

    // Update current bucket tracking based on virtual position
    const { bucketIndex } = findBucketAtPosition(newVirtual)
    if (onAnchorChange) {
      onAnchorChange(bucketIndex)
    }

    // Check if we're approaching edges and need to schedule a reset
    const needsReset =
      currentScrollTop < SCROLL_RESET_THRESHOLD ||
      currentScrollTop > SCROLL_BUFFER_HEIGHT - SCROLL_RESET_THRESHOLD

    // Clear any existing reset timer
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current)
      scrollEndTimerRef.current = null
    }

    // Schedule reset for when scrolling stops (debounced)
    if (needsReset && newVirtual > 0) {
      scrollEndTimerRef.current = setTimeout(() => {
        // Re-check if we still need reset (scroll position might have changed)
        const currentPos = scrollContainer.scrollTop
        const stillNeedsReset =
          currentPos < SCROLL_RESET_THRESHOLD ||
          currentPos > SCROLL_BUFFER_HEIGHT - SCROLL_RESET_THRESHOLD
        if (stillNeedsReset) {
          // Recalculate virtual position at reset time
          const resetVirtual = Math.max(0, getAnchorPosition() + (currentPos - SCROLL_MIDDLE))
          performReset(scrollContainer, resetVirtual)
        }
        scrollEndTimerRef.current = null
      }, 150) // Wait 150ms after last scroll event
    }

    return { virtual: newVirtual, physical: currentScrollTop }
  }, [
    bucketPositions,
    scrollContainerRef,
    getVirtualScrollTop,
    getAnchorPosition,
    findBucketAtPosition,
    onAnchorChange,
    performReset,
  ])

  // Scroll to a specific bucket (for scrubbing)
  const scrollToAnchor = useCallback(
    (bucketIndex: number, offset = 0) => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) {
        return
      }

      // Clear any pending scroll reset timer
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current)
        scrollEndTimerRef.current = null
      }

      // Set anchor directly with pending ref for immediate effect
      const newAnchor = { bucketIndex, offsetWithinBucket: offset }
      pendingAnchorRef.current = newAnchor
      setAnchor(newAnchor)

      // Reset scroll to middle
      isResettingRef.current = true
      scrollContainer.scrollTop = SCROLL_MIDDLE

      // Notify of anchor change
      if (onAnchorChange) {
        onAnchorChange(bucketIndex)
      }
    },
    [scrollContainerRef, onAnchorChange],
  )

  // Initialize scroll position to middle on mount and cleanup timer on unmount
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTop = SCROLL_MIDDLE
    }
    return () => {
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current)
      }
    }
  }, [scrollContainerRef])

  return {
    anchor,
    getVirtualScrollTop,
    scrollBufferHeight: SCROLL_BUFFER_HEIGHT,
    handleScroll,
    scrollToAnchor,
    isResetting: isResettingRef.current,
  }
}
