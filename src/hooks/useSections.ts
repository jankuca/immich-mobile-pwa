import { useMemo } from 'preact/hooks'
import type { AssetOrder, AssetTimelineItem } from '../services/api'

/** Section of assets grouped by date */
export interface TimelineSection<A> {
  date: string
  assets: A[]
}

interface UseSectionsOptions<A extends AssetTimelineItem> {
  /** All assets to group */
  assets: A[]
  /** Whether to show date headers (if false, all assets go in one section) */
  showDateHeaders: boolean
  /** Sort order for assets */
  order: AssetOrder
}

interface UseSectionsResult<A> {
  /** Assets grouped into sections by date */
  sections: TimelineSection<A>[]
  /** Map of bucket index to sections in that bucket */
  sectionsByBucket: Map<number, TimelineSection<A>[]>
}

/**
 * Groups assets into sections by date (and bucket index).
 * 
 * When showDateHeaders is true, assets are grouped by both bucket index and date,
 * ensuring that a date spanning multiple buckets creates separate sections per bucket.
 * 
 * When showDateHeaders is false, all assets are merged into a single section.
 */
export function useSections<A extends AssetTimelineItem>({
  assets,
  showDateHeaders,
  order,
}: UseSectionsOptions<A>): UseSectionsResult<A> {
  const sections = useMemo(() => {
    if (assets.length === 0) {
      return []
    }

    // If showDateHeaders is false, merge all assets into a single section
    if (!showDateHeaders) {
      const sortedAssets = [...assets].sort((a, b) => {
        const dateA = a.fileCreatedAt ? new Date(a.fileCreatedAt).getTime() : 0
        const dateB = b.fileCreatedAt ? new Date(b.fileCreatedAt).getTime() : 0
        return order === 'asc' ? dateA - dateB : dateB - dateA
      })
      return [{ date: 'all-assets', assets: sortedAssets }]
    }

    // Group by bucket index AND date
    // Key format: "bucketIndex:date" to ensure uniqueness per bucket
    const groupedByBucketAndDate: { [key: string]: A[] } = {}
    
    for (const asset of assets) {
      if (!asset.fileCreatedAt) {
        continue
      }

      // Use localDateTime if available, otherwise derive from fileCreatedAt (UTC)
      const date = asset.localDateTime ?? new Date(asset.fileCreatedAt).toISOString().split('T')[0]
      if (!date) {
        continue
      }

      const bucketIndex = asset._bucketIndex ?? -1
      const key = `${bucketIndex}:${date}`

      if (!groupedByBucketAndDate[key]) {
        groupedByBucketAndDate[key] = []
      }
      groupedByBucketAndDate[key].push(asset)
    }

    // Convert to array and sort by bucket index (primary) and date (secondary)
    const sortedSections = Object.entries(groupedByBucketAndDate)
      .map(([key, sectionAssets]) => {
        const [bucketIndexStr, date] = key.split(':')
        const bucketIndex = Number.parseInt(bucketIndexStr ?? '-1', 10)
        return { date: date ?? '', assets: sectionAssets, bucketIndex }
      })
      .sort((a, b) => {
        // Primary sort by bucket index
        if (a.bucketIndex !== b.bucketIndex) {
          return order === 'asc' ? b.bucketIndex - a.bucketIndex : a.bucketIndex - b.bucketIndex
        }
        // Secondary sort by date within the same bucket
        const timeA = new Date(a.date).getTime()
        const timeB = new Date(b.date).getTime()
        return order === 'asc' ? timeA - timeB : timeB - timeA
      })
      .map(({ date, assets: sectionAssets }) => ({ date, assets: sectionAssets }))

    return sortedSections
  }, [assets, showDateHeaders, order])

  // Group sections by the bucket index of their first asset
  const sectionsByBucket = useMemo(() => {
    const map = new Map<number, TimelineSection<A>[]>()
    
    for (const section of sections) {
      const firstAsset = section.assets[0]
      if (!firstAsset) {
        continue
      }
      
      const bucketIndex = firstAsset._bucketIndex
      if (bucketIndex === undefined) {
        continue
      }

      const existing = map.get(bucketIndex) ?? []
      existing.push(section)
      map.set(bucketIndex, existing)
    }
    
    return map
  }, [sections])

  return { sections, sectionsByBucket }
}

