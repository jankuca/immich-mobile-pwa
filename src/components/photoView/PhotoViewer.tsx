import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Asset } from '../../services/api';
import apiService from '../../services/api';
import PhotoDetails from './PhotoDetails';

interface PhotoViewerProps {
  asset: Asset;
  assets: Asset[];
  onClose: () => void;
}

const PhotoViewer = ({ asset, assets, onClose }: PhotoViewerProps) => {
  const [currentAsset, setCurrentAsset] = useState<Asset>(asset);
  const [detailsProgress, setDetailsProgress] = useState<number>(0); // 0 = hidden, 1 = fully shown
  const [startY, setStartY] = useState<number | null>(null);
  const [offsetY, setOffsetY] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxSwipeDistance = 200; // Maximum swipe distance for full transition

  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex(a => a.id === currentAsset.id);

  // Handle swipe gestures
  const handleTouchStart = (e: TouchEvent) => {
    // Always track the start position to enable closing details with a swipe down
    setStartY(e.touches[0].clientY);

    // Store whether we're at the top of the details content
    if (detailsProgress === 1) {
      const detailsElement = document.querySelector('.photo-details');
      if (detailsElement) {
        // Store this information as a data attribute for use in handleTouchMove
        detailsElement.setAttribute('data-at-top', detailsElement.scrollTop <= 0 ? 'true' : 'false');
      }
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (startY === null) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    // If details are fully shown
    if (detailsProgress === 1) {
      const detailsElement = document.querySelector('.photo-details');

      // Only handle swipe down when at the top of the details content
      if (detailsElement && diff > 10) { // Swipe down
        const atTop = detailsElement.getAttribute('data-at-top') === 'true';

        if (atTop) {
          // Prevent default scrolling behavior
          e.preventDefault();

          // Update the details progress based on the swipe distance
          const progress = Math.max(1 - (diff / maxSwipeDistance), 0);
          setDetailsProgress(progress);
          setOffsetY(diff);
        }
      }

      // For all other cases, let the browser handle the scroll
      return;
    }

    // For normal photo view or during transition
    // Determine if it's a vertical swipe
    if (Math.abs(diff) > 10) {
      e.preventDefault();
      setOffsetY(diff);

      // Calculate details progress based on swipe distance
      if (diff < 0) { // Swipe up
        // Convert negative swipe (up) to positive progress (0 to 1)
        const progress = Math.min(Math.abs(diff) / maxSwipeDistance, 1);
        setDetailsProgress(progress);
      } else if (diff > 0 && detailsProgress > 0) { // Swipe down when details are showing
        // Convert positive swipe (down) to decreasing progress
        const progress = Math.max(1 - (diff / maxSwipeDistance), 0);
        setDetailsProgress(progress);
      }
    }
  };

  const handleTouchEnd = () => {
    // If we didn't start a swipe (startY is null), do nothing
    if (startY === null) return;

    // Handle swipe completion
    if (offsetY < -50 && detailsProgress < 1) {
      // Swipe up - show details fully
      setDetailsProgress(1);
    } else if (offsetY > 50 && detailsProgress > 0) {
      // Swipe down - hide details
      setDetailsProgress(0);
    } else if (offsetY > 50 && detailsProgress === 0) {
      // Swipe down when details are hidden - close viewer
      onClose();
    } else if (detailsProgress !== 0 && detailsProgress !== 1) {
      // If the swipe wasn't far enough, snap to the nearest state
      setDetailsProgress(detailsProgress > 0.5 ? 1 : 0);
    }

    // Reset swipe state
    setStartY(null);
    setOffsetY(0);

    // Reset the data-at-top attribute
    const detailsElement = document.querySelector('.photo-details');
    if (detailsElement) {
      detailsElement.removeAttribute('data-at-top');
    }
  };

  // Navigate to previous asset
  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentAsset(assets[currentIndex - 1]);
    }
  };

  // Navigate to next asset
  const goToNext = () => {
    if (currentIndex < assets.length - 1) {
      setCurrentAsset(assets[currentIndex + 1]);
    }
  };

  // Close details view
  const closeDetails = () => {
    setDetailsProgress(0);
  };

  // Get the URL for the current asset
  const assetUrl = apiService.getAssetUrl(currentAsset.id);

  return (
    <div
      ref={containerRef}
      class="photo-viewer"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--color-background)',
        zIndex: 'var(--z-index-modal)',
        overflow: 'hidden' // Prevent content from being visible outside the container
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main content container - moves with swipe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: `translateY(${offsetY}px)`,
          transition: offsetY === 0 ? 'transform 0.3s ease' : 'none'
        }}
      >
        {/* Main image view */}
        <div
          class="photo-viewer-content"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${100 - (detailsProgress * 40)}%`, // Shrink to 60% height when details are fully shown
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: offsetY === 0 ? 'height 0.3s ease' : 'none',
            zIndex: 1
          }}
        >
          {currentAsset.type === 'VIDEO' ? (
            <video
              src={assetUrl}
              controls
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          ) : (
            <img
              src={assetUrl}
              alt={currentAsset.originalFileName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div
          class="photo-viewer-nav-left"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '30%',
            height: '100%',
            display: currentIndex > 0 ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: 'var(--spacing-md)'
          }}
          onClick={goToPrevious}
        >
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div
          class="photo-viewer-nav-right"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '30%',
            height: '100%',
            display: currentIndex < assets.length - 1 ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: 'var(--spacing-md)'
          }}
          onClick={goToNext}
        >
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Close button */}
        <div
          class="photo-viewer-close"
          style={{
            position: 'absolute',
            top: 'var(--spacing-md)',
            left: 'var(--spacing-md)',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            zIndex: 1
          }}
          onClick={onClose}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        {/* Details view - always render but control visibility with transform and opacity */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            transform: `translateY(${100 - detailsProgress * 100}%)`,
            opacity: detailsProgress,
            transition: offsetY === 0 ? 'transform 0.3s ease, opacity 0.3s ease' : 'none',
            zIndex: 2
          }}
        >
          <PhotoDetails
            asset={currentAsset}
            onClose={closeDetails}
          />
        </div>

        {/* Swipe up indicator */}
        <div
          class="swipe-up-indicator"
          style={{
            position: 'absolute',
            bottom: 'var(--spacing-lg)',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xs) var(--spacing-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-sm)',
            opacity: detailsProgress > 0 ? 0 : 0.8,
            transition: 'opacity 0.3s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 12L12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Swipe up for details</span>
        </div>
      </div>
    </div>
  );
};

export default PhotoViewer;
