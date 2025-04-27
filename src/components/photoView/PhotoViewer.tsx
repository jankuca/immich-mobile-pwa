import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
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
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [startY, setStartY] = useState<number | null>(null);
  const [offsetY, setOffsetY] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex(a => a.id === currentAsset.id);
  
  // Handle swipe gestures
  const handleTouchStart = (e: TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    if (startY === null) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    // Determine if it's a vertical swipe
    if (Math.abs(diff) > 10) {
      e.preventDefault();
      setOffsetY(diff);
    }
  };
  
  const handleTouchEnd = () => {
    if (offsetY < -50) {
      // Swipe up - show details
      setShowDetails(true);
    } else if (offsetY > 50) {
      // Swipe down - close viewer
      onClose();
    }
    
    setStartY(null);
    setOffsetY(0);
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
  
  // Handle horizontal swipe for navigation
  const handleHorizontalSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      goToNext();
    } else {
      goToPrevious();
    }
  };
  
  // Close details view
  const closeDetails = () => {
    setShowDetails(false);
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
        display: 'flex',
        flexDirection: 'column',
        transform: `translateY(${offsetY}px)`,
        transition: offsetY === 0 ? 'transform 0.3s ease' : 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main image view */}
      <div 
        class="photo-viewer-content"
        style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
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
      
      {/* Details view */}
      {showDetails && (
        <PhotoDetails 
          asset={currentAsset} 
          onClose={closeDetails} 
        />
      )}
      
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
          opacity: showDetails ? 0 : 0.8
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 12L12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Swipe up for details</span>
      </div>
    </div>
  );
};

export default PhotoViewer;
