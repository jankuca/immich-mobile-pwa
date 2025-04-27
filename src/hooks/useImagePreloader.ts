import { useState, useEffect } from 'preact/hooks';
import apiService from '../services/api';
import { Asset } from '../services/api';

// Interface for tracking image loading status
export interface ImageLoadingStatus {
  [assetId: string]: {
    thumbnailLoaded: boolean;
    fullImageLoaded: boolean;
  };
}

/**
 * Custom hook for preloading images and tracking their loading status
 * @param assets Array of assets that might need to be preloaded
 * @param currentAssetId ID of the currently displayed asset
 * @param preloadCount Number of assets to preload in each direction (prev/next)
 * @returns Object containing loading status and utility functions
 */
export function useImagePreloader(
  assets: Asset[],
  currentAssetId: string,
  preloadCount: number = 2
) {
  const [loadingStatus, setLoadingStatus] = useState<ImageLoadingStatus>({});
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());

  // Find the index of the current asset in the assets array
  const currentIndex = assets.findIndex(a => a.id === currentAssetId);

  // Preload an image and track its loading status
  const preloadImage = (assetId: string) => {
    if (!assetId || preloadedImages.has(assetId)) return;

    // Initialize loading status for this asset if not already set
    if (!loadingStatus[assetId]) {
      setLoadingStatus(prev => ({
        ...prev,
        [assetId]: { thumbnailLoaded: false, fullImageLoaded: false }
      }));
    }

    // Preload thumbnail
    const thumbnailUrl = apiService.getAssetThumbnailUrl(assetId, 'webp');
    const thumbnailImg = new Image();
    thumbnailImg.onload = () => {
      setLoadingStatus(prev => ({
        ...prev,
        [assetId]: { ...prev[assetId], thumbnailLoaded: true }
      }));

      // After thumbnail loads, preload the full image
      const fullUrl = apiService.getAssetUrl(assetId);
      const fullImg = new Image();
      fullImg.onload = () => {
        setLoadingStatus(prev => ({
          ...prev,
          [assetId]: { ...prev[assetId], fullImageLoaded: true }
        }));
      };
      fullImg.src = fullUrl;
    };
    thumbnailImg.src = thumbnailUrl;

    // Mark this asset as being preloaded
    setPreloadedImages(prev => new Set(prev).add(assetId));
  };

  // Handle image load event (for when an image is loaded directly in the DOM)
  const handleImageLoad = (assetId: string) => {
    setLoadingStatus(prev => ({
      ...prev,
      [assetId]: {
        thumbnailLoaded: true,
        fullImageLoaded: true
      }
    }));
  };

  // Preload neighboring images when current asset changes
  useEffect(() => {
    // Preload current image if not already loaded
    preloadImage(currentAssetId);

    // Preload next N images if available
    for (let i = 1; i <= preloadCount; i++) {
      if (currentIndex + i < assets.length) {
        preloadImage(assets[currentIndex + i].id);
      }
    }

    // Preload previous N images if available
    for (let i = 1; i <= preloadCount; i++) {
      if (currentIndex - i >= 0) {
        preloadImage(assets[currentIndex - i].id);
      }
    }
  }, [currentAssetId, currentIndex, assets, preloadCount]);

  // Get loading status for a specific asset
  const getLoadingStatus = (assetId: string) => {
    return loadingStatus[assetId] || { thumbnailLoaded: false, fullImageLoaded: false };
  };

  return {
    loadingStatus,
    preloadImage,
    handleImageLoad,
    getLoadingStatus,
    isPreloaded: (assetId: string) => preloadedImages.has(assetId)
  };
}
