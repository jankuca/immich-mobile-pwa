import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { Header } from '../../components/common/Header'
import { PhotoViewer } from '../../components/photoView/PhotoViewer'
import { SearchInput } from '../../components/search/SearchInput'
import { SearchInputWrapper } from '../../components/search/SearchInputWrapper'
import { type TimeBucket, TimelineScrubber } from '../../components/timeline/TimelineScrubber'
import {
  type GetThumbnailPosition,
  VirtualizedTimeline,
} from '../../components/timeline/VirtualizedTimeline'
import { useAuth } from '../../contexts/AuthContext'
import { useTimelineSearch } from '../../hooks/useTimelineSearch'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import { type AssetTimelineItem, apiService } from '../../services/api'

export function Timeline() {
  const [assets, setAssets] = useState<AssetTimelineItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetTimelineItem | null>(null)
  const [selectedThumbnailPosition, setSelectedThumbnailPosition] =
    useState<ThumbnailPosition | null>(null)
  // Store full bucket info with counts
  const [allBuckets, setAllBuckets] = useState<TimeBucket[]>([])
  // Track which buckets have been loaded (by index)
  const [loadedBuckets, setLoadedBuckets] = useState<Set<number>>(new Set())
  const [hasMoreContent, setHasMoreContent] = useState<boolean>(true)
  // Current visible date for scrubber (from VirtualizedTimeline)
  const [visibleDate, setVisibleDate] = useState<string | null>(null)
  // Ref to the scroll container for programmatic scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // Track if we're currently scrubbing to avoid scroll event conflicts
  const isScrubbing = useRef(false)
  const { logout } = useAuth()

  // Search state
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    isSearching,
    searchResults,
    error: searchError,
  } = useTimelineSearch()

  // Determine if we're in search mode
  const isSearchMode = searchQuery.trim().length > 0 || searchResults !== null

  // Store the thumbnail position getter from VirtualizedTimeline
  const [getThumbnailPosition, setGetThumbnailPosition] = useState<GetThumbnailPosition | null>(
    null,
  )

  // Number of buckets to load at once
  const bucketsPerLoad = 3

  // Find the next unloaded bucket index starting from the end of loaded range
  const getNextUnloadedIndex = useCallback(() => {
    // Find the first gap or continue from the end
    for (let i = 0; i < allBuckets.length; i++) {
      if (!loadedBuckets.has(i)) {
        return i
      }
    }
    return allBuckets.length
  }, [allBuckets.length, loadedBuckets])

  // Find the bucket index for a given date
  const getBucketIndexForDate = useCallback(
    (date: string): number => {
      for (let i = 0; i < allBuckets.length; i++) {
        const bucketDate = allBuckets[i]?.timeBucket.split('T')[0]
        if (bucketDate === date) {
          return i
        }
      }
      return -1
    },
    [allBuckets],
  )

  // Fetch initial timeline data
  useEffect(() => {
    const fetchInitialTimeline = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Get time buckets (days) - store full bucket info with counts
        const timeBucketsResponse = await apiService.getTimeBuckets({
          size: 'DAY',
          isTrashed: false,
        })

        setAllBuckets(timeBucketsResponse)

        // If no buckets, set hasMoreContent to false
        if (timeBucketsResponse.length === 0) {
          setHasMoreContent(false)
          setIsLoading(false)
          return
        }

        // Load the first batch of buckets
        await loadBucketRange(timeBucketsResponse, 0, bucketsPerLoad)
      } catch (err) {
        console.error('Error fetching timeline:', err)
        setError('Failed to load photos. Please try again.')
        setIsLoading(false)
      }
    }

    fetchInitialTimeline()
  }, [])

  // Function to load a specific range of buckets
  const loadBucketRange = useCallback(
    async (buckets: TimeBucket[], startIndex: number, count: number) => {
      const endIndex = Math.min(startIndex + count, buckets.length)
      const indicesToLoad: number[] = []

      // Collect indices that haven't been loaded yet
      for (let i = startIndex; i < endIndex; i++) {
        if (!loadedBuckets.has(i)) {
          indicesToLoad.push(i)
        }
      }

      if (indicesToLoad.length === 0) {
        setIsLoading(false)
        setIsLoadingMore(false)
        return
      }

      try {
        if (startIndex > 0) {
          setIsLoadingMore(true)
        }

        const newAssets: AssetTimelineItem[] = []
        const newLoadedIndices: number[] = []

        // Load assets for each bucket
        for (const index of indicesToLoad) {
          const bucket = buckets[index]
          if (!bucket) {
            continue
          }
          try {
            const bucketAssets = await apiService.getTimeBucket({
              timeBucket: bucket.timeBucket,
              size: 'DAY',
              isTrashed: false,
            })

            if (Array.isArray(bucketAssets)) {
              newAssets.push(...bucketAssets)
              newLoadedIndices.push(index)
            } else {
              console.warn(
                `Unexpected response format for bucket ${bucket.timeBucket}:`,
                bucketAssets,
              )
            }
          } catch (bucketError) {
            console.error(`Error fetching assets for bucket ${bucket.timeBucket}:`, bucketError)
          }
        }

        // Update loaded buckets set
        setLoadedBuckets((prev) => {
          const next = new Set(prev)
          for (const i of newLoadedIndices) {
            next.add(i)
          }
          return next
        })

        // Update assets - need to insert in correct position based on bucket order
        setAssets((prevAssets) => {
          // For now, append and re-sort by date (descending for timeline)
          const combined = [...prevAssets, ...newAssets]
          combined.sort((a, b) => {
            const dateA = new Date(a.fileCreatedAt).getTime()
            const dateB = new Date(b.fileCreatedAt).getTime()
            return dateB - dateA // Descending order
          })
          return combined
        })

        // Check if all buckets are loaded
        const totalLoaded = loadedBuckets.size + newLoadedIndices.length
        if (totalLoaded >= buckets.length) {
          setHasMoreContent(false)
        }
      } catch (err) {
        console.error('Error loading bucket range:', err)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [loadedBuckets],
  )

  // Handle loading more content (sequential loading from current position)
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMoreContent) {
      return
    }
    const nextIndex = getNextUnloadedIndex()
    loadBucketRange(allBuckets, nextIndex, bucketsPerLoad)
  }, [allBuckets, getNextUnloadedIndex, isLoadingMore, hasMoreContent, loadBucketRange])

  // Load buckets around a specific date if not already loaded
  const loadBucketsAroundDate = useCallback(
    (date: string) => {
      const bucketIndex = getBucketIndexForDate(date)
      if (bucketIndex === -1) {
        return
      }

      // Check if buckets around this index need loading
      const bufferBuckets = 3
      const startIndex = Math.max(0, bucketIndex - bufferBuckets)
      const endIndex = Math.min(allBuckets.length, bucketIndex + bufferBuckets + 1)

      let needsLoading = false
      for (let i = startIndex; i < endIndex; i++) {
        if (!loadedBuckets.has(i)) {
          needsLoading = true
          break
        }
      }

      if (needsLoading && !isLoadingMore) {
        loadBucketRange(allBuckets, startIndex, endIndex - startIndex)
      }
    },
    [allBuckets, getBucketIndexForDate, isLoadingMore, loadBucketRange, loadedBuckets],
  )

  // Debounce timer ref for bucket loading during scrub
  const scrubLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Find the scroll position for a target bucket date within loaded assets
  const scrollToBucketDate = useCallback(
    (targetDate: string) => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer || assets.length === 0) {
        return
      }

      // Calculate layout constants (must match VirtualizedTimeline)
      const HEADER_HEIGHT = 48
      const ROW_GAP = 2
      const containerWidth = scrollContainer.clientWidth
      const columnCount = Math.max(3, Math.floor(containerWidth / 120))
      const thumbnailSize = Math.floor(containerWidth / columnCount) - 1
      const rowHeight = thumbnailSize + ROW_GAP

      // Group assets by date (same logic as VirtualizedTimeline)
      const dateGroups = new Map<string, number>()
      for (const asset of assets) {
        const dateStr = new Date(asset.fileCreatedAt ?? 0).toISOString().split('T')[0] ?? ''
        dateGroups.set(dateStr, (dateGroups.get(dateStr) ?? 0) + 1)
      }

      // Sort dates descending
      const sortedDates = Array.from(dateGroups.keys()).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime(),
      )

      // Find scroll position for target date
      let scrollPosition = 0
      for (const date of sortedDates) {
        if (date <= targetDate) {
          // Found the target date (or first date before it)
          break
        }
        // Add header height for this section
        scrollPosition += HEADER_HEIGHT
        // Add rows for this section
        const assetCount = dateGroups.get(date) ?? 0
        const rowCount = Math.ceil(assetCount / columnCount)
        scrollPosition += rowCount * rowHeight
      }

      scrollContainer.scrollTop = scrollPosition
    },
    [assets],
  )

  // Handle scrubber drag - load buckets for the target bucket index
  const handleScrub = useCallback(
    (bucketIndex: number) => {
      isScrubbing.current = true

      // Get the target bucket's date and scroll to it
      const targetBucket = allBuckets[bucketIndex]
      if (targetBucket) {
        const targetDate = targetBucket.timeBucket.split('T')[0] ?? ''
        scrollToBucketDate(targetDate)
      }

      // Debounced bucket loading during drag
      if (scrubLoadTimerRef.current) {
        clearTimeout(scrubLoadTimerRef.current)
      }

      scrubLoadTimerRef.current = setTimeout(() => {
        // Load buckets around the target position
        const bufferBuckets = 3
        const startIndex = Math.max(0, bucketIndex - bufferBuckets)
        loadBucketRange(allBuckets, startIndex, bufferBuckets * 2 + 1)
      }, 150) // 150ms debounce
    },
    [allBuckets, loadBucketRange, scrollToBucketDate],
  )

  // Handle scrubber drag end - trigger immediate bucket loading for the final position
  const handleScrubEnd = useCallback(
    (bucketIndex: number) => {
      isScrubbing.current = false

      // Clear any pending debounced load
      if (scrubLoadTimerRef.current) {
        clearTimeout(scrubLoadTimerRef.current)
        scrubLoadTimerRef.current = null
      }

      // Load buckets around the target position, then scroll to the correct position
      const bufferBuckets = 5
      const startIndex = Math.max(0, bucketIndex - bufferBuckets)
      const targetBucket = allBuckets[bucketIndex]
      const targetDate = targetBucket?.timeBucket.split('T')[0] ?? ''

      loadBucketRange(allBuckets, startIndex, bufferBuckets * 2 + 1).then(() => {
        // After loading, scroll to the actual position of the target date
        scrollToBucketDate(targetDate)
      })
    },
    [allBuckets, loadBucketRange, scrollToBucketDate],
  )

  // Handle visible date change from VirtualizedTimeline
  const handleVisibleDateChange = useCallback(
    (date: string) => {
      // Only update if not currently scrubbing
      if (!isScrubbing.current) {
        setVisibleDate(date)
        // Load buckets around the visible date to fill in any gaps
        loadBucketsAroundDate(date)
      }
    },
    [loadBucketsAroundDate],
  )

  // Handle asset selection
  const handleAssetClick = (
    asset: AssetTimelineItem,
    info: { position: ThumbnailPosition | null },
  ) => {
    // Store the thumbnail position for the selected asset
    setSelectedThumbnailPosition(info.position)
    setSelectedAsset(asset)
  }

  // Close photo viewer
  const handleCloseViewer = () => {
    setSelectedAsset(null)
    // Reset the selected thumbnail position
    setSelectedThumbnailPosition(null)
  }

  // Handle logout
  const handleLogout = () => {
    logout()
  }

  // Get the assets to display (search results or timeline)
  const displayAssets = isSearchMode && searchResults?.assets ? searchResults.assets : assets
  const displayError = isSearchMode ? searchError : error

  // Render search results content
  const renderSearchContent = () => {
    if (isSearching) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-lg)',
            color: 'var(--color-gray)',
          }}
        >
          <div
            class="loading-spinner"
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid var(--color-gray-light)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: 'var(--spacing-md)',
            }}
          />
          <p>Searching...</p>
        </div>
      )
    }

    if (searchResults?.assets && searchResults.assets.length === 0) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-xl)',
            color: 'var(--color-gray)',
            flexDirection: 'column',
            textAlign: 'center',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M21 21L16.65 16.65"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <p style={{ marginTop: 'var(--spacing-md)' }}>No photos found for "{searchQuery}"</p>
        </div>
      )
    }

    return null
  }

  return (
    <div class="ios-page has-search-input">
      <Header
        title={isSearchMode ? 'Search' : 'Timeline'}
        rightAction={{
          icon: (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M16 17l5-5-5-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M21 12H9"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          ),
          onClick: handleLogout,
        }}
      />

      {/* Search Input */}
      <SearchInputWrapper>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search photos..." />
      </SearchInputWrapper>

      <div class="ios-content">
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* Search mode content */}
        {isSearchMode && renderSearchContent()}

        {/* Search results timeline */}
        {isSearchMode && !isSearching && displayAssets.length > 0 && (
          <VirtualizedTimeline
            assets={displayAssets}
            showDateHeaders={false}
            onAssetOpenRequest={handleAssetClick}
            onThumbnailPositionGetterReady={setGetThumbnailPosition}
            anchorAssetId={selectedAsset?.id}
          />
        )}

        {/* Regular timeline content (non-search mode) */}
        {!isSearchMode && isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              color: 'var(--color-gray)',
            }}
          >
            <div
              class="loading-spinner"
              style={{
                width: '40px',
                height: '40px',
                border: '4px solid var(--color-gray-light)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ marginTop: 'var(--spacing-md)' }}>Loading photos...</p>
          </div>
        )}

        {!isSearchMode && displayError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              color: 'var(--color-danger)',
              padding: 'var(--spacing-lg)',
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M12 8V12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M12 16H12.01"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <p style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>{displayError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 'var(--spacing-lg)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!isSearchMode && !isLoading && !displayError && (
          <>
            <VirtualizedTimeline
              assets={assets}
              hasMoreContent={hasMoreContent}
              isLoadingMore={isLoadingMore}
              onAssetOpenRequest={handleAssetClick}
              onLoadMoreRequest={handleLoadMore}
              onThumbnailPositionGetterReady={setGetThumbnailPosition}
              anchorAssetId={selectedAsset?.id}
              onVisibleDateChange={handleVisibleDateChange}
              scrollContainerRef={scrollContainerRef}
            />
            <TimelineScrubber
              buckets={allBuckets}
              visibleDate={visibleDate}
              onScrub={handleScrub}
              onScrubEnd={handleScrubEnd}
            />
          </>
        )}
      </div>

      {selectedAsset && (
        <PhotoViewer
          asset={selectedAsset}
          assets={displayAssets}
          onClose={handleCloseViewer}
          thumbnailPosition={selectedThumbnailPosition}
          getThumbnailPosition={getThumbnailPosition ?? undefined}
          onAssetChange={setSelectedAsset}
        />
      )}
    </div>
  )
}
