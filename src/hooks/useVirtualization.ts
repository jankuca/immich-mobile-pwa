import { useMemo } from 'preact/hooks'
import type { LayoutItem } from './useTimelineLayout'

const BUFFER_ROWS = 5

interface UseVirtualizationOptions<A> {
  /** All layout items (headers and rows) */
  layout: LayoutItem<A>[]
  /** Total height of the layout */
  totalHeight: number
  /** Current scroll position */
  scrollTop: number
  /** Height of the viewport */
  viewportHeight: number
  /** Height of each row */
  rowHeight: number
}

interface UseVirtualizationResult<A> {
  /** Items currently visible in the viewport (plus buffer) */
  visibleItems: LayoutItem<A>[]
  /** Height of the top spacer */
  topSpacerHeight: number
  /** Height of the bottom spacer */
  bottomSpacerHeight: number
  /** The current sticky header (last header with top <= scrollTop) */
  stickyHeader: LayoutItem<A> | null
}

/**
 * Calculates which items are visible in the viewport for virtualization.
 *
 * Uses a flow-based approach where items are rendered in normal document flow
 * (not absolute positioning) so sticky headers work correctly.
 *
 * Returns visible items plus spacers to maintain scroll position.
 */
export function useVirtualization<A>({
  layout,
  totalHeight,
  scrollTop,
  viewportHeight,
  rowHeight,
}: UseVirtualizationOptions<A>): UseVirtualizationResult<A> {
  return useMemo(() => {
    if (layout.length === 0 || viewportHeight === 0) {
      return {
        visibleItems: [] as LayoutItem<A>[],
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        stickyHeader: null,
      }
    }

    const bufferPx = BUFFER_ROWS * rowHeight
    const visibleTop = Math.max(0, scrollTop - bufferPx)
    const visibleBottom = scrollTop + viewportHeight + bufferPx

    // Find the "current" sticky header - the last header with top <= scrollTop
    let currentStickyHeader: LayoutItem<A> | null = null
    for (const item of layout) {
      if (item.type === 'header' && item.top <= scrollTop) {
        currentStickyHeader = item
      } else if (item.type === 'header' && item.top > scrollTop) {
        break // Headers are sorted, no need to continue
      }
    }

    // Filter items that are in the visible range
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

    // Calculate spacer heights
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
  }, [layout, totalHeight, scrollTop, viewportHeight, rowHeight])
}
