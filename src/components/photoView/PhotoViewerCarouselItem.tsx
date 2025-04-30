import type { Asset } from '../../services/api'
import { apiService } from '../../services/api'
import { AssetImage } from './AssetImage'

interface PhotoViewerCarouselItemProps {
  asset: Asset
  isMain?: boolean
  isTransitioning?: boolean
  loadingStatus: {
    thumbnailLoaded: boolean
    fullImageLoaded: boolean
  }
  onImageLoad?: () => void
  style?: Record<string, string | number>
  imageTransform?: string
  isZooming?: boolean
}

export const PhotoViewerCarouselItem = ({
  asset,
  isMain = false,
  isTransitioning = false,
  loadingStatus,
  onImageLoad,
  style = {},
  imageTransform = '',
  isZooming = false,
}: PhotoViewerCarouselItemProps) => {
  const assetThumbnailUrl = apiService.getAssetThumbnailUrl(asset.id, 'webp')
  const assetFullUrl = apiService.getAssetUrl(asset.id)

  return (
    <div
      data-main={isMain ? 'true' : undefined}
      data-transitioning={isTransitioning ? 'true' : undefined}
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {asset.type === 'VIDEO' ? (
        <video
          src={assetFullUrl}
          controls={true}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transform: isZooming && isMain ? imageTransform : '',
            transformOrigin: 'center',
            willChange: isZooming ? 'transform' : 'auto',
          }}
        >
          {/* Thumbnail version (shown while full image loads) */}
          <AssetImage
            src={assetThumbnailUrl}
            alt={asset.originalFileName}
            isBlurred={true}
            isLoaded={!loadingStatus?.fullImageLoaded}
          />

          {/* Full resolution version */}
          <AssetImage
            src={assetFullUrl}
            alt={asset.originalFileName}
            isLoaded={loadingStatus?.fullImageLoaded}
            style={{
              willChange: isZooming ? 'transform' : 'auto',
            }}
            onLoad={onImageLoad ?? null}
          />

          {/* Loading indicator (shown while neither image is loaded) */}
          {!(loadingStatus?.thumbnailLoaded || loadingStatus?.fullImageLoaded) && (
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-md)',
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
