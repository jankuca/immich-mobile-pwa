import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
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
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [startY, setStartY] = useState<number | null>(null);
  const [isAtTop, setIsAtTop] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex(a => a.id === currentAsset.id);

  // Get the URL for the current asset
  const assetUrl = apiService.getAssetUrl(currentAsset.id);

  // Calculate the photo container height based on scroll position
  // As we scroll down, the photo container shrinks from 100vh to a minimum height
  const maxScrollForEffect = 300; // The scroll amount at which the effect is complete
  const minPhotoHeight = 300; // Minimum height of the photo container in pixels
  const photoContainerHeight = Math.max(
    minPhotoHeight,
    window.innerHeight - (scrollPosition * (window.innerHeight - minPhotoHeight) / maxScrollForEffect)
  );

  // Handle scroll events
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop;
      setScrollPosition(scrollTop);
      setIsAtTop(scrollTop <= 10);
    }
  };

  // Set up scroll event listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Handle touch start for swipe down to close
  const handleTouchStart = (e: TouchEvent) => {
    if (isAtTop) {
      setStartY(e.touches[0].clientY);
    }
  };

  // Handle touch move for swipe down to close
  const handleTouchMove = (e: TouchEvent) => {
    if (startY !== null && isAtTop) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      // If swiping down when at the top, prevent default scrolling
      if (diff > 10) {
        e.preventDefault();

        // Calculate the swipe progress (0 to 1)
        const maxSwipeDistance = window.innerHeight / 3; // 1/3 of screen height for full effect
        const progress = Math.min(diff / maxSwipeDistance, 1);

        // Move the scroll container down to follow the finger
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.transform = `translateY(${diff}px)`;
          scrollContainerRef.current.style.transition = 'none';
        }

        // Update the photo container background opacity based on the swipe progress
        const photoContainer = document.querySelector('.photo-viewer-photo-container');
        if (photoContainer) {
          const newOpacity = 1 - progress;
          (photoContainer as HTMLElement).style.backgroundColor = `rgba(255, 255, 255, ${newOpacity})`;
        }
      }
    }
  };

  // Handle touch end for swipe down to close
  const handleTouchEnd = () => {
    if (startY !== null && isAtTop && scrollContainerRef.current) {
      const transform = scrollContainerRef.current.style.transform;
      const match = transform.match(/translateY\((\d+)px\)/);

      if (match) {
        const swipeDistance = parseInt(match[1]);
        const maxSwipeDistance = window.innerHeight / 3;
        const progress = swipeDistance / maxSwipeDistance;

        if (progress > 0.1) {
          // If swiped down more than 10% of the max distance, close the viewer
          onClose();
        } else {
          // Otherwise, reset the transform and background
          scrollContainerRef.current.style.transform = '';
          scrollContainerRef.current.style.transition = 'transform 0.3s ease';

          // Reset the photo container background color
          const photoContainer = document.querySelector('.photo-viewer-photo-container');
          if (photoContainer) {
            (photoContainer as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 1)';
            (photoContainer as HTMLElement).style.transition = 'background-color 0.3s ease';
          }
        }
      }
    }

    setStartY(null);
  };

  // Navigate to previous asset
  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentAsset(assets[currentIndex - 1]);
      // Reset scroll position when changing assets
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  // Navigate to next asset
  const goToNext = () => {
    if (currentIndex < assets.length - 1) {
      setCurrentAsset(assets[currentIndex + 1]);
      // Reset scroll position when changing assets
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  };

  // Prevent body scrolling when the photo viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

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
        zIndex: 1000,
        overflow: 'hidden' // Prevent content from being visible outside the container
      }}
    >
      {/* Scrollable container for the entire content */}
      <div
        ref={scrollContainerRef}
        class="photo-viewer-scroll-container"
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          scrollBehavior: 'smooth'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Photo container - shrinks as you scroll */}
        <div
          class="photo-viewer-photo-container"
          style={{
            height: `${photoContainerHeight}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            backgroundColor: 'rgba(255, 255, 255, 1)',
            transition: 'background-color 0.3s ease'
          }}
        >
          {/* The actual photo/video */}
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
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
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

          {/* Swipe up indicator - only shown when at the top */}
          {isAtTop && scrollPosition < 10 && (
            <div
              class="swipe-up-indicator"
              style={{
                position: 'absolute',
                bottom: 'var(--spacing-lg)',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-xs) var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                opacity: 0.8,
                transition: 'opacity 0.3s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 12L12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Scroll for details</span>
            </div>
          )}
        </div>

        {/* Photo details - directly follows the photo container */}
        <PhotoDetails asset={currentAsset} />
      </div>
    </div>
  );
};

export default PhotoViewer;
