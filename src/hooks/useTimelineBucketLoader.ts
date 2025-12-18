import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { type AssetOrder, type AssetTimelineItem, apiService } from '../services/api'

/** Bucket metadata for timeline skeleton */
export interface TimelineBucket {
  timeBucket: string
  count: number
}

/** Filter options for loading buckets */
export interface BucketLoaderFilters {
  albumId?: string
  personId?: string
  isFavorite?: boolean
  isArchived?: boolean
  isTrashed?: boolean
  order?: AssetOrder
}

/** Options for the bucket loader hook */
export interface UseTimelineBucketLoaderOptions {
  /** Filter options for the timeline */
  filters?: BucketLoaderFilters
  /** Number of buckets to load at once (default: 3) */
  bucketsPerLoad?: number
  /** Maximum number of buckets to keep loaded (default: 24) */
  maxLoadedBuckets?: number
}

/** Return value of the bucket loader hook */
export interface UseTimelineBucketLoaderResult<A extends AssetTimelineItem> {
  /** All bucket metadata */
  buckets: TimelineBucket[]
  /** Loaded assets (sorted by date descending) */
  assets: A[]
  /** Set of bucket indices that have been loaded */
  loadedBucketIndices: Set<number>
  /** Set of bucket indices currently being loaded */
  loadingBucketIndices: Set<number>
  /** Whether initial bucket metadata is loading */
  isLoading: boolean
  /** Error message if loading failed */
  error: string | null
  /** Load a specific bucket by index */
  loadBucket: (bucketIndex: number) => void
  /** Load a range of buckets around an index */
  loadBucketsAround: (bucketIndex: number, buffer?: number) => void
  /** Cancel any in-flight requests */
  cancelPendingLoads: () => void
  /** Whether scrubbing is active (disables some behaviors) */
  isScrubbing: boolean
  /** Set scrubbing state */
  setIsScrubbing: (value: boolean) => void
  /** Get current visible bucket index based on a date string */
  getBucketIndexForDate: (date: string) => number
  /** Update visible bucket index for cleanup purposes */
  updateVisibleBucketIndex: (date: string) => void
}

/**
 * Hook that manages loading timeline buckets on demand.
 * Handles fetching bucket metadata, loading individual buckets,
 * tracking loaded/loading state, cleanup of distant buckets, and abort handling.
 */
