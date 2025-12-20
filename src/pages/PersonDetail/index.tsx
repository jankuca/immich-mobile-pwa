import { useEffect, useRef, useState } from 'preact/hooks'
import { Header } from '../../components/common/Header'
import { PersonHeader } from '../../components/common/PersonHeader'
import { PhotoViewer } from '../../components/photoView/PhotoViewer'
import { AssetShareModal } from '../../components/share/AssetShareModal'
import {
  type TimelineBucket,
  type TimelineController,
  VirtualizedTimeline,
} from '../../components/timeline/VirtualizedTimeline'
import { useHashLocation } from '../../contexts/HashLocationContext'
import { useAssetSelection } from '../../hooks/useAssetSelection'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import { type Asset, type Person, apiService } from '../../services/api'

interface PersonDetailProps {
  id?: string
  personId?: string
}

export function PersonDetail({ id, personId }: PersonDetailProps) {
  const [person, setPerson] = useState<Person | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedThumbnailPosition, setSelectedThumbnailPosition] =
    useState<ThumbnailPosition | null>(null)
  const [allBuckets, setAllBuckets] = useState<TimelineBucket[]>([])
  const [totalAssetCount, setTotalAssetCount] = useState<number>(0)
  const [showAssetShareModal, setShowAssetShareModal] = useState<boolean>(false)
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

  // Controller ref for VirtualizedTimeline imperative actions
  const timelineControllerRef = useRef<TimelineController | null>(null)

  // Number of buckets to load at once
  const bucketsPerLoad = 1

  // Extract ID from URL if not provided as prop
  const urlId = url.startsWith('/people/') ? url.split('/')[2] : null

  // Use personId prop, id prop, or extract from URL
  const effectiveId = personId || id || urlId

  // Fetch person data
  useEffect(() => {
    const fetchPerson = async () => {
      if (!effectiveId) {
        setError('Person ID is missing')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Get person details
        const personData = await apiService.getPerson(effectiveId)
        setPerson(personData)

        // Get time buckets for this person
        const timeBucketsResponse = await apiService.getTimeBuckets({
          size: 'DAY',
          isTrashed: false,
          personId: effectiveId,
        })

        // Store full bucket info and calculate total count
        const buckets: TimelineBucket[] = timeBucketsResponse.map((bucket) => ({
          timeBucket: bucket.timeBucket,
          count: bucket.count,
        }))
        const totalCount = timeBucketsResponse.reduce((sum, bucket) => sum + bucket.count, 0)
        setAllBuckets(buckets)
        setTotalAssetCount(totalCount)

        // If no buckets, we're done loading
        if (buckets.length === 0) {
          setIsLoading(false)
          return
        }

        // Load the first batch of buckets
        await loadMoreBuckets(buckets, 0, effectiveId)
      } catch (err) {
        console.error('Error fetching person:', err)
        setError('Failed to load person. Please try again.')
        setIsLoading(false)
      }
    }

    fetchPerson()
  }, [effectiveId])

  // Function to load more buckets
  const loadMoreBuckets = async (
    buckets: TimelineBucket[],
    startIndex: number,
    personId: string,
  ) => {
    if (startIndex >= buckets.length) {
      return
    }

    try {
      // Get the next batch of buckets
      const endIndex = Math.min(startIndex + bucketsPerLoad, buckets.length)
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
            personId,
          })

          if (Array.isArray(bucketAssets)) {
            // Tag each asset with its bucket index for layout purposes
            for (const asset of bucketAssets) {
              ;(asset as Asset)._bucketIndex = bucketIndex
            }
            newAssets.push(...bucketAssets)
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
    } finally {
      setIsLoading(false)
    }
  }

  // Handle asset selection
  const handleAssetClick = (asset: Asset, info: { position: ThumbnailPosition | null }) => {
    setSelectedThumbnailPosition(info.position)
    setSelectedAsset(asset)
  }

  // Close photo viewer
  const handleCloseViewer = () => {
    setSelectedAsset(null)
    setSelectedThumbnailPosition(null)
  }

  // Handle back button
  const handleBack = () => {
    route('/people')
  }

  // Icons
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

  const linkIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
          rightActions={
            selectionCount > 0
              ? [
                  {
                    icon: linkIcon,
                    onClick: () => setShowAssetShareModal(true),
                  },
                  {
                    icon: downloadIcon,
                    onClick: shareSelectedAssets,
                  },
                ]
              : undefined
          }
        />
      ) : (
        <PersonHeader
          person={person}
          assetCount={totalAssetCount}
          leftAction={{ icon: backIcon, onClick: handleBack }}
          menuItems={[{ label: 'Select', onClick: toggleSelectionMode }]}
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
        ) : assets.length > 0 ? (
          <VirtualizedTimeline
            assets={assets}
            buckets={allBuckets}
            showDateHeaders={false}
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
                d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <p style={{ marginTop: 'var(--spacing-md)' }}>No photos of this person</p>
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

      {showAssetShareModal && selectionCount > 0 && (
        <AssetShareModal
          assetIds={Array.from(selectedAssetIds)}
          onClose={() => setShowAssetShareModal(false)}
        />
      )}
    </div>
  )
}
