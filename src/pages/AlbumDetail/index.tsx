import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../../components/common/Header';
import VirtualizedTimeline from '../../components/timeline/VirtualizedTimeline';
import PhotoViewer from '../../components/photoView/PhotoViewer';
import apiService, { Asset, Album } from '../../services/api';
import { ThumbnailPosition } from '../../hooks/useZoomTransition';

interface AlbumDetailProps {
  id?: string;
  albumId?: string;
}

export function AlbumDetail({ id, albumId }: AlbumDetailProps) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedThumbnailPosition, setSelectedThumbnailPosition] = useState<ThumbnailPosition | null>(null);
  const [allBuckets, setAllBuckets] = useState<string[]>([]);
  const [loadedBucketCount, setLoadedBucketCount] = useState<number>(0);
  const [hasMoreContent, setHasMoreContent] = useState<boolean>(true);
  const location = useLocation();

  // Number of buckets to load at once
  const BUCKETS_PER_LOAD = 1;

  // Extract ID from URL if not provided as prop
  const { url } = location;
  const urlId = url.startsWith('/albums/') ? url.split('/')[2] : null;

  // Use albumId prop, id prop, or extract from URL
  const effectiveId = albumId || id || urlId;

  // Fetch album data
  useEffect(() => {
    const fetchAlbum = async () => {
      if (!effectiveId) {
        setError('Album ID is missing');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get album details
        const albumData = await apiService.getAlbum(effectiveId);
        setAlbum(albumData);

        // Get time buckets for this album
        const timeBucketsResponse = await apiService.getTimeBuckets({
          size: 'DAY',
          isTrashed: false,
          albumId: effectiveId
        });

        console.log('Album time buckets response:', timeBucketsResponse);

        // Extract buckets from the response
        const buckets = timeBucketsResponse.map(bucket => bucket.timeBucket) || [];
        setAllBuckets(buckets);

        // If no buckets, set hasMoreContent to false
        if (buckets.length === 0) {
          setHasMoreContent(false);
          setIsLoading(false);
          return;
        }

        // Load the first batch of buckets
        await loadMoreBuckets(buckets, 0, effectiveId);
      } catch (err) {
        console.error('Error fetching album:', err);
        setError('Failed to load album. Please try again.');
        setIsLoading(false);
      }
    };

    fetchAlbum();
  }, [effectiveId]);

  // Function to load more buckets
  const loadMoreBuckets = async (buckets: string[], startIndex: number, albumId: string) => {
    if (startIndex >= buckets.length) {
      setHasMoreContent(false);
      setIsLoadingMore(false);
      return;
    }

    try {
      if (startIndex > 0) {
        setIsLoadingMore(true);
      }

      // Get the next batch of buckets
      const endIndex = Math.min(startIndex + BUCKETS_PER_LOAD, buckets.length);
      const bucketsToLoad = buckets.slice(startIndex, endIndex);

      console.log(`Loading album buckets ${startIndex} to ${endIndex - 1}...`);

      const newAssets: Asset[] = [];

      // Load assets for each bucket
      for (const bucket of bucketsToLoad) {
        try {
          const bucketAssets = await apiService.getTimeBucket({
            timeBucket: bucket,
            size: 'DAY',
            isTrashed: false,
            albumId
          });

          console.log(`Album bucket ${bucket} assets:`, bucketAssets);

          if (Array.isArray(bucketAssets)) {
            newAssets.push(...bucketAssets);
          } else {
            console.warn(`Unexpected response format for bucket ${bucket}:`, bucketAssets);
          }
        } catch (bucketError) {
          console.error(`Error fetching assets for bucket ${bucket}:`, bucketError);
        }
      }

      // Update state with new assets
      setAssets(prevAssets => [...prevAssets, ...newAssets]);
      setLoadedBucketCount(endIndex);

      // Check if we've loaded all buckets
      if (endIndex >= buckets.length) {
        setHasMoreContent(false);
      }
    } catch (err) {
      console.error('Error loading more buckets:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Handle loading more content
  const handleLoadMore = () => {
    if (isLoadingMore || !hasMoreContent || !effectiveId) return;

    console.log('Loading more album content...');
    loadMoreBuckets(allBuckets, loadedBucketCount, effectiveId);
  };

  // Handle asset selection
  const handleAssetClick = (asset: Asset, info: { position: ThumbnailPosition | null }) => {
    // Store the thumbnail position for the selected asset
    setSelectedThumbnailPosition(info.position);
    setSelectedAsset(asset);
  };

  // Close photo viewer
  const handleCloseViewer = () => {
    setSelectedAsset(null);
    // Reset the selected thumbnail position
    setSelectedThumbnailPosition(null);
  };

  // Handle back button
  const handleBack = () => {
    location.route('/albums');
  };

  return (
    <div class="ios-page">
      <Header
        title={album ? album.albumName : 'Album'}
        leftAction={{
          icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          ),
          onClick: handleBack
        }}
      />

      <div class="ios-content">
        {isLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-gray)'
          }}>
            <div class="loading-spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--color-gray-light)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ marginTop: 'var(--spacing-md)' }}>Loading album...</p>

            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : error ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-danger)',
            padding: 'var(--spacing-lg)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : assets.length > 0 ? (
          <VirtualizedTimeline
            assets={assets}
            showDateHeaders={false}
            hasMoreContent={hasMoreContent}
            isLoadingMore={isLoadingMore}
            onAssetOpenRequest={handleAssetClick}
            onLoadMoreRequest={handleLoadMore}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-gray)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M21 15L16 10L5 21"
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
        />
      )}
    </div>
  );
}

export default AlbumDetail;
