import { useCallback, useState } from 'preact/hooks'

export interface AssetSelectionState {
  /** Whether selection mode is currently active */
  isSelectionMode: boolean
  /** Set of selected asset IDs */
  selectedAssetIds: Set<string>
  /** Number of selected assets */
  selectionCount: number
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
}

/**
 * Hook for managing asset selection state in timeline views.
 * Provides selection mode toggle and asset selection tracking.
 */
export function useAssetSelection(): AssetSelectionState {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())

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

  return {
    isSelectionMode,
    selectedAssetIds,
    selectionCount: selectedAssetIds.size,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectionMode,
    toggleAssetSelection,
    isAssetSelected,
    selectAssets,
    deselectAssets,
    clearSelection,
  }
}

