import pluralize from 'pluralize'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact/jsx-runtime'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import type { AssetTimelineItem } from '../../services/api'
import { TimelineThumbnail } from './TimelineThumbnail'

interface VirtualizedTimelineProps<A extends AssetTimelineItem> {
  assets: A[]
  columnCount?: number
  showDateHeaders?: boolean
  hasMoreContent?: boolean
  isLoadingMore?: boolean
  onAssetOpenRequest: (asset: A, info: { position: ThumbnailPosition | null }) => void
  onLoadMoreRequest?: () => void
}

interface TimelineSection<A extends AssetTimelineItem> {
  date: string
  assets: A[]
}

export function VirtualizedTimeline<A extends AssetTimelineItem>({
  assets,
  columnCount = 3,
  showDateHeaders = true,
  hasMoreContent = false,
  isLoadingMore = false,
  onAssetOpenRequest,
  onLoadMoreRequest,
}: VirtualizedTimelineProps<A>) {
  const [sections, setSections] = useState<TimelineSection<A>[]>([])
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Group assets by date
  useEffect(() => {
    if (assets?.length === 0) {
      return
    }

    // If showDateHeaders is false, merge all assets into a single section
    if (!showDateHeaders) {
      // Sort assets by date (newest first)
      const sortedAssets = [...assets].sort((a, b) => {
        const dateA = a.fileCreatedAt ? new Date(a.fileCreatedAt).getTime() : 0
        const dateB = b.fileCreatedAt ? new Date(b.fileCreatedAt).getTime() : 0
        return dateB - dateA
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

    // Convert to array and sort by date (newest first)
    const sortedSections = Object.entries(groupedByDate)
      .map(([date, assets]) => ({ date, assets }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setSections(sortedSections)
  }, [assets, showDateHeaders])

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)

    return () => {
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  // Handle scroll events to detect when user is near the bottom
  const handleScroll = useCallback(() => {
    if (!(scrollContainerRef.current && onLoadMoreRequest)) {
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    // Calculate how far the user has scrolled (0 to 1)
    const scrollPosition = scrollTop / (scrollHeight - clientHeight)

    // If user has scrolled past 80% of the content and we're not already loading more
    const isNearEnd = scrollPosition > 0.8

    if (isNearEnd && hasMoreContent && !isLoadingMore) {
      onLoadMoreRequest()
    }
  }, [onLoadMoreRequest, hasMoreContent, isLoadingMore])

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

  // Calculate thumbnail size based on container width and column count
  const thumbnailSize = containerWidth ? Math.floor(containerWidth / columnCount) - 1 : 0 // 2px for gap

  // Render a row in the virtual list
  const renderRow = (section: TimelineSection, _index: number) => {
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
        <div
          key={`header-${section.date}`}
          class="timeline-date-header"
          style={{
            padding: 'var(--spacing-md)',
            fontWeight: 'var(--font-weight-semibold)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            zIndex: 1,
          }}
        >
          {formattedDate}
        </div>,
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
          style={{
            height: '100%',
            overflow: 'auto',
            backgroundColor: 'var(--color-background)',
            paddingBottom: 'var(--tabbar-height)',
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
