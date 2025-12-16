import { useEffect, useState } from 'preact/hooks'
import { type Asset, type AssetTimelineItem, apiService } from '../../services/api'

interface PhotoDetailsProps {
  assetTimelineItem: AssetTimelineItem
}

export const PhotoDetails = ({ assetTimelineItem }: PhotoDetailsProps) => {
  const [asset, setFullAssetInfo] = useState<Asset | null>(null)

  useEffect(() => {
    const abortController = new AbortController()

    apiService
      .getAsset(assetTimelineItem.id, { signal: abortController.signal })
      .then((asset) => {
        setFullAssetInfo(asset)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error fetching full asset info:', error)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [assetTimelineItem.id])

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!asset) {
    return null
  }

  return (
    <div
      class="photo-details"
      style={{
        backgroundColor: 'var(--color-background)',
        padding: 'var(--spacing-lg)',
        overflowX: 'hidden',
      }}
    >
      {/* File name */}
      <h2
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        {asset.originalFileName}
      </h2>

      {/* Date taken */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-gray)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          Date
        </h3>
        <p>{formatDate(asset.localDateTime)}</p>
      </div>

      {/* Location if available */}
      {asset.exifInfo?.city && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-gray)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Location
          </h3>
          <p>
            {[asset.exifInfo.city, asset.exifInfo.state, asset.exifInfo.country]
              .filter(Boolean)
              .join(', ')}
          </p>

          {/* Map link if coordinates are available */}
          {asset.exifInfo.latitude && asset.exifInfo.longitude && (
            <a
              href={`https://maps.google.com/?q=${asset.exifInfo.latitude},${asset.exifInfo.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: 'var(--spacing-xs)',
                color: 'var(--color-primary)',
                textDecoration: 'none',
              }}
            >
              View on map
            </a>
          )}
        </div>
      )}

      {/* Camera info if available */}
      {(asset.exifInfo?.make || asset.exifInfo?.model) && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-gray)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Camera
          </h3>
          <p>
            {[asset.exifInfo.make, asset.exifInfo.model].filter(Boolean).join(' ')}
            {asset.exifInfo.lensModel && ` with ${asset.exifInfo.lensModel}`}
          </p>
        </div>
      )}

      {/* Technical details if available */}
      {(asset.exifInfo?.fNumber || asset.exifInfo?.exposureTime || asset.exifInfo?.iso) && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-gray)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Details
          </h3>
          <p>
            {asset.exifInfo.fNumber && `f/${asset.exifInfo.fNumber}`}
            {asset.exifInfo.exposureTime && ` ${asset.exifInfo.exposureTime}s`}
            {asset.exifInfo.iso && ` ISO ${asset.exifInfo.iso}`}
            {asset.exifInfo.focalLength && ` ${asset.exifInfo.focalLength}mm`}
          </p>
          <p style={{ marginTop: 'var(--spacing-xs)' }}>
            {asset.exifInfo.exifImageWidth &&
              asset.exifInfo.exifImageHeight &&
              `${asset.exifInfo.exifImageWidth} × ${asset.exifInfo.exifImageHeight}`}
          </p>
        </div>
      )}

      {/* Description if available */}
      {asset.exifInfo?.description && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <h3
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-gray)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Description
          </h3>
          <p>{asset.exifInfo.description}</p>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-md)',
          marginTop: 'var(--spacing-lg)',
        }}
      >
        <button
          style={{
            flex: 1,
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-xs)',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M7 10l5 5 5-5"
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
          <span>Download</span>
        </button>

        <button
          style={{
            flex: 1,
            padding: 'var(--spacing-md)',
            backgroundColor: asset.isFavorite ? 'var(--color-danger)' : 'var(--color-light)',
            color: asset.isFavorite ? 'white' : 'var(--color-text)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'var(--font-weight-medium)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-xs)',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={asset.isFavorite ? 'currentColor' : 'none'}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>{asset.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
        </button>
      </div>
    </div>
  )
}
