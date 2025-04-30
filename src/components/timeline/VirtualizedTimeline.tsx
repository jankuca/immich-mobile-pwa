import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Asset } from '../../services/api';
import TimelineThumbnail from './TimelineThumbnail';
import { ThumbnailPosition } from '../../hooks/useZoomTransition';

interface VirtualizedTimelineProps {
  assets: Asset[];
  onAssetClick: (asset: Asset, info: { position: ThumbnailPosition | null }) => void;
  columnCount?: number;
  showDateHeaders?: boolean;
}

interface TimelineSection {
  date: string;
  assets: Asset[];
}

const VirtualizedTimeline = ({
  assets,
  onAssetClick,
  columnCount = 3,
  showDateHeaders = true
}: VirtualizedTimelineProps) => {
  const [sections, setSections] = useState<TimelineSection[]>([]);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group assets by date
  useEffect(() => {
    console.log('VirtualizedTimeline received assets:', assets);

    if (!assets || !assets.length) {
      console.log('No assets to display');
      return;
    }

    // If showDateHeaders is false, merge all assets into a single section
    if (!showDateHeaders) {
      // Sort assets by date (newest first)
      const sortedAssets = [...assets].sort((a, b) => {
        const dateA = a.localDateTime ? new Date(a.localDateTime).getTime() : 0;
        const dateB = b.localDateTime ? new Date(b.localDateTime).getTime() : 0;
        return dateB - dateA;
      });

      // Create a single section with all assets
      const mergedSection = {
        date: 'all-assets',
        assets: sortedAssets
      };

      console.log('Created merged section for all assets:', mergedSection);
      setSections([mergedSection]);
      return;
    }

    // If showDateHeaders is true, group by date as before
    const groupedByDate: { [key: string]: Asset[] } = {};

    assets.forEach(asset => {
      if (!asset.localDateTime) {
        console.warn('Asset missing localDateTime:', asset);
        return;
      }

      // Format date as YYYY-MM-DD
      const date = new Date(asset.localDateTime).toISOString().split('T')[0];

      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }

      groupedByDate[date].push(asset);
    });

    // Convert to array and sort by date (newest first)
    const sortedSections = Object.entries(groupedByDate)
      .map(([date, assets]) => ({ date, assets }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('Grouped assets into sections:', sortedSections);
    setSections(sortedSections);
  }, [assets, showDateHeaders]);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Calculate thumbnail size based on container width and column count
  const thumbnailSize = containerWidth ? Math.floor(containerWidth / columnCount) - 1 : 0; // 2px for gap

  // Render a row in the virtual list
  const renderRow = (section: TimelineSection, _index: number) => {
    const formattedDate = new Date(section.date).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Calculate rows needed for this section
    const rowCount = Math.ceil(section.assets.length / columnCount);
    const rows = [];

    // Add date header if showDateHeaders is true
    if (showDateHeaders) {
      rows.push(
        <div key={`header-${section.date}`} class="timeline-date-header" style={{
          padding: 'var(--spacing-md)',
          fontWeight: 'var(--font-weight-semibold)',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
          zIndex: 1
        }}>
          {formattedDate}
        </div>
      );
    }

    // Add asset rows
    for (let i = 0; i < rowCount; i++) {
      const rowAssets = section.assets.slice(i * columnCount, (i + 1) * columnCount);

      rows.push(
        <div key={`row-${section.date}-${i}`} class="timeline-row" style={{
          display: 'flex',
          gap: '1px',
          marginBottom: '2px'
        }}>
          {rowAssets.map(asset => (
            <TimelineThumbnail
              key={asset.id}
              asset={asset}
              size={thumbnailSize}
              onClick={(info) => onAssetClick(asset, info)}
            />
          ))}

          {/* Add empty placeholders to fill the row */}
          {Array(columnCount - rowAssets.length).fill(0).map((_, j) => (
            <div
              key={`placeholder-${j}`}
              style={{
                width: `${thumbnailSize}px`,
                height: `${thumbnailSize}px`
              }}
            />
          ))}
        </div>
      );
    }

    return (
      <div key={`section-${section.date}`} class="timeline-section">
        {rows}
      </div>
    );
  };

  // For debugging
  console.log('Rendering VirtualizedTimeline with sections:', sections);
  console.log('Container width:', containerWidth);

  return (
    <div ref={containerRef} class="virtualized-timeline" style={{
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--color-background)'
    }}>
      {containerWidth > 0 && sections.length > 0 ? (
        <div style={{
          height: '100%',
          overflow: 'auto',
          backgroundColor: 'var(--color-background)'
        }}>
          {sections.map((section, index) => renderRow(section, index))}
        </div>
      ) : (
        <div class="timeline-empty" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          color: 'var(--color-gray)',
          backgroundColor: 'var(--color-background)'
        }}>
          {assets.length > 0 && sections.length === 0 ? (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p style={{ marginTop: 'var(--spacing-md)' }}>Error grouping photos by date</p>
            </>
          ) : (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path d="M21 15L16 10L5 21"
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
  );
};

export default VirtualizedTimeline;
