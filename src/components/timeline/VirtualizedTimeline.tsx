import pluralize from 'pluralize'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact/jsx-runtime'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import type { AssetOrder, AssetTimelineItem } from '../../services/api'
import { SectionPill } from '../common/SectionPill'
import type { ThumbnailPositionGetter } from './TimelineThumbnail'
import { TimelineThumbnail } from './TimelineThumbnail'

// Target thumbnail size in pixels - columns are calculated to fit this size
const TARGET_THUMBNAIL_SIZE = 130
const MIN_COLUMNS = 3

export type GetThumbnailPosition = (assetId: string) => ThumbnailPosition | null

interface VirtualizedTimelineProps<A extends AssetTimelineItem> {
  assets: A[]
  showDateHeaders?: boolean
  hasMoreContent?: boolean
  isLoadingMore?: boolean
  order?: AssetOrder
  /** Whether to include top padding for the page header offset (default: true) */
  includeHeaderOffset?: boolean
  onAssetOpenRequest: (asset: A, info: { position: ThumbnailPosition | null }) => void
  onLoadMoreRequest?: () => void
  /** Callback to provide the getThumbnailPosition function to parent */
  onThumbnailPositionGetterReady?: (getter: GetThumbnailPosition) => void
  /** ID of the asset to anchor/keep visible after orientation changes (e.g., the currently viewed photo) */
  anchorAssetId?: string | null | undefined
}

interface TimelineSection<A extends AssetTimelineItem> {
  date: string
  assets: A[]
}

