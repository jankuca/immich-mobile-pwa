import { useMemo } from 'preact/hooks'
import type { BucketPosition, TimelineSection } from './useBucketNavigation'

const HEADER_HEIGHT = 48

/** Layout item - either a header or a row of assets */
export interface LayoutItem<A> {
  type: 'header' | 'row'
  key: string
  top: number
  height: number
  date: string
  /** Assets in this row (for row type) */
  assets?: A[]
  /** Row index within the section (for row type) */
  rowIndex?: number
  /** Whether this is a placeholder (unloaded bucket) */
  isPlaceholder?: boolean
  /** Whether this is a collapsed bucket placeholder */
  isBucketPlaceholder?: boolean
  /** Bucket index this item belongs to (for placeholder loading state) */
  bucketIndex?: number
}

interface UseTimelineLayoutOptions<A> {
  /** Sections grouped by date */
  sections: TimelineSection<A>[]
  /** Map of bucket index to sections */
  sectionsByBucket: Map<number, TimelineSection<A>[]>
  /** Calculated bucket positions */
  bucketPositions: BucketPosition[]
  /** Total height from bucket skeleton */
  skeletonTotalHeight: number
  /** Number of columns in the grid */
  columnCount: number
  /** Height of each row */
  rowHeight: number
  /** Size of each thumbnail */
  thumbnailSize: number
  /** Whether to show date headers */
  showDateHeaders: boolean
  /** Current scroll position */
  scrollTop: number
  /** Height of the viewport */
  viewportHeight: number
}

interface UseTimelineLayoutResult<A> {
  /** All layout items (headers and rows) */
  layout: LayoutItem<A>[]
  /** Total height of the layout */
  totalHeight: number
}

/**
 * Calculates the layout of all items (headers and rows) with their positions.
 *
 * When bucket positions are available, uses skeleton-based layout for accurate
 * positioning across loaded and unloaded buckets.
 *
 * Falls back to simple section-based layout when no bucket metadata is available.
 */
export function useTimelineLayout<A>({
  sections,
  sectionsByBucket,
  bucketPositions,
  skeletonTotalHeight,
  columnCount,
  rowHeight,
  thumbnailSize,
  showDateHeaders,
  scrollTop,
  viewportHeight,
}: UseTimelineLayoutOptions<A>): UseTimelineLayoutResult<A> {
  const { layout, totalHeight } = useMemo(() => {
    // If we have bucket positions, use skeleton-based layout
    if (bucketPositions.length > 0 && thumbnailSize > 0) {
      const items: LayoutItem<A>[] = []

      // Determine visible range for layout generation (with generous buffer)
      const layoutBuffer = viewportHeight * 3
      const layoutVisibleTop = Math.max(0, scrollTop - layoutBuffer)
      const layoutVisibleBottom = scrollTop + viewportHeight + layoutBuffer

      for (const bucketPos of bucketPositions) {
        const bucketBottom = bucketPos.top + bucketPos.height
        const isNearVisible = bucketBottom > layoutVisibleTop && bucketPos.top < layoutVisibleBottom

        const bucketSections = sectionsByBucket.get(bucketPos.bucketIndex)

        if (bucketSections && bucketSections.length > 0) {
          // Bucket is loaded - render all sections
          let offsetWithinBucket = 0

          for (const section of bucketSections) {
            if (showDateHeaders) {
              items.push({
                type: 'header',
                key: `header-${section.date}`,
                top: bucketPos.top + offsetWithinBucket,
                height: HEADER_HEIGHT,
                date: section.date,
              })
              offsetWithinBucket += HEADER_HEIGHT
            }

            const sectionRowCount = Math.ceil(section.assets.length / columnCount)
            for (let rowIndex = 0; rowIndex < sectionRowCount; rowIndex++) {
              const startAsset = rowIndex * columnCount
              const endAsset = Math.min(startAsset + columnCount, section.assets.length)
              items.push({
                type: 'row',
                key: `row-${section.date}-${rowIndex}`,
                top: bucketPos.top + offsetWithinBucket,
                height: rowHeight,
                date: section.date,
                assets: section.assets.slice(startAsset, endAsset),
                rowIndex,
              })
              offsetWithinBucket += rowHeight
            }
          }
        } else if (isNearVisible) {
          // Bucket is not loaded but near visible - render placeholder
          let offsetWithinBucket = 0

          if (showDateHeaders) {
            items.push({
              type: 'header',
              key: `header-placeholder-${bucketPos.timeBucket}`,
              top: bucketPos.top + offsetWithinBucket,
              height: HEADER_HEIGHT,
              date: bucketPos.timeBucket,
              isPlaceholder: true,
              bucketIndex: bucketPos.bucketIndex,
            })
            offsetWithinBucket += HEADER_HEIGHT
          }

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
              bucketIndex: bucketPos.bucketIndex,
            })
            offsetWithinBucket += rowHeight
          }
        } else {
          // Far from visible range - single bucket placeholder
          items.push({
            type: 'header',
            key: `header-placeholder-${bucketPos.timeBucket}`,
            top: bucketPos.top,
            height: bucketPos.height,
            date: bucketPos.timeBucket,
            isPlaceholder: true,
            isBucketPlaceholder: true,
            bucketIndex: bucketPos.bucketIndex,
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
  }, [
    bucketPositions,
    columnCount,
    rowHeight,
    scrollTop,
    sections,
    sectionsByBucket,
    showDateHeaders,
    skeletonTotalHeight,
    thumbnailSize,
    viewportHeight,
  ])

  return { layout, totalHeight }
}
