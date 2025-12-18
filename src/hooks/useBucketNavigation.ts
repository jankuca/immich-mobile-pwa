import { useCallback, useMemo, useRef } from 'preact/hooks'

const HEADER_HEIGHT = 48

/** Bucket metadata for timeline skeleton */
export interface TimelineBucket {
  timeBucket: string
  count: number
}

/** Position and size info for a bucket in the timeline */
export interface BucketPosition {
  bucketIndex: number
  timeBucket: string
  top: number
  height: number
  loaded: boolean
}

/** Section of assets grouped by date within a bucket */
export interface TimelineSection<A> {
  date: string
  assets: A[]
}

interface UseBucketNavigationOptions<A> {
  /** All buckets defining the full timeline structure */
  allBuckets: TimelineBucket[] | undefined
  /** Sections grouped by bucket index */
  sectionsByBucket: Map<number, TimelineSection<A>[]>
  /** Number of columns in the grid */
  columnCount: number
  /** Height of each row in pixels */
  rowHeight: number
  /** Whether to show date headers */
  showDateHeaders: boolean
  /** Ref to the scroll container */
  scrollContainerRef: { current: HTMLDivElement | null }
}

interface UseBucketNavigationResult {
  /** Calculated positions for all buckets */
  bucketPositions: BucketPosition[]
  /** Total height of all buckets */
  totalHeight: number
  /** Current bucket index the user is viewing */
  currentBucketIndex: number
  /** Scroll to a specific bucket by index */
  scrollToBucket: (bucketIndex: number) => void
  /** Get bucket indices that should be loaded based on current position */
  getBucketsToLoad: (loadRadius?: number) => number[]
  /** Update current bucket tracking (call on scroll) */
  updateCurrentBucket: (scrollTop: number) => void
  /** Clear height cache (call when buckets are reset) */
  clearHeightCache: () => void
}