export function VirtualizedTimeline<A extends AssetTimelineItem>({
  assets,
  showDateHeaders = true,
  hasMoreContent = false,
  isLoadingMore = false,
  order = 'desc',
  includeHeaderOffset = true,
  onAssetOpenRequest,
  onLoadMoreRequest,
  onThumbnailPositionGetterReady,
  anchorAssetId,
}: VirtualizedTimelineProps<A>) {
  const [sections, setSections] = useState<TimelineSection<A>[]>([])
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Registry of thumbnail position getters by asset ID
  const thumbnailPositionGettersRef = useRef<Map<string, ThumbnailPositionGetter>>(new Map())

  // Track the first visible asset for anchoring when no photo is open
  const firstVisibleAssetIdRef = useRef<string | null>(null)

  // Function to get thumbnail position by asset ID
  const getThumbnailPosition = useCallback((assetId: string): ThumbnailPosition | null => {
    const getter = thumbnailPositionGettersRef.current.get(assetId)
    return getter ? getter() : null
  }, [])

  // Register a thumbnail position getter
  const handleThumbnailRegister = useCallback(
    (assetId: string, getPosition: ThumbnailPositionGetter) => {
      thumbnailPositionGettersRef.current.set(assetId, getPosition)
    },
    [],
  )

  // Unregister a thumbnail position getter
  const handleThumbnailUnregister = useCallback((assetId: string) => {
    thumbnailPositionGettersRef.current.delete(assetId)
  }, [])

  // Provide the getter to parent component
  useEffect(() => {
    if (onThumbnailPositionGetterReady) {
      onThumbnailPositionGetterReady(getThumbnailPosition)
    }
  }, [getThumbnailPosition, onThumbnailPositionGetterReady])

  // Calculate column count based on container width to maintain square thumbnails
  const columnCount = containerWidth
    ? Math.max(MIN_COLUMNS, Math.floor(containerWidth / TARGET_THUMBNAIL_SIZE))
    : MIN_COLUMNS

  // Calculate thumbnail size based on container width and column count
  const thumbnailSize = containerWidth ? Math.floor(containerWidth / columnCount) - 1 : 0 // 2px for gap

  // Group assets by date
  useEffect(() => {
    if (assets?.length === 0) {
      return
    }

    // If showDateHeaders is false, merge all assets into a single section
    if (!showDateHeaders) {
      // Sort assets by date based on order prop
      const sortedAssets = [...assets].sort((a, b) => {
        const dateA = a.fileCreatedAt ? new Date(a.fileCreatedAt).getTime() : 0
        const dateB = b.fileCreatedAt ? new Date(b.fileCreatedAt).getTime() : 0
        return order === 'asc' ? dateA - dateB : dateB - dateA
      })

      // Create a single section with all assets
      const mergedSection = {
        date: 'all-assets',
        assets: sortedAssets,
      }
      setSections([mergedSection])
      return
    }

    // If showDateHeaders is true, group by date as before
    const groupedByDate: { [key: string]: A[] } = {}
    for (const asset of assets) {
      if (!asset.fileCreatedAt) {
        return
      }

      // Format date as YYYY-MM-DD
      const date = String(new Date(asset.fileCreatedAt).toISOString().split('T')[0])

      if (!groupedByDate[date]) {
        groupedByDate[date] = []
      }

      groupedByDate[date].push(asset)
    }

    // Convert to array and sort by date based on order prop
    const sortedSections = Object.entries(groupedByDate)
      .map(([date, assets]) => ({ date, assets }))
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime()
        const timeB = new Date(b.date).getTime()
        return order === 'asc' ? timeA - timeB : timeB - timeA
      })
    setSections(sortedSections)
  }, [assets, showDateHeaders, order])

  // Helper function to get the asset index in the flat list
  const getAssetIndex = useCallback(
    (assetId: string): number => {
      let index = 0
      for (const section of sections) {
        for (const asset of section.assets) {
          if (asset.id === assetId) {
            return index
          }
          index++
        }
      }
      return -1
    },
    [sections],
  )

  // Helper function to calculate scroll position for an asset given a specific column count
  const calculateScrollPositionForAsset = useCallback(
    (assetId: string, width: number): number | null => {
      const assetIndex = getAssetIndex(assetId)
      if (assetIndex === -1) {
        return null
      }

      // Calculate column count for the given width
      const cols = width
        ? Math.max(MIN_COLUMNS, Math.floor(width / TARGET_THUMBNAIL_SIZE))
        : MIN_COLUMNS
      const thumbSize = width ? Math.floor(width / cols) - 1 : 0

      // Calculate which row the asset is in
      // Need to account for date headers if shown
      let currentAssetIndex = 0
      let scrollPosition = 0
      const headerHeight = showDateHeaders ? 48 : 0 // Approximate header height

      for (const section of sections) {
        if (showDateHeaders) {
          // Add header height
          scrollPosition += headerHeight
        }

        const assetsInSection = section.assets.length
        const rowsInSection = Math.ceil(assetsInSection / cols)
        const assetRowOffset = Math.floor((assetIndex - currentAssetIndex) / cols)

        if (assetIndex >= currentAssetIndex && assetIndex < currentAssetIndex + assetsInSection) {
          // Asset is in this section
          scrollPosition += assetRowOffset * (thumbSize + 2) // +2 for gap
          return scrollPosition
        }

        // Add all rows in this section
        scrollPosition += rowsInSection * (thumbSize + 2)
        currentAssetIndex += assetsInSection
      }

      return null
    },
    [getAssetIndex, sections, showDateHeaders],
  )

  // Update container width on resize using ResizeObserver for reliable orientation change detection
  useEffect(() => {
    const container = containerRef.current
    const scrollContainer = scrollContainerRef.current
    if (!container) {
      return
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use contentBoxSize for more accurate measurement
        const newWidth = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
        const oldWidth = containerWidth

        // Determine which asset to anchor to
        const assetIdToAnchor = anchorAssetId ?? firstVisibleAssetIdRef.current
        if (assetIdToAnchor && oldWidth && newWidth !== oldWidth && scrollContainer) {
          // Calculate the scroll position for the anchor asset before and after resize
          const oldScrollPos = calculateScrollPositionForAsset(assetIdToAnchor, oldWidth)
          const newScrollPos = calculateScrollPositionForAsset(assetIdToAnchor, newWidth)

          if (oldScrollPos !== null && newScrollPos !== null) {
            // Calculate the offset from the asset's position to the current scroll position
            const currentScroll = scrollContainer.scrollTop
            const offsetFromAnchor = currentScroll - oldScrollPos

            // Apply the same offset to the new position
            // Use requestAnimationFrame to wait for the DOM to update
            requestAnimationFrame(() => {
              if (scrollContainer) {
                scrollContainer.scrollTop = newScrollPos + offsetFromAnchor
              }
            })
          }
        }

        setContainerWidth(newWidth)
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [anchorAssetId, calculateScrollPositionForAsset, containerWidth])

  // Handle scroll events to detect when user is near the bottom and track first visible asset
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) {
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer

    // Track the first visible asset for anchoring (only when no explicit anchor is set)
    if (!anchorAssetId && thumbnailSize > 0) {
      // Find the first visible asset based on scroll position
      const headerHeight = showDateHeaders ? 48 : 0
      let currentPosition = 0
      let foundFirstVisible = false

      for (const section of sections) {
        if (showDateHeaders) {
          currentPosition += headerHeight
        }

        const assetsInSection = section.assets.length
        const rowsInSection = Math.ceil(assetsInSection / columnCount)
        const sectionHeight = rowsInSection * (thumbnailSize + 2)

        if (!foundFirstVisible && currentPosition + sectionHeight > scrollTop) {
          // The first visible asset is in this section
          const offsetInSection = Math.max(0, scrollTop - currentPosition)
          const rowIndex = Math.floor(offsetInSection / (thumbnailSize + 2))
          const assetIndex = rowIndex * columnCount

          if (assetIndex < assetsInSection) {
            firstVisibleAssetIdRef.current = section.assets[assetIndex]?.id ?? null
            foundFirstVisible = true
            break
          }
        }

        currentPosition += sectionHeight
      }
    }

    // Check if we're near the end and need to load more
    if (onLoadMoreRequest) {
      const scrollPosition = scrollTop / (scrollHeight - clientHeight)
      const isNearEnd = scrollPosition > 0.8

      if (isNearEnd && hasMoreContent && !isLoadingMore) {
        onLoadMoreRequest()
      }
    }
  }, [
    anchorAssetId,
    columnCount,
    hasMoreContent,
    isLoadingMore,
    onLoadMoreRequest,
    sections,
    showDateHeaders,
    thumbnailSize,
  ])

  // Add scroll event listener
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to check if we want to request more after adding sections
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)

      // Check if we need to load more content initially (if container isn't filled)
      if (
        scrollContainer.scrollHeight <= scrollContainer.clientHeight &&
        hasMoreContent &&
        !isLoadingMore &&
        onLoadMoreRequest
      ) {
        onLoadMoreRequest()
      }
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [handleScroll, hasMoreContent, isLoadingMore, onLoadMoreRequest, sections])

  // Render a row in the virtual list
  const renderRow = (section: TimelineSection<A>, _index: number) => {
    const formattedDate = new Date(section.date).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Calculate rows needed for this section
    const rowCount = Math.ceil(section.assets.length / columnCount)
    const rows: Array<JSX.Element> = []

    // Add date header if showDateHeaders is true
    if (showDateHeaders) {
      rows.push(
        <SectionPill key={`header-${section.date}`} sticky={true}>
          {formattedDate}
        </SectionPill>,
      )
    }

    // Add asset rows
    for (let i = 0; i < rowCount; i++) {
      const rowAssets = section.assets.slice(i * columnCount, (i + 1) * columnCount)

      rows.push(
        <div
          key={`row-${section.date}-${i}`}
          class="timeline-row"
          style={{
            display: 'flex',
            gap: '1px',
            marginBottom: '2px',
          }}
        >
          {rowAssets.map((asset) => (
            <TimelineThumbnail
              key={asset.id}
              asset={asset}
              size={thumbnailSize}
              onClick={(info) => onAssetOpenRequest(asset, info)}
              onRegister={handleThumbnailRegister}
              onUnregister={handleThumbnailUnregister}
            />
          ))}

          {/* Add empty placeholders to fill the row */}
          {new Array(columnCount - rowAssets.length).fill(0).map((_, j) => (
            <div
              key={`placeholder-${j}`}
              style={{
                width: `${thumbnailSize}px`,
                height: `${thumbnailSize}px`,
              }}
            />
          ))}
        </div>,
      )
    }

    return (
      <div key={`section-${section.date}`} class="timeline-section">
        {rows}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      class="virtualized-timeline"
      style={{
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {containerWidth > 0 && sections.length > 0 ? (
        <div
          ref={scrollContainerRef}
          class="virtualized-timeline-scroll"
          style={{
            height: '100%',
            overflow: 'auto',
            backgroundColor: 'var(--color-background)',
            paddingTop: includeHeaderOffset ? 'var(--timeline-header-offset)' : undefined,
            paddingBottom: 'var(--timeline-bottom-offset, var(--tabbar-height))',
          }}
        >
          {sections.map((section, index) => renderRow(section, index))}

          {/* Loading indicator */}
          {isLoadingMore && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: 'var(--spacing-md)',
                color: 'var(--color-gray)',
              }}
            >
              <div
                class="loading-spinner"
                style={{
                  width: '24px',
                  height: '24px',
                  border: '3px solid var(--color-gray-light)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          )}

          {/* End of content message */}
          {!hasMoreContent && sections.length > 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                color: 'var(--color-gray)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {assets.length} {pluralize('photo', assets.length)}
            </div>
          )}

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <div
          class="timeline-empty"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            color: 'var(--color-gray)',
            backgroundColor: 'var(--color-background)',
          }}
        >
          {assets.length > 0 && sections.length === 0 ? (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 8V12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 16H12.01"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p style={{ marginTop: 'var(--spacing-md)' }}>Error grouping photos by date</p>
            </>
          ) : (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 15L16 10L5 21"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p style={{ marginTop: 'var(--spacing-md)' }}>No photos to display</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
