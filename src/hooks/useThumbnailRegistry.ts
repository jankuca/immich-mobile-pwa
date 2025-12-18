import { useCallback, useRef } from 'preact/hooks'
import type { ThumbnailPosition } from './useZoomTransition'

/** Function that returns the current position of a thumbnail */
export type ThumbnailPositionGetter = () => ThumbnailPosition | null

/** Function to get a thumbnail position by asset ID */
export type GetThumbnailPosition = (assetId: string) => ThumbnailPosition | null

interface UseThumbnailRegistryResult {
  /** Get the position of a thumbnail by asset ID */
  getThumbnailPosition: GetThumbnailPosition
  /** Register a thumbnail position getter for an asset */
  registerThumbnail: (assetId: string, getPosition: ThumbnailPositionGetter) => void
  /** Unregister a thumbnail position getter for an asset */
  unregisterThumbnail: (assetId: string) => void
}

/**
 * Manages a registry of thumbnail position getters.
 * 
 * Thumbnails register themselves when mounted and unregister when unmounted.
 * This allows the photo viewer to get the position of a thumbnail for
 * zoom transitions.
 */
export function useThumbnailRegistry(): UseThumbnailRegistryResult {
  // Map of asset ID to position getter function
  const thumbnailPositionGettersRef = useRef<Map<string, ThumbnailPositionGetter>>(new Map())

  // Get thumbnail position by asset ID
  const getThumbnailPosition = useCallback((assetId: string): ThumbnailPosition | null => {
    const getter = thumbnailPositionGettersRef.current.get(assetId)
    return getter ? getter() : null
  }, [])

  // Register a thumbnail position getter
  const registerThumbnail = useCallback(
    (assetId: string, getPosition: ThumbnailPositionGetter) => {
      thumbnailPositionGettersRef.current.set(assetId, getPosition)
    },
    [],
  )

  // Unregister a thumbnail position getter
  const unregisterThumbnail = useCallback((assetId: string) => {
    thumbnailPositionGettersRef.current.delete(assetId)
  }, [])

  return {
    getThumbnailPosition,
    registerThumbnail,
    unregisterThumbnail,
  }
}

