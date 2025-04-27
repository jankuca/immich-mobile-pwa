import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import Header from '../../components/common/Header';
import VirtualizedTimeline from '../../components/timeline/VirtualizedTimeline';
import PhotoViewer from '../../components/photoView/PhotoViewer';
import apiService, { Asset } from '../../services/api';
import useAuth from '../../services/auth';
import { ThumbnailPosition } from '../../hooks/useZoomTransition';

export function Timeline() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedThumbnailPosition, setSelectedThumbnailPosition] = useState<ThumbnailPosition | null>(null);
  const { logout, user } = useAuth();

  // Fetch timeline data
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get time buckets (days)
        const timeBucketsResponse = await apiService.getTimeBuckets({
          size: 'DAY',
          isTrashed: false,
        });

        console.log('Time buckets response:', timeBucketsResponse);

        // Extract buckets from the response (new format)
        const buckets = timeBucketsResponse.map(bucket => bucket.timeBucket) || [];

        // Fetch assets for each bucket (in a real app, you'd implement pagination)
        const allAssets: Asset[] = [];

        // Limit to first 10 buckets for demo purposes
        const limitedBuckets = buckets.slice(0, 100);

        for (const bucket of limitedBuckets) {
          try {
            const bucketAssets = await apiService.getTimeBucket({
              timeBucket: bucket,
              size: 'DAY',
              isTrashed: false,
            });

            console.log(`Bucket ${bucket} assets:`, bucketAssets);

            if (Array.isArray(bucketAssets)) {
              allAssets.push(...bucketAssets);
            } else {
              console.warn(`Unexpected response format for bucket ${bucket}:`, bucketAssets);
            }
          } catch (bucketError) {
            console.error(`Error fetching assets for bucket ${bucket}:`, bucketError);
          }
        }

        console.log('All assets:', allAssets);
        setAssets(allAssets);
      } catch (err) {
        console.error('Error fetching timeline:', err);
        setError('Failed to load photos. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeline();
  }, []);

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

  // Handle logout
  const handleLogout = () => {
    logout();
  };

  return (
    <div class="ios-page">
      <Header
        title='Timeline'
        rightAction={{
          icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 17l5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          ),
          onClick: handleLogout
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
            <p style={{ marginTop: 'var(--spacing-md)' }}>Loading photos...</p>

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
        ) : (
          <VirtualizedTimeline
            assets={assets}
            onAssetClick={handleAssetClick}
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
  );
}

export default Timeline;