export function useTimelineBucketLoader<A extends AssetTimelineItem = AssetTimelineItem>(
  options: UseTimelineBucketLoaderOptions = {},
): UseTimelineBucketLoaderResult<A> {
  const { filters = {}, bucketsPerLoad = 3, maxLoadedBuckets = 24 } = options

  // State
  const [buckets, setBuckets] = useState<TimelineBucket[]>([])
  const [assets, setAssets] = useState<A[]>([])
  const [loadedBucketIndices, setLoadedBucketIndices] = useState<Set<number>>(new Set())
  const [loadingBucketIndices, setLoadingBucketIndices] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)

  // Refs for synchronous access (avoid stale closure issues)
  const loadedBucketsRef = useRef<Set<number>>(new Set())
  const loadingBucketsRef = useRef<Set<number>>(new Set())
  const abortControllerRef = useRef<AbortController | null>(null)
  const isScrubbingRef = useRef(false)
  const visibleBucketIndexRef = useRef(0)

  // Sync scrubbing ref
  useEffect(() => {
    isScrubbingRef.current = isScrubbing
  }, [isScrubbing])

  // Create a stable filters key for effect dependencies
  const filtersKey = JSON.stringify(filters)

  // Cancel pending loads
  const cancelPendingLoads = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    loadingBucketsRef.current.clear()
    setLoadingBucketIndices(new Set())
  }, [])

  // Get bucket index for a date
  const getBucketIndexForDate = useCallback(
    (date: string): number => {
      const dateDay = date.split('T')[0]
      for (let i = 0; i < buckets.length; i++) {
        const bucketDay = buckets[i]?.timeBucket.split('T')[0]
        if (bucketDay === dateDay) {
          return i
        }
      }
      return -1
    },
    [buckets],
  )

  // Get visible bucket index (for cleanup)
  const getVisibleBucketIndex = useCallback(() => {
    return visibleBucketIndexRef.current
  }, [])

  // Cleanup distant buckets when too many are loaded
  const cleanupDistantBuckets = useCallback(
    (allBuckets: TimelineBucket[]) => {
      // Skip cleanup during scrubbing
      if (isScrubbingRef.current) {
        return
      }

      const loadedSet = loadedBucketsRef.current
      if (loadedSet.size <= maxLoadedBuckets) {
        return
      }

      const visibleIndex = getVisibleBucketIndex()
      const windowStart = Math.max(0, visibleIndex - Math.floor(maxLoadedBuckets / 2))
      const windowEnd = Math.min(allBuckets.length, windowStart + maxLoadedBuckets)

      const indicesToKeep = new Set<number>()
      for (let i = windowStart; i < windowEnd; i++) {
        indicesToKeep.add(i)
      }

      const indicesToUnload: number[] = []
      for (const loadedIndex of loadedSet) {
        if (loadedIndex < windowStart || loadedIndex >= windowEnd) {
          indicesToUnload.push(loadedIndex)
        }
      }

      if (indicesToUnload.length === 0) {
        return
      }

      for (const index of indicesToUnload) {
        loadedSet.delete(index)
      }

      setAssets(
        (prev) =>
          prev.filter(
            (asset) => asset._bucketIndex !== undefined && indicesToKeep.has(asset._bucketIndex),
          ) as A[],
      )
      setLoadedBucketIndices(new Set(loadedSet))
    },
    [maxLoadedBuckets, getVisibleBucketIndex],
  )

  // Load a range of buckets
  const loadBucketRange = useCallback(
    async (allBuckets: TimelineBucket[], startIndex: number, count: number) => {
      const endIndex = Math.min(startIndex + count, allBuckets.length)
      const indicesToLoad: number[] = []

      const loadedSet = loadedBucketsRef.current
      const loadingSet = loadingBucketsRef.current

      for (let i = startIndex; i < endIndex; i++) {
        if (!loadedSet.has(i) && !loadingSet.has(i)) {
          indicesToLoad.push(i)
          loadingSet.add(i)
        }
      }

      if (indicesToLoad.length === 0) {
        return
      }

      setLoadingBucketIndices(new Set(loadingSet))

      let abortController = abortControllerRef.current
      if (!abortController) {
        abortController = new AbortController()
        abortControllerRef.current = abortController
      }

      try {
        const loadPromises = indicesToLoad.map(async (index) => {
          const bucket = allBuckets[index]
          if (!bucket) {
            return { index, assets: [] as A[], error: false, aborted: false }
          }

          try {
            const bucketAssets = await apiService.getTimeBucket(
              {
                timeBucket: bucket.timeBucket,
                size: 'DAY',
                ...filters,
              },
              abortController.signal,
            )

            if (Array.isArray(bucketAssets)) {
              return { index, assets: bucketAssets as A[], error: false, aborted: false }
            }
            return { index, assets: [] as A[], error: false, aborted: false }
          } catch (err) {
            if (err instanceof Error && err.name === 'CanceledError') {
              return { index, assets: [] as A[], error: false, aborted: true }
            }
            console.error(`Error fetching bucket ${bucket.timeBucket}:`, err)
            return { index, assets: [] as A[], error: true, aborted: false }
          }
        })

        const results = await Promise.all(loadPromises)
        const newAssets: A[] = []

        for (const result of results) {
          loadingSet.delete(result.index)

          if (result.aborted || result.error) {
            continue
          }

          loadedSet.add(result.index)
          for (const asset of result.assets) {
            asset._bucketIndex = result.index
          }
          newAssets.push(...result.assets)
        }

        if (newAssets.length > 0) {
          setAssets((prev) => {
            const combined = [...prev, ...newAssets]
            const seen = new Set<string>()
            const deduplicated = combined.filter((asset) => {
              if (seen.has(asset.id)) {
                return false
              }
              seen.add(asset.id)
              return true
            })
            deduplicated.sort((a, b) => {
              const dateA = new Date(a.fileCreatedAt).getTime()
              const dateB = new Date(b.fileCreatedAt).getTime()
              return filters.order === 'asc' ? dateA - dateB : dateB - dateA
            })
            return deduplicated
          })
          setLoadedBucketIndices(new Set(loadedSet))
        }

        setLoadingBucketIndices(new Set(loadingSet))
        cleanupDistantBuckets(allBuckets)

        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      } catch (_err) {
        for (const index of indicesToLoad) {
          loadingSet.delete(index)
        }
        setLoadingBucketIndices(new Set(loadingSet))
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      }
    },
    [filters, cleanupDistantBuckets],
  )

  // Public: Load a specific bucket
  const loadBucket = useCallback(
    (bucketIndex: number) => {
      if (isScrubbingRef.current) {
        return
      }
      const buffer = Math.floor(bucketsPerLoad / 2)
      const startIndex = Math.max(0, bucketIndex - buffer)
      loadBucketRange(buckets, startIndex, bucketsPerLoad)
    },
    [buckets, bucketsPerLoad, loadBucketRange],
  )

  // Public: Load buckets around an index
  const loadBucketsAround = useCallback(
    (bucketIndex: number, buffer = 3) => {
      const startIndex = Math.max(0, bucketIndex - buffer)
      loadBucketRange(buckets, startIndex, buffer * 2 + 1)
    },
    [buckets, loadBucketRange],
  )

  // Update visible bucket index (called by consumers on visible date change)
  const updateVisibleBucketIndex = useCallback(
    (date: string) => {
      const index = getBucketIndexForDate(date)
      if (index >= 0) {
        visibleBucketIndexRef.current = index
      }
    },
    [getBucketIndexForDate],
  )

  // Fetch initial bucket metadata
  // biome-ignore lint/correctness/useExhaustiveDependencies: filtersKey captures all filter changes
  useEffect(() => {
    // Reset state when filters change
    loadedBucketsRef.current = new Set()
    loadingBucketsRef.current = new Set()
    setAssets([])
    setLoadedBucketIndices(new Set())
    setLoadingBucketIndices(new Set())

    const fetchBuckets = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await apiService.getTimeBuckets({
          size: 'DAY',
          isTrashed: filters.isTrashed ?? false,
          ...filters,
        })

        setBuckets(response)

        if (response.length === 0) {
          setIsLoading(false)
          return
        }

        // Load initial buckets
        await loadBucketRange(response, 0, bucketsPerLoad)
      } catch (err) {
        console.error('Error fetching buckets:', err)
        setError('Failed to load photos. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBuckets()

    return () => {
      cancelPendingLoads()
    }
  }, [filtersKey, bucketsPerLoad])

  return {
    buckets,
    assets,
    loadedBucketIndices,
    loadingBucketIndices,
    isLoading,
    error,
    loadBucket,
    loadBucketsAround,
    cancelPendingLoads,
    isScrubbing,
    setIsScrubbing,
    getBucketIndexForDate,
    updateVisibleBucketIndex,
  }
}
