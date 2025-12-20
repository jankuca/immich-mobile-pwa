import { useCallback, useState } from 'preact/hooks'
import { apiService } from '../services/api'

export interface AssetSelectionState {
  /** Whether selection mode is currently active */
  isSelectionMode: boolean
  /** Set of selected asset IDs */
  selectedAssetIds: Set<string>
  /** Number of selected assets */
  selectionCount: number
  /** Whether a share/download operation is in progress */
  isSharing: boolean
  /** Enter selection mode */
  enterSelectionMode: () => void
  /** Exit selection mode and clear selection */
  exitSelectionMode: () => void
  /** Toggle selection mode */
  toggleSelectionMode: () => void
  /** Toggle selection of a specific asset */
  toggleAssetSelection: (assetId: string) => void
  /** Check if an asset is selected */
  isAssetSelected: (assetId: string) => boolean
  /** Select multiple assets */
  selectAssets: (assetIds: string[]) => void
  /** Deselect multiple assets */
  deselectAssets: (assetIds: string[]) => void
  /** Clear all selections (but stay in selection mode) */
  clearSelection: () => void
  /** Share/download selected assets using navigator.share() */
  shareSelectedAssets: () => Promise<void>
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  if (contentType.includes('png')) {
    return 'png'
  }
  if (contentType.includes('gif')) {
    return 'gif'
  }
  if (contentType.includes('webp')) {
    return 'webp'
  }
  if (contentType.includes('video')) {
    return 'mp4'
  }
  return 'jpg'
}

/**
 * Fetch an asset as a File object for sharing
 */
async function fetchAssetAsFile(assetId: string): Promise<File> {
  const url = apiService.getAssetUrl(assetId)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch asset ${assetId}`)
  }
  const blob = await response.blob()
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const extension = getExtensionFromContentType(contentType)
  return new File([blob], `photo-${assetId}.${extension}`, { type: contentType })
}

/**
 * Hook for managing asset selection state in timeline views.
 * Provides selection mode toggle and asset selection tracking.
 */
export function useAssetSelection(): AssetSelectionState {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())
  const [isSharing, setIsSharing] = useState(false)

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true)
  }, [])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedAssetIds(new Set())
  }, [])

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // Exiting selection mode - clear selection
        setSelectedAssetIds(new Set())
      }
      return !prev
    })
  }, [])

  const toggleAssetSelection = useCallback((assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      return next
    })
  }, [])

  const isAssetSelected = useCallback(
    (assetId: string) => selectedAssetIds.has(assetId),
    [selectedAssetIds],
  )

  const selectAssets = useCallback((assetIds: string[]) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev)
      for (const id of assetIds) {
        next.add(id)
      }
      return next
    })
  }, [])

  const deselectAssets = useCallback((assetIds: string[]) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev)
      for (const id of assetIds) {
        next.delete(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedAssetIds(new Set())
  }, [])

  const shareSelectedAssets = useCallback(async () => {
    if (selectedAssetIds.size === 0) {
      return
    }

    setIsSharing(true)
    try {
      // Fetch all selected assets as files
      const assetIds = Array.from(selectedAssetIds)
      const files = await Promise.all(assetIds.map(fetchAssetAsFile))
      // Check if navigator.share supports files
      if (navigator.canShare?.({ files })) {
        await navigator.share({
          files,
          title: `${files.length} photo${files.length > 1 ? 's' : ''}`,
        })
      } else {
        // navigator.canShare is not available - likely due to non-HTTPS connection
        // Show an error message to the user
        alert(
          'Sharing is not available.\n\nThis feature requires a secure (HTTPS) connection. Please access this app over HTTPS to download photos.',
        )
      }
    } catch (error) {
      // User cancelled the share or an error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error)
      }
    } finally {
      setIsSharing(false)
    }
  }, [selectedAssetIds])

  return {
    isSelectionMode,
    selectedAssetIds,
    selectionCount: selectedAssetIds.size,
    isSharing,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectionMode,
    toggleAssetSelection,
    isAssetSelected,
    selectAssets,
    deselectAssets,
    clearSelection,
    shareSelectedAssets,
  }
}
