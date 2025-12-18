import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { BucketPosition } from './useBucketNavigation'

/**
 * Configuration for anchored scrolling
 */
const SCROLL_BUFFER_HEIGHT = 50000 // Maximum scroll buffer height
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
  /** Total virtual height of all content */
  totalContentHeight: number
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
  /** The top padding to add before content (for boundary limiting) */
  scrollBufferTopPadding: number
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
  totalContentHeight,
  scrollContainerRef,
  onAnchorChange,
}: UseAnchoredScrollOptions): UseAnchoredScrollResult {
  // Anchor state - which bucket is at the "reference point"
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

  // Calculate the anchor's virtual position
  // Uses pending anchor if available to handle async state updates
  const getAnchorPosition = useCallback(() => {
    const effectiveAnchor = pendingAnchorRef.current ?? anchor
    const bucketPos = bucketPositions[effectiveAnchor.bucketIndex]
    if (!bucketPos) {
      return 0
    }
    return bucketPos.top + effectiveAnchor.offsetWithinBucket
  }, [bucketPositions, anchor])

  // Calculate boundary-aware scroll buffer dimensions
  // This physically limits scrolling at the start and end of content
  const getScrollBufferDimensions = useCallback(() => {
    const anchorPos = getAnchorPosition()

    // Calculate how much virtual space is available in each direction
    const spaceAbove = anchorPos // Virtual pixels above anchor
    const spaceBelow = Math.max(0, totalContentHeight - anchorPos) // Virtual pixels below anchor

    // Determine the scroll buffer padding and height
    // We want the physical scroll area to match the available virtual content
    // but capped at SCROLL_MIDDLE in each direction

    // Top padding: if near start, reduce padding so scroll physically stops
    // When spaceAbove = 0, topPadding should be 0 (can't scroll up)
    // When spaceAbove >= SCROLL_MIDDLE, topPadding = SCROLL_MIDDLE (full buffer)
    const topPadding = Math.min(spaceAbove, SCROLL_MIDDLE)

    // Bottom space: if near end, reduce height so scroll physically stops
    // When spaceBelow = 0, bottomSpace should be 0 (can't scroll down)
    // When spaceBelow >= SCROLL_MIDDLE, bottomSpace = SCROLL_MIDDLE (full buffer)
    const bottomSpace = Math.min(spaceBelow, SCROLL_MIDDLE)

    // Total buffer height is top padding + 1px for content position + bottom space
    // We add 1px to ensure there's always a scrollable position for the anchor
    const bufferHeight = topPadding + bottomSpace + 1

    return { topPadding, bufferHeight }
  }, [getAnchorPosition, totalContentHeight])

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
    const { topPadding } = getScrollBufferDimensions()
    // The anchor is at physical position topPadding
    const scrollOffset = scrollContainer.scrollTop - topPadding
    return Math.max(0, anchorPos + scrollOffset)
  }, [bucketPositions, scrollContainerRef, getAnchorPosition, getScrollBufferDimensions])

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
    (newVirtual: number) => {
      const { bucketIndex: newBucketIndex, offset } = findBucketAtPosition(newVirtual)
      const newAnchor = { bucketIndex: newBucketIndex, offsetWithinBucket: offset }
      // Set pending anchor first so getAnchorPosition uses it immediately
      pendingAnchorRef.current = newAnchor
      setAnchor(newAnchor)
      isResettingRef.current = true
      // After anchor change, the buffer dimensions will update
      // The scroll position will be set in the effect that watches topPadding
    },
    [findBucketAtPosition],
  )

  // Handle scroll events and return the new virtual and physical scroll positions
  const handleScroll = useCallback((): ScrollResult => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || bucketPositions.length === 0) {
      const { topPadding } = getScrollBufferDimensions()
      return { virtual: getVirtualScrollTop(), physical: topPadding }
    }

    const currentScrollTop = scrollContainer.scrollTop
    const { topPadding, bufferHeight } = getScrollBufferDimensions()

    // Skip if this is a reset scroll
    if (isResettingRef.current) {
      isResettingRef.current = false
      return { virtual: getVirtualScrollTop(), physical: currentScrollTop }
    }

    const anchorPos = getAnchorPosition()
    // The anchor is at physical position topPadding
    const scrollOffset = currentScrollTop - topPadding

    // Calculate virtual position
    let newVirtual = anchorPos + scrollOffset

    // Clamp to boundaries
    if (newVirtual < 0) {
      newVirtual = 0
    }
    if (newVirtual > totalContentHeight) {
      newVirtual = totalContentHeight
    }

    // Update current bucket tracking based on virtual position
    const { bucketIndex } = findBucketAtPosition(newVirtual)
    if (onAnchorChange) {
      onAnchorChange(bucketIndex)
    }

    // Check if we're approaching edges and need to schedule a reset
    // Only reset if we have room to expand the buffer (not at actual content boundaries)
    const nearTopEdge = currentScrollTop < SCROLL_RESET_THRESHOLD && topPadding >= SCROLL_MIDDLE
    const nearBottomEdge =
      currentScrollTop > bufferHeight - SCROLL_RESET_THRESHOLD &&
      bufferHeight - topPadding >= SCROLL_MIDDLE
    const needsReset = nearTopEdge || nearBottomEdge

    // Clear any existing reset timer
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current)
      scrollEndTimerRef.current = null
    }

    // Schedule reset for when scrolling stops (debounced)
    if (needsReset) {
      scrollEndTimerRef.current = setTimeout(() => {
        // Re-check if we still need reset
        const currentPos = scrollContainer.scrollTop
        const { topPadding: currentTopPadding, bufferHeight: currentBufferHeight } =
          getScrollBufferDimensions()
        const stillNearTop =
          currentPos < SCROLL_RESET_THRESHOLD && currentTopPadding >= SCROLL_MIDDLE
        const stillNearBottom =
          currentPos > currentBufferHeight - SCROLL_RESET_THRESHOLD &&
          currentBufferHeight - currentTopPadding >= SCROLL_MIDDLE
        if (stillNearTop || stillNearBottom) {
          // Recalculate virtual position at reset time
          const resetVirtual = Math.max(
            0,
            Math.min(totalContentHeight, getAnchorPosition() + (currentPos - currentTopPadding)),
          )
          performReset(resetVirtual)
        }
        scrollEndTimerRef.current = null
      }, 150) // Wait 150ms after last scroll event
    }

    return { virtual: newVirtual, physical: currentScrollTop }
  }, [
    bucketPositions,
    totalContentHeight,
    scrollContainerRef,
    getVirtualScrollTop,
    getAnchorPosition,
    getScrollBufferDimensions,
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

      // The scroll position will be set in the effect below when dimensions update
      isResettingRef.current = true

      // Notify of anchor change
      if (onAnchorChange) {
        onAnchorChange(bucketIndex)
      }
    },
    [scrollContainerRef, onAnchorChange],
  )

  // Get current scroll buffer dimensions (for render)
  const { topPadding, bufferHeight } = getScrollBufferDimensions()

  // Update scroll position when buffer dimensions change (after anchor reset)
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer && isResettingRef.current) {
      // Scroll to anchor position (topPadding)
      scrollContainer.scrollTop = topPadding
      isResettingRef.current = false
    }
  }, [scrollContainerRef, topPadding])

  // Initialize scroll position on mount and cleanup timer on unmount
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      // Start at the anchor position (which is at topPadding)
      scrollContainer.scrollTop = topPadding
    }
    return () => {
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current)
      }
    }
  }, [scrollContainerRef, topPadding])

  return {
    anchor,
    getVirtualScrollTop,
    scrollBufferHeight: bufferHeight,
    scrollBufferTopPadding: topPadding,
    handleScroll,
    scrollToAnchor,
    isResetting: isResettingRef.current,
  }
}
