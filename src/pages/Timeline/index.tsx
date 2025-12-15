import { useCallback, useEffect, useState } from 'preact/hooks'
import { Header } from '../../components/common/Header'
import { PhotoViewer } from '../../components/photoView/PhotoViewer'
import { VirtualizedTimeline } from '../../components/timeline/VirtualizedTimeline'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import { type AssetTimelineItem, apiService } from '../../services/api'
import { useAuth } from '../../services/auth'

export function Timeline() {
  const [assets, setAssets] = useState<AssetTimelineItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetTimelineItem | null>(null)
  const [selectedThumbnailPosition, setSelectedThumbnailPosition] =
    useState<ThumbnailPosition | null>(null)
  const [allBuckets, setAllBuckets] = useState<string[]>([])
  const [loadedBucketCount, setLoadedBucketCount] = useState<number>(0)
  const [hasMoreContent, setHasMoreContent] = useState<boolean>(true)
  const { logout } = useAuth()

  // Number of buckets to load at once
  const bucketsPerLoad = 1

  // Fetch initial timeline data
  useEffect(() => {
    const fetchInitialTimeline = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Get time buckets (days)
        const timeBucketsResponse = await apiService.getTimeBuckets({
          size: 'DAY',
          isTrashed: false,
        })

        // Extract buckets from the response
        const buckets = timeBucketsResponse.map((bucket) => bucket.timeBucket) || []
        setAllBuckets(buckets)

        // If no buckets, set hasMoreContent to false
        if (buckets.length === 0) {
          setHasMoreContent(false)
          setIsLoading(false)
          return
        }

        // Load the first batch of buckets
        await loadMoreBuckets(buckets, 0)
      } catch (err) {
        console.error('Error fetching timeline:', err)
        setError('Failed to load photos. Please try again.')
        setIsLoading(false)
      }
    }

    fetchInitialTimeline()
  }, [])

  // Function to load more buckets
  const loadMoreBuckets = useCallback(async (buckets: string[], startIndex: number) => {
    if (startIndex >= buckets.length) {
      setHasMoreContent(false)
      setIsLoadingMore(false)
      return
    }

    try {
      if (startIndex > 0) {
        setIsLoadingMore(true)
      }

      // Get the next batch of buckets
      const endIndex = Math.min(startIndex + bucketsPerLoad, buckets.length)
      const bucketsToLoad = buckets.slice(startIndex, endIndex)

      const newAssets: AssetTimelineItem[] = []

      // Load assets for each bucket
      for (const bucket of bucketsToLoad) {
        try {
          const bucketAssets = await apiService.getTimeBucket({
            timeBucket: bucket,
            size: 'DAY',
            isTrashed: false,
          })

          if (Array.isArray(bucketAssets)) {
            newAssets.push(...bucketAssets)
          } else {
            console.warn(`Unexpected response format for bucket ${bucket}:`, bucketAssets)
          }
        } catch (bucketError) {
          console.error(`Error fetching assets for bucket ${bucket}:`, bucketError)
        }
      }

      // Update state with new assets
      setAssets((prevAssets) => [...prevAssets, ...newAssets])
      setLoadedBucketCount(endIndex)

      // Check if we've loaded all buckets
      if (endIndex >= buckets.length) {
        setHasMoreContent(false)
      }
    } catch (err) {
      console.error('Error loading more buckets:', err)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  // Handle loading more content
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMoreContent) {
      return
    }
    loadMoreBuckets(allBuckets, loadedBucketCount)
  }, [allBuckets, loadedBucketCount, isLoadingMore, hasMoreContent, loadMoreBuckets])

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

  return (
    <div class="ios-page">
      <Header
        title="Timeline"
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

      <div class="ios-content">
        {isLoading ? (
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

            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : error ? (
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
            <p style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>{error}</p>
            <button
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
        ) : (
          <VirtualizedTimeline
            assets={assets}
            hasMoreContent={hasMoreContent}
            isLoadingMore={isLoadingMore}
            onAssetOpenRequest={handleAssetClick}
            onLoadMoreRequest={handleLoadMore}
          />
        )}
      </div>

      {selectedAsset && (
        <PhotoViewer
          asset={selectedAsset}
          assets={assets}
          onClose={handleCloseViewer}
          thumbnailPosition={selectedThumbnailPosition}
        />
      )}
    </div>
  )
}
