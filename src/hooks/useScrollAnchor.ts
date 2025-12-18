import { useCallback, useEffect, useRef } from 'preact/hooks'
import type { TimelineSection } from './useBucketNavigation'

const HEADER_HEIGHT = 48
const ROW_GAP = 2

interface UseScrollAnchorOptions<A> {
  /** Sections grouped by date */
  sections: TimelineSection<A>[]
  /** Whether to show date headers */
  showDateHeaders: boolean
  /** Ref to the scroll container */
  scrollContainerRef: { current: HTMLDivElement | null }
  /** Ref to the container element (for resize observation) */
  containerRef: { current: HTMLDivElement | null }
  /** ID of the asset to anchor to (e.g., currently viewed photo) */
  anchorAssetId?: string | null | undefined
  /** Callback when container width changes */
  onWidthChange: (width: number) => void
}

interface UseScrollAnchorResult {
  /** Update the first visible asset ID (for anchoring when no photo is open) */
  setFirstVisibleAssetId: (assetId: string | null) => void
}

/**
 * Handles scroll position anchoring during resize/orientation changes.
 *
 * When the container width changes, this hook calculates the new scroll position
 * needed to keep the anchor asset in the same relative position.
 */
export function useScrollAnchor<A extends { id: string }>({
  sections,
  showDateHeaders,
  scrollContainerRef,
  containerRef,
  anchorAssetId,
  onWidthChange,
}: UseScrollAnchorOptions<A>): UseScrollAnchorResult {
  // Track the first visible asset for anchoring when no photo is open
  const firstVisibleAssetIdRef = useRef<string | null>(null)

  // Track previous container width for resize detection
  const prevContainerWidthRef = useRef<number>(0)

  // Get the index of an asset in the flat list
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

  // Calculate scroll position for a given asset at a given container width
  const calculateScrollPositionForAsset = useCallback(
    (assetId: string, containerWidth: number): number | null => {
      const assetIndex = getAssetIndex(assetId)
      if (assetIndex === -1) {
        return null
      }

      // Calculate column count and thumbnail size for the given width
      const columnCount = Math.max(3, Math.floor(containerWidth / 130))
      const thumbSize = Math.floor(containerWidth / columnCount) - 1

      // Calculate scroll position by iterating through sections
      let scrollPosition = 0
      let currentAssetIndex = 0

      for (const section of sections) {
        const assetsInSection = section.assets.length
        const assetIndexInSection = assetIndex - currentAssetIndex

        if (assetIndexInSection >= 0 && assetIndexInSection < assetsInSection) {
          // Asset is in this section
          if (showDateHeaders) {
            scrollPosition += HEADER_HEIGHT
          }
          const rowIndex = Math.floor(assetIndexInSection / columnCount)
          scrollPosition += rowIndex * (thumbSize + ROW_GAP)
          return scrollPosition
        }

        // Add header height
        if (showDateHeaders) {
          scrollPosition += HEADER_HEIGHT
        }

        // Add all rows in this section
        const rowsInSection = Math.ceil(assetsInSection / columnCount)
        scrollPosition += rowsInSection * (thumbSize + ROW_GAP)
        currentAssetIndex += assetsInSection
      }

      return null
    },
    [getAssetIndex, sections, showDateHeaders],
  )

  // Set the first visible asset ID
  const setFirstVisibleAssetId = useCallback((assetId: string | null) => {
    firstVisibleAssetIdRef.current = assetId
  }, [])

  // Observe container resize and anchor scroll position
  useEffect(() => {
    const container = containerRef.current
    const scrollContainer = scrollContainerRef.current
    if (!container) {
      return
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
        const oldWidth = prevContainerWidthRef.current

        // Only do anchoring logic if width actually changed
        if (oldWidth > 0 && Math.abs(newWidth - oldWidth) > 1) {
          const assetIdToAnchor = anchorAssetId ?? firstVisibleAssetIdRef.current
          if (assetIdToAnchor && scrollContainer) {
            const oldScrollPos = calculateScrollPositionForAsset(assetIdToAnchor, oldWidth)
            const newScrollPos = calculateScrollPositionForAsset(assetIdToAnchor, newWidth)

            if (oldScrollPos !== null && newScrollPos !== null) {
              const currentScroll = scrollContainer.scrollTop
              const offsetFromAnchor = currentScroll - oldScrollPos

              requestAnimationFrame(() => {
                if (scrollContainer) {
                  scrollContainer.scrollTop = newScrollPos + offsetFromAnchor
                }
              })
            }
          }
        }

        prevContainerWidthRef.current = newWidth
        onWidthChange(newWidth)
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [
    anchorAssetId,
    calculateScrollPositionForAsset,
    containerRef,
    onWidthChange,
    scrollContainerRef,
  ])

  return { setFirstVisibleAssetId }
}