export function useBucketNavigation<A>({
  allBuckets,
  sectionsByBucket,
  columnCount,
  rowHeight,
  showDateHeaders,
  scrollContainerRef,
}: UseBucketNavigationOptions<A>): UseBucketNavigationResult {
  // Cache of bucket heights - once a bucket is loaded, we lock its height
  const bucketHeightCacheRef = useRef<Map<number, number>>(new Map())

  // Current bucket tracking - independent of scroll position pixel value
  const currentBucketIndexRef = useRef<number>(0)
  const offsetWithinBucketRef = useRef<number>(0)

  // Calculate bucket positions
  const bucketPositions: BucketPosition[] = useMemo(() => {
    if (!allBuckets || allBuckets.length === 0 || rowHeight === 0) {
      return []
    }

    const positions: BucketPosition[] = []
    let currentTop = 0
    const heightCache = bucketHeightCacheRef.current

    for (let i = 0; i < allBuckets.length; i++) {
      const bucket = allBuckets[i]
      if (!bucket) {
        continue
      }

      const bucketSections = sectionsByBucket.get(i)
      const isLoaded = bucketSections !== undefined && bucketSections.length > 0

      let bucketHeight: number
      const cachedHeight = heightCache.get(i)

      if (cachedHeight !== undefined) {
        // Use cached height
        bucketHeight = cachedHeight
      } else if (isLoaded) {
        // Calculate actual height and cache it
        let height = 0
        for (const section of bucketSections) {
          if (showDateHeaders) {
            height += HEADER_HEIGHT
          }
          const sectionRowCount = Math.ceil(section.assets.length / columnCount)
          height += sectionRowCount * rowHeight
        }
        bucketHeight = height
        heightCache.set(i, bucketHeight)
      } else {
        // Estimate height for unloaded bucket
        const bucketRowCount = Math.ceil(bucket.count / columnCount)
        const headerHeight = showDateHeaders ? HEADER_HEIGHT : 0
        bucketHeight = headerHeight + bucketRowCount * rowHeight
      }

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
  }, [allBuckets, sectionsByBucket, columnCount, rowHeight, showDateHeaders])

  // Total height
  const totalHeight = useMemo(() => {
    if (bucketPositions.length === 0) {
      return 0
    }
    const lastBucket = bucketPositions.at(-1)
    return lastBucket ? lastBucket.top + lastBucket.height : 0
  }, [bucketPositions])

  // Find bucket index at a given scroll position using binary search
  const findBucketAtPosition = useCallback(
    (scrollTop: number): number => {
      if (bucketPositions.length === 0) {
        return 0
      }

      // Binary search for the bucket containing scrollTop
      let low = 0
      let high = bucketPositions.length - 1

      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2)
        const bucket = bucketPositions[mid]
        if (bucket && bucket.top <= scrollTop) {
          low = mid
        } else {
          high = mid - 1
        }
      }

      return low
    },
    [bucketPositions],
  )

  // Update current bucket based on scroll position
  const updateCurrentBucket = useCallback(
    (scrollTop: number) => {
      if (bucketPositions.length === 0) {
        return
      }

      const prevIdx = currentBucketIndexRef.current
      const currentBucket = bucketPositions[currentBucketIndexRef.current]
      if (!currentBucket) {
        // Current bucket index is invalid, do a full lookup
        const newIndex = findBucketAtPosition(scrollTop)
        currentBucketIndexRef.current = newIndex
        const newBucket = bucketPositions[newIndex]
        if (newBucket) {
          offsetWithinBucketRef.current = scrollTop - newBucket.top
        }
        console.log(
          '[updateCurrentBucket] invalid bucket, lookup:',
          prevIdx,
          '->',
          newIndex,
          'scrollTop:',
          scrollTop,
        )
        return
      }

      const currentBucketTop = currentBucket.top
      const newOffset = scrollTop - currentBucketTop

      // Check if scrolled into different bucket
      if (newOffset < 0) {
        if (currentBucketIndexRef.current > 0) {
          // Check if we're in the immediately previous bucket or further
          const prevBucket = bucketPositions[currentBucketIndexRef.current - 1]
          if (prevBucket && scrollTop >= prevBucket.top) {
            // Simple case: moved into previous bucket
            currentBucketIndexRef.current--
            offsetWithinBucketRef.current = scrollTop - prevBucket.top
            console.log(
              '[updateCurrentBucket] prev bucket:',
              prevIdx,
              '->',
              currentBucketIndexRef.current,
            )
          } else {
            // Large jump: do a full lookup
            const newIndex = findBucketAtPosition(scrollTop)
            currentBucketIndexRef.current = newIndex
            const newBucket = bucketPositions[newIndex]
            if (newBucket) {
              offsetWithinBucketRef.current = scrollTop - newBucket.top
            }
            console.log(
              '[updateCurrentBucket] large jump up:',
              prevIdx,
              '->',
              newIndex,
              'scrollTop:',
              scrollTop,
            )
          }
        }
      } else if (newOffset >= currentBucket.height) {
        if (currentBucketIndexRef.current < bucketPositions.length - 1) {
          // Check if we're in the immediately next bucket or further
          const nextBucket = bucketPositions[currentBucketIndexRef.current + 1]
          if (nextBucket && scrollTop < nextBucket.top + nextBucket.height) {
            // Simple case: moved into next bucket
            currentBucketIndexRef.current++
            offsetWithinBucketRef.current = scrollTop - nextBucket.top
            console.log(
              '[updateCurrentBucket] next bucket:',
              prevIdx,
              '->',
              currentBucketIndexRef.current,
            )
          } else {
            // Large jump: do a full lookup
            const newIndex = findBucketAtPosition(scrollTop)
            currentBucketIndexRef.current = newIndex
            const newBucket = bucketPositions[newIndex]
            if (newBucket) {
              offsetWithinBucketRef.current = scrollTop - newBucket.top
            }
            console.log(
              '[updateCurrentBucket] large jump down:',
              prevIdx,
              '->',
              newIndex,
              'scrollTop:',
              scrollTop,
            )
          }
        }
      } else {
        offsetWithinBucketRef.current = newOffset
      }
    },
    [bucketPositions, findBucketAtPosition],
  )

  // Scroll to a specific bucket
  const scrollToBucket = useCallback(
    (bucketIndex: number) => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) {
        return
      }

      const bucketPos = bucketPositions[bucketIndex]
      if (bucketPos) {
        // Update tracking BEFORE scrolling
        currentBucketIndexRef.current = bucketIndex
        offsetWithinBucketRef.current = 0
        scrollContainer.scrollTop = bucketPos.top
      }
    },
    [bucketPositions, scrollContainerRef],
  )

  // Get bucket indices to load based on current position
  const getBucketsToLoad = useCallback(
    (loadRadius = 2): number[] => {
      if (bucketPositions.length === 0) {
        return []
      }

      const currentIdx = currentBucketIndexRef.current
      const bucketsToLoad: number[] = []

      for (
        let i = Math.max(0, currentIdx - loadRadius);
        i <= Math.min(bucketPositions.length - 1, currentIdx + loadRadius);
        i++
      ) {
        const bp = bucketPositions[i]
        if (bp && !bp.loaded) {
          bucketsToLoad.push(bp.bucketIndex)
        }
      }

      if (bucketsToLoad.length > 0) {
        console.log(
          '[getBucketsToLoad] currentIdx:',
          currentIdx,
          'loading:',
          bucketsToLoad.map((i) => bucketPositions[i]?.timeBucket),
        )
      }

      return bucketsToLoad
    },
    [bucketPositions],
  )

  // Clear height cache (e.g., when all data is reset)
  const clearHeightCache = useCallback(() => {
    bucketHeightCacheRef.current.clear()
    currentBucketIndexRef.current = 0
    offsetWithinBucketRef.current = 0
  }, [])

  return {
    bucketPositions,
    totalHeight,
    currentBucketIndex: currentBucketIndexRef.current,
    scrollToBucket,
    getBucketsToLoad,
    updateCurrentBucket,
    clearHeightCache,
  }
}
