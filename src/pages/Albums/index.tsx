import { useEffect, useMemo, useState } from 'preact/hooks'
import { Header } from '../../components/common/Header'
import { SectionPill } from '../../components/common/SectionPill'
import { SearchInput } from '../../components/search/SearchInput'
import { useHashLocation } from '../../contexts/HashLocationContext'
import { type Album, apiService } from '../../services/api'
import { fuzzyFilter } from '../../utils/fuzzySearch'

export function Albums() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { route } = useHashLocation()

  // Filter albums based on search query
  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) {
      return albums
    }
    return fuzzyFilter(albums, searchQuery, (album) => album.albumName)
  }, [albums, searchQuery])

  // Group filtered albums by year+month and sort within each group by end/start date
  const { albumsByMonth, sortedMonths } = useMemo(() => {
    const grouped = filteredAlbums.reduce(
      (acc, album) => {
        // Use the end date, start date, or created date to determine the month
        const date = new Date(album.endDate || album.startDate || album.createdAt)
        // Key format: "YYYY-MM" for sorting, will be formatted for display
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

        if (!acc[key]) {
          acc[key] = []
        }

        acc[key].push(album)
        return acc
      },
      {} as Record<string, Album[]>,
    )

    // Sort albums within each month by end/start date (most recent first)
    for (const key of Object.keys(grouped)) {
      grouped[key]?.sort((a, b) => {
        const dateA = new Date(a.endDate || a.startDate || a.createdAt).getTime()
        const dateB = new Date(b.endDate || b.startDate || b.createdAt).getTime()
        return dateB - dateA
      })
    }

    // Sort months in descending order
    const sorted = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

    return { albumsByMonth: grouped, sortedMonths: sorted }
  }, [filteredAlbums])

  // Format month key (YYYY-MM) to display string (e.g., "March 2024")
  const formatMonthKey = (key: string) => {
    const [year, month] = key.split('-')
    const date = new Date(Number(year), Number(month) - 1)
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  // Fetch albums
  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const data = await apiService.getAlbums()
        setAlbums(data)
      } catch (err) {
        console.error('Error fetching albums:', err)
        setError('Failed to load albums. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAlbums()
  }, [])

  // Navigate to album detail
  const handleAlbumClick = (albumId: string) => {
    route(`/albums/${albumId}`)
  }

  return (
    <div class="ios-page">
      <Header
        title="Albums"
        rightAction={{
          icon: (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 5V19"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M5 12H19"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          ),
          onClick: () => {
            console.log('Create album')
          },
        }}
      />

      {/* Search Input */}
      <div class="ios-search-wrapper">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search albums..." />
      </div>

      <div class="ios-content">
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              color: 'var(--color-gray)',
            }}
          >
            <div
              class="loading-spinner"
              style={{
                width: '40px',
                height: '40px',
                border: '4px solid var(--color-gray-light)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ marginTop: 'var(--spacing-md)' }}>Loading albums...</p>

            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : error ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              color: 'var(--color-danger)',
              padding: 'var(--spacing-lg)',
            }}
          >
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
            <p style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 'var(--spacing-lg)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : filteredAlbums.length === 0 && searchQuery.trim() ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--spacing-xl)',
              color: 'var(--color-gray)',
              flexDirection: 'column',
              textAlign: 'center',
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M21 21L16.65 16.65"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <p style={{ marginTop: 'var(--spacing-md)' }}>No albums found for "{searchQuery}"</p>
          </div>
        ) : albums.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              color: 'var(--color-gray)',
              padding: 'var(--spacing-lg)',
            }}
          >
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
            <p style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>No albums found</p>
            <button
              type="button"
              onClick={() => {
                console.log('Create album')
              }}
              style={{
                marginTop: 'var(--spacing-lg)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 5V19"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M5 12H19"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Create Album</span>
            </button>
          </div>
        ) : (
          <div
            class="albums-list"
            style={{
              paddingLeft: 'var(--spacing-md)',
              paddingRight: 'var(--spacing-md)',
              paddingBottom: 'var(--spacing-md)',
            }}
          >
            {sortedMonths.map((monthKey) => (
              <div key={monthKey} class="albums-month-section">
                <SectionPill sticky={true}>{formatMonthKey(monthKey)}</SectionPill>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'var(--spacing-md)',
                  }}
                >
                  {albumsByMonth[monthKey]?.map((album) => (
                    <div
                      key={album.id}
                      class="album-card"
                      onClick={() => handleAlbumClick(album.id)}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          paddingBottom: '100%', // 1:1 aspect ratio
                          backgroundColor: 'var(--color-gray)',
                        }}
                      >
                        {album.albumThumbnailAssetId && (
                          <img
                            src={apiService.getAssetThumbnailUrl(album.albumThumbnailAssetId)}
                            alt={album.albumName}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            loading="lazy"
                          />
                        )}

                        {/* Album info overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: 'var(--spacing-sm)',
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                            color: 'white',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-medium)',
                            }}
                          >
                            {album.assetCount} {album.assetCount === 1 ? 'photo' : 'photos'}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 'var(--spacing-sm)',
                          backgroundColor: 'var(--color-light)',
                        }}
                      >
                        <h3
                          style={{
                            color: 'var(--color-dark)',
                            fontSize: 'var(--font-size-md)',
                            fontWeight: 'var(--font-weight-semibold)',
                            marginBottom: 'var(--spacing-xs)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {album.albumName}
                        </h3>

                        <p
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-gray)',
                          }}
                        >
                          {album.startDate ? (
                            <>
                              {new Date(album.startDate).toLocaleDateString(undefined, {
                                localeMatcher: 'best fit',
                              })}
                              {album.endDate &&
                                album.startDate !== album.endDate &&
                                ` - ${new Date(album.endDate).toLocaleDateString(undefined, { localeMatcher: 'best fit' })}`}
                            </>
                          ) : (
                            'No photos'
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
