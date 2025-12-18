import type { TimeBucket } from '../components/timeline/TimelineScrubber'

export interface BucketLayout {
  /** Total estimated height of all content */
  totalHeight: number
  /** Array of bucket start positions (cumulative) */
  bucketPositions: number[]
  /** Height of each bucket based on its count */
  bucketHeights: number[]
}

/**
 * Calculate layout information for buckets based on their counts.
 * This gives us a proportional layout where scroll position maps to bucket position.
 *
 * @param buckets - Array of time buckets with counts
 * @param estimatedRowHeight - Estimated height per row of assets
 * @param assetsPerRow - Number of assets per row (columns)
 * @returns Layout information for positioning
 */
export function calculateBucketLayout(
  buckets: TimeBucket[],
  estimatedRowHeight: number,
  assetsPerRow: number,
): BucketLayout {
  const bucketHeights: number[] = []
  const bucketPositions: number[] = []
  let currentPosition = 0

  for (const bucket of buckets) {
    bucketPositions.push(currentPosition)
    const rows = Math.ceil(bucket.count / assetsPerRow)
    const height = rows * estimatedRowHeight
    bucketHeights.push(height)
    currentPosition += height
  }

  return {
    totalHeight: currentPosition,
    bucketPositions,
    bucketHeights,
  }
}

/**
 * Convert a scroll progress (0-1) to a bucket index.
 *
 * @param progress - Scroll progress from 0 to 1
 * @param layout - Bucket layout information
 * @returns Index of the bucket at this scroll position
 */
export function progressToBucketIndex(progress: number, layout: BucketLayout): number {
  if (layout.bucketPositions.length === 0) {
    return 0
  }

  const targetPosition = progress * layout.totalHeight

  // Binary search to find the bucket
  let low = 0
  let high = layout.bucketPositions.length - 1

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2)
    if (layout.bucketPositions[mid] <= targetPosition) {
      low = mid
    } else {
      high = mid - 1
    }
  }

  return low
}

/**
 * Convert a bucket index to scroll progress (0-1).
 *
 * @param bucketIndex - Index of the bucket
 * @param layout - Bucket layout information
 * @returns Scroll progress from 0 to 1
 */
export function bucketIndexToProgress(bucketIndex: number, layout: BucketLayout): number {
  if (layout.totalHeight === 0 || layout.bucketPositions.length === 0) {
    return 0
  }

  const clampedIndex = Math.max(0, Math.min(bucketIndex, layout.bucketPositions.length - 1))
  const position = layout.bucketPositions[clampedIndex] ?? 0
  return position / layout.totalHeight
}

/**
 * Calculate which buckets should be loaded for a given scroll position.
 * Returns a range of bucket indices to load around the target position.
 *
 * @param progress - Current scroll progress (0-1)
 * @param layout - Bucket layout information
 * @param bufferBuckets - Number of buckets to load before and after current position
 * @returns Object with start and end bucket indices to load
 */
export function getBucketsToLoad(
  progress: number,
  layout: BucketLayout,
  bufferBuckets = 5,
): { startIndex: number; endIndex: number } {
  const currentIndex = progressToBucketIndex(progress, layout)
  const totalBuckets = layout.bucketPositions.length

  const startIndex = Math.max(0, currentIndex - bufferBuckets)
  const endIndex = Math.min(totalBuckets, currentIndex + bufferBuckets + 1)

  return { startIndex, endIndex }
}

/**
 * Calculate scroll progress from actual scroll position and container dimensions.
 *
 * @param scrollTop - Current scroll position
 * @param scrollHeight - Total scrollable height
 * @param clientHeight - Visible height of container
 * @returns Progress from 0 to 1
 */
export function scrollToProgress(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const maxScroll = scrollHeight - clientHeight
  if (maxScroll <= 0) {
    return 0
  }
  return Math.max(0, Math.min(1, scrollTop / maxScroll))
}

/**
 * Convert progress to scroll position.
 *
 * @param progress - Progress from 0 to 1
 * @param scrollHeight - Total scrollable height
 * @param clientHeight - Visible height of container
 * @returns Scroll position (scrollTop value)
 */
export function progressToScroll(
  progress: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const maxScroll = scrollHeight - clientHeight
  return Math.max(0, progress * maxScroll)
}

