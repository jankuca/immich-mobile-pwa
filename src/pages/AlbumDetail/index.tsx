import { useEffect, useRef, useState } from 'preact/hooks'
import { AlbumHeader } from '../../components/common/AlbumHeader'
import { Header } from '../../components/common/Header'
import { PhotoViewer } from '../../components/photoView/PhotoViewer'
import { ShareModal } from '../../components/share/ShareModal'
import {
  type TimelineBucket,
  type TimelineController,
  VirtualizedTimeline,
} from '../../components/timeline/VirtualizedTimeline'
import { useHashLocation } from '../../contexts/HashLocationContext'
import { useAssetSelection } from '../../hooks/useAssetSelection'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import { type Album, type Asset, apiService } from '../../services/api'

interface AlbumDetailProps {
  id?: string
  albumId?: string
}

export function AlbumDetail({ id, albumId }: AlbumDetailProps) {
  const [album, setAlbum] = useState<Album | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedThumbnailPosition, setSelectedThumbnailPosition] =
    useState<ThumbnailPosition | null>(null)
  const [allBuckets, setAllBuckets] = useState<TimelineBucket[]>([])
  const [showShareModal, setShowShareModal] = useState<boolean>(false)
  const { url, route } = useHashLocation()

  // Selection state
  const {
    isSelectionMode,
    selectedAssetIds,
    selectionCount,
    toggleSelectionMode,
    exitSelectionMode,
    toggleAssetSelection,
    shareSelectedAssets,
  } = useAssetSelection()

  // Track loaded bucket count synchronously to prevent race conditions
  const loadedBucketCountRef = useRef<number>(0)

  // Controller ref for VirtualizedTimeline imperative actions
  const timelineControllerRef = useRef<TimelineController | null>(null)

  // Number of buckets to load at once
  const bucketsPerLoad = 1

  // Extract ID from URL if not provided as prop
  const urlId = url.startsWith('/albums/') ? url.split('/')[2] : null

  // Use albumId prop, id prop, or extract from URL
  const effectiveId = albumId || id || urlId

  // Fetch album data
  useEffect(() => {
    // Reset ref when album changes
    loadedBucketCountRef.current = 0

    const fetchAlbum = async () => {
      if (!effectiveId) {
        setError('Album ID is missing')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        setAssets([]) // Clear existing assets when switching albums

        // Get album details
        const albumData = await apiService.getAlbum(effectiveId)
        setAlbum(albumData)

        // Get time buckets for this album
        const timeBucketsResponse = await apiService.getTimeBuckets({
          size: 'DAY',
          isTrashed: false,
          albumId: effectiveId,
          ...(albumData.order && { order: albumData.order }),
        })

        // Store full bucket info
        const buckets: TimelineBucket[] = timeBucketsResponse.map((bucket) => ({
          timeBucket: bucket.timeBucket,
          count: bucket.count,
        }))
        setAllBuckets(buckets)

        // If no buckets, we're done loading
        if (buckets.length === 0) {
          setIsLoading(false)
          return
        }

        // Load the first batch of buckets
        await loadMoreBuckets(buckets, 0, effectiveId, albumData.order)
      } catch (err) {
        console.error('Error fetching album:', err)
        setError('Failed to load album. Please try again.')
        setIsLoading(false)
      }
    }

    fetchAlbum()
  }, [effectiveId])

  // Function to load more buckets
  const loadMoreBuckets = async (
    buckets: TimelineBucket[],
    startIndex: number,
    albumId: string,
    order?: 'asc' | 'desc',
  ) => {
    // Use ref for synchronous check to prevent race conditions
    if (startIndex >= buckets.length || startIndex < loadedBucketCountRef.current) {
      // Already loaded or past the end
      return
    }

    // Mark as loading synchronously
    const endIndex = Math.min(startIndex + bucketsPerLoad, buckets.length)
    loadedBucketCountRef.current = endIndex

    try {
      // Get the next batch of buckets
      const bucketsToLoad = buckets.slice(startIndex, endIndex)

      const newAssets: Asset[] = []

      // Load assets for each bucket
      for (let i = 0; i < bucketsToLoad.length; i++) {
        const bucket = bucketsToLoad[i]
        if (!bucket) {
          continue
        }
        const bucketIndex = startIndex + i
        try {
          const bucketAssets = await apiService.getTimeBucket({
            timeBucket: bucket.timeBucket,
            size: 'DAY',
            isTrashed: false,
            albumId,
            ...(order && { order }),
          })

          if (Array.isArray(bucketAssets)) {
            // Tag each asset with its bucket index for layout purposes
            for (const asset of bucketAssets) {
              ;(asset as Asset)._bucketIndex = bucketIndex
            }
            newAssets.push(...(bucketAssets as Asset[]))
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

      // Update state with new assets
      setAssets((prevAssets) => [...prevAssets, ...newAssets])
    } catch (err) {
      console.error('Error loading more buckets:', err)
      // Reset ref on error to allow retry
      loadedBucketCountRef.current = startIndex
    } finally {
      setIsLoading(false)
    }
  }

  // Handle asset selection
  const handleAssetClick = (asset: Asset, info: { position: ThumbnailPosition | null }) => {
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

  // Handle back button
  const handleBack = () => {
    route('/albums')
  }

  // Icons for selection mode header
  const closeIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18 6L6 18"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M6 6L18 18"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )

  const downloadIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M7 10L12 15L17 10"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M12 15V3"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )

  const backIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19 12H5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M12 19L5 12L12 5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )

  return (
    <div class="ios-page">
      {isSelectionMode ? (
        <Header
          title={selectionCount === 0 ? 'Select' : `${selectionCount} selected`}
          leftAction={{
            icon: closeIcon,
            onClick: exitSelectionMode,
          }}
          rightAction={
            selectionCount > 0
              ? {
                  icon: downloadIcon,
                  onClick: shareSelectedAssets,
                }
              : undefined
          }
        />
      ) : (
        <AlbumHeader
          album={album}
          leftAction={{
            icon: backIcon,
            onClick: handleBack,
          }}
          menuItems={[
            { label: 'Select', onClick: toggleSelectionMode },
            { label: 'Share', onClick: () => setShowShareModal(true) },
          ]}
        />
      )}

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
            <p style={{ marginTop: 'var(--spacing-md)' }}>Loading album...</p>

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
        ) : assets.length > 0 ? (
          <VirtualizedTimeline
            assets={assets}
            buckets={allBuckets}
            showDateHeaders={allBuckets.length > 1}
            {...(album?.order && { order: album.order })}
            onAssetClick={handleAssetClick}
            anchorAssetId={selectedAsset?.id}
            controllerRef={timelineControllerRef}
            isSelectionMode={isSelectionMode}
            selectedAssetIds={selectedAssetIds}
            onSelectionToggle={toggleAssetSelection}
          />
        ) : (
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
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M21 15L16 10L5 21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <p style={{ marginTop: 'var(--spacing-md)' }}>No photos in this album</p>
          </div>
        )}
      </div>

      {selectedAsset && (
        <PhotoViewer
          asset={selectedAsset}
          assets={assets}
          onClose={handleCloseViewer}
          thumbnailPosition={selectedThumbnailPosition}
          getThumbnailPosition={(assetId) =>
            timelineControllerRef.current?.getThumbnailPosition(assetId) ?? null
          }
          onAssetChange={(asset) => setSelectedAsset(asset as Asset)}
        />
      )}

      {showShareModal && album && (
        <ShareModal album={album} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  )
}
