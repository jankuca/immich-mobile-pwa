import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { Header } from '../../components/common/Header'
import { PhotoViewer } from '../../components/photoView/PhotoViewer'
import {
  type GetThumbnailPosition,
  VirtualizedTimeline,
} from '../../components/timeline/VirtualizedTimeline'
import { useAuth } from '../../contexts/AuthContext'
import { useHashLocation } from '../../contexts/HashLocationContext'
import type { ThumbnailPosition } from '../../hooks/useZoomTransition'
import {
  type Asset,
  type AssetTimelineItem,
  type SearchResult,
  apiService,
} from '../../services/api'
import { FOCUS_SEARCH_INPUT_EVENT } from './events'

export function Search() {
  const [query, setQuery] = useState<string>('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetTimelineItem | null>(null)
  const [selectedThumbnailPosition, setSelectedThumbnailPosition] =
    useState<ThumbnailPosition | null>(null)
  const { route, url } = useHashLocation()
  const { apiKey, isAuthenticated } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  // Store the thumbnail position getter from VirtualizedTimeline
  const [getThumbnailPosition, setGetThumbnailPosition] = useState<GetThumbnailPosition | null>(
    null,
  )

  // Load recent searches from localStorage
  useEffect(() => {
    const savedSearches = localStorage.getItem('immich_recent_searches')
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches))
    }
  }, [])

  // Focus input when page becomes visible or on mount
  useEffect(() => {
    // Small delay to ensure the page is visible
    const timer = setTimeout(() => {
      if (url === '/search' && inputRef.current) {
        inputRef.current.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [url])

  // Listen for focus event from TabBar
  useEffect(() => {
    const handleFocusEvent = () => {
      inputRef.current?.focus()
    }
    window.addEventListener(FOCUS_SEARCH_INPUT_EVENT, handleFocusEvent)
    return () => window.removeEventListener(FOCUS_SEARCH_INPUT_EVENT, handleFocusEvent)
  }, [])

  // Track keyboard height using VisualViewport API
  // Store baseline dimensions to compare against
  const baselineHeight = useRef(window.innerHeight)
  const baselineWidth = useRef(window.innerWidth)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    // Capture the initial dimensions when no keyboard is present
    baselineHeight.current = window.innerHeight
    baselineWidth.current = window.innerWidth

    const handleResize = () => {
      // Detect orientation change: width changed significantly
      const widthChanged = Math.abs(window.innerWidth - baselineWidth.current) > 50

      if (widthChanged) {
        // Orientation changed - update baseline dimensions
        // Use window.innerHeight as the new baseline (layout viewport height)
        baselineHeight.current = window.innerHeight
        baselineWidth.current = window.innerWidth
        // Reset keyboard height on orientation change since viewport.height
        // might not have updated yet, causing incorrect calculations
        setKeyboardHeight(0)
        return
      }

      // Calculate keyboard height as difference from baseline
      const kbHeight = Math.max(0, Math.round(baselineHeight.current - viewport.height))
      setKeyboardHeight(kbHeight)
    }

    // Only listen to resize, not scroll - scroll events can cause jitter
    viewport.addEventListener('resize', handleResize)

    return () => {
      viewport.removeEventListener('resize', handleResize)
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback(
    (search: string) => {
      if (!search.trim()) {
        return
      }

      const updatedSearches = [search, ...recentSearches.filter((s) => s !== search)].slice(0, 10) // Keep only the 10 most recent searches

      setRecentSearches(updatedSearches)
      localStorage.setItem('immich_recent_searches', JSON.stringify(updatedSearches))
    },
    [recentSearches],
  )

  // Handle search
  const handleSearch = useCallback(
    async (submittedQuery: string) => {
      if (!submittedQuery.trim()) {
        return
      }

      // Check if user is authenticated
      if (!isAuthenticated) {
        setError('You must be logged in to search. Please log in and try again.')
        return
      }

      // Check if API key is set
      if (!apiKey) {
        setError('API key is not set. Please log in again.')
        return
      }

      try {
        setIsSearching(true)
        setError(null)

        saveRecentSearch(submittedQuery)

        // Use the updated search method with options
        const results = await apiService.search(submittedQuery, {
          page: 1,
          size: 100,
          withArchived: false,
        })
        setSearchResults(results)
      } catch (err) {
        setError(
          `Failed to search. Please try again. Error: ${err instanceof Error ? err.message : String(err)}`,
        )
      } finally {
        setIsSearching(false)
      }
    },
    [apiKey, isAuthenticated, saveRecentSearch],
  )

  const searchAutoSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle search input change
  const handleInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    setQuery(target.value)

    if (searchAutoSubmitTimeoutRef.current) {
      clearTimeout(searchAutoSubmitTimeoutRef.current)
    }

    searchAutoSubmitTimeoutRef.current = setTimeout(() => {
      handleSearch(target.value)
    }, 500)
  }

  // Handle search form submission
  const handleSubmit = (e: Event) => {
    e.preventDefault()
    handleSearch(query)
  }

  // Handle recent search click
  const handleRecentSearchClick = (search: string) => {
    setQuery(search)
    setTimeout(() => handleSearch(search), 0)
  }

  // Handle clear recent searches
  const handleClearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('immich_recent_searches')
  }

  // Handle album click
  const handleAlbumClick = (albumId: string) => {
    route(`/albums/${albumId}`)
  }

  // Handle person click
  const handlePersonClick = (personId: string) => {
    route(`/people/${personId}`)
  }

  // Handle asset click
  const handleAssetClick = (asset: Asset, info: { position: ThumbnailPosition | null }) => {
    // Store the thumbnail position for the selected asset
    setSelectedThumbnailPosition(info.position)
    setSelectedAsset(asset)
  }

  // Close photo viewer
  const handleCloseViewer = () => {
    setSelectedAsset(null)
    // Reset the selected thumbnail position
    setSelectedThumbnailPosition(null)
  }

  // Base offset using CSS variables (tab bar + spacing + safe area)
  const baseOffset = 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))'

  // Always use CSS max() to ensure we never go below the base offset
  // This keeps the CSS expression structure consistent and lets the browser handle the comparison
  const formBottom = `max(${keyboardHeight}px + var(--spacing-md), ${baseOffset})`

  // Whether to show the search input UI (initial state, no results, no search in progress)
  const showSearchUI = !searchResults && !isSearching

  return (
    <div class="ios-page">
      {/* Only show header when there are search results */}
      {!showSearchUI && <Header title="Search" />}

      <div class="ios-content" style={{ overflow: showSearchUI ? 'hidden' : undefined }}>
        {/* Fixed bottom search form - only shown in search UI mode */}
        {
          <form
            onSubmit={handleSubmit}
            class="search-input-bar"
            style={{
              position: 'fixed',
              bottom: formBottom,
              left: 0,
              right: 0,
              padding:
                '0 max(var(--spacing-lg), env(safe-area-inset-right)) 0 max(var(--spacing-lg), env(safe-area-inset-left))',
              display: 'flex',
              flexDirection: 'column-reverse',
              alignItems: 'stretch',
              justifyContent: 'flex-end',
              gap: 'var(--spacing-md)',
              zIndex: 'var(--z-index-tabbar)',
            }}
          >
            <div
              class="liquid-glass"
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 'var(--search-input-height)',
                padding: '0 var(--spacing-md)',
                gap: 'var(--spacing-sm)',
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
                  d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                  stroke="var(--color-gray)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 21L16.65 16.65"
                  stroke="var(--color-gray)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>

              <style scoped={true}>
                {`
              input::placeholder {
                color: var(--color-gray);
              }
              `}
              </style>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onInput={handleInputChange}
                placeholder="Search photos, albums, people..."
                style={{
                  height: '24px',
                  flex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: 'var(--font-size-md)',
                  outline: 'none',
                  color: 'var(--color-text)',
                }}
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--color-gray)',
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
                      d="M18 6L6 18"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M6 6L18 18"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Recent searches - positioned above search input, grows from bottom */}
            {showSearchUI && recentSearches.length > 0 && (
              <div
                class="recent-searches"
                style={{
                  maxHeight: '50vh',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-sm)',
                    padding: '0 var(--spacing-sm)',
                  }}
                >
                  <h2
                    style={{
                      fontSize: 'var(--font-size-md)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-gray)',
                    }}
                  >
                    Recent
                  </h2>

                  <button
                    onClick={handleClearRecentSearches}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: 'var(--font-size-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>

                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {recentSearches.map((search, index) => (
                    <li
                      key={index}
                      onClick={() => handleRecentSearchClick(search)}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
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
                          d="M12 8V12L15 15"
                          stroke="var(--color-gray)"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <path
                          d="M3.05 11a9 9 0 1 1 .5 4"
                          stroke="var(--color-gray)"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      <span>{search}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        }

        {/* Loading indicator */}
        {isSearching && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--spacing-lg)',
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
                marginRight: 'var(--spacing-md)',
              }}
            />
            <p>Searching...</p>

            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              color: 'var(--color-danger)',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}

        {/* Search results */}
        {searchResults && !isSearching && (
          <div class="search-results">
            {/* Albums results */}
            {searchResults.albums && searchResults.albums.length > 0 && (
              <div class="search-section">
                <h2
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    marginBottom: 'var(--spacing-md)',
                  }}
                >
                  Albums
                </h2>

                <div
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: 'var(--spacing-md)',
                    paddingBottom: 'var(--spacing-md)',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {searchResults.albums.map((album) => (
                    <div
                      key={album.id}
                      class="album-card"
                      onClick={() => handleAlbumClick(album.id)}
                      style={{
                        width: '150px',
                        flexShrink: 0,
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
                          backgroundColor: 'var(--color-gray-light)',
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
                      </div>

                      <div style={{ padding: 'var(--spacing-sm)' }}>
                        <h3
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-semibold)',
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
                          {album.assetCount} {album.assetCount === 1 ? 'photo' : 'photos'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* People results */}
            {searchResults.people && searchResults.people.length > 0 && (
              <div class="search-section" style={{ marginTop: 'var(--spacing-sm)' }}>
                <h2
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    marginBottom: 'var(--spacing-md)',
                  }}
                >
                  People
                </h2>

                <div
                  style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: 'var(--spacing-md)',
                    paddingBottom: 'var(--spacing-md)',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {searchResults.people.map((person) => (
                    <div
                      key={person.id}
                      class="person-card"
                      onClick={() => handlePersonClick(person.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        width: '80px',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: '70px',
                          height: '70px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          backgroundColor: 'var(--color-gray-light)',
                          marginBottom: 'var(--spacing-xs)',
                        }}
                      >
                        {person.thumbnailPath && (
                          <img
                            src={apiService.getPersonThumbnailUrl(person.id)}
                            alt={person.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            loading="lazy"
                          />
                        )}
                      </div>

                      <h3
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 'var(--font-weight-medium)',
                          textAlign: 'center',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {person.name}
                      </h3>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photos results */}
            {searchResults.assets && searchResults.assets.length > 0 && (
              <div
                class="search-section"
                style={{
                  marginTop: 'var(--spacing-sm)',
                }}
              >
                <h2
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-semibold)',
                    marginBottom: 'var(--spacing-md)',
                    paddingLeft: 'var(--spacing-md)',
                    paddingRight: 'var(--spacing-md)',
                  }}
                >
                  Photos
                </h2>

                <VirtualizedTimeline
                  assets={searchResults.assets}
                  showDateHeaders={false}
                  includeHeaderOffset={false}
                  onAssetOpenRequest={handleAssetClick}
                  onThumbnailPositionGetterReady={setGetThumbnailPosition}
                  anchorAssetId={selectedAsset?.id}
                />
              </div>
            )}

            {/* No results */}
            {(!searchResults.albums || searchResults.albums.length === 0) &&
              (!searchResults.people || searchResults.people.length === 0) &&
              (!searchResults.assets || searchResults.assets.length === 0) && (
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
                  <p style={{ marginTop: 'var(--spacing-md)' }}>No results found for "{query}"</p>
                </div>
              )}
          </div>
        )}

        {/* Empty state - when in search UI mode with no recent searches */}
        {showSearchUI && recentSearches.length === 0 && (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              // Position above the search form
              bottom: `calc(max(${keyboardHeight}px, ${baseOffset}) + var(--tabbar-height) + var(--spacing-lg))`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: 'var(--color-gray)',
              padding: 'var(--spacing-lg)',
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
            <p style={{ marginTop: 'var(--spacing-md)' }}>Search for photos, albums, or people</p>
          </div>
        )}
      </div>

      {/* Photo viewer */}
      {selectedAsset && searchResults?.assets && (
        <PhotoViewer
          asset={selectedAsset}
          assets={searchResults.assets}
          onClose={handleCloseViewer}
          thumbnailPosition={selectedThumbnailPosition}
          getThumbnailPosition={getThumbnailPosition ?? undefined}
          onAssetChange={setSelectedAsset}
        />
      )}
    </div>
  )
}
