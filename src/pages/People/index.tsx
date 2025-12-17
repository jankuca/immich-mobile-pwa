import { useMemo, useState } from 'preact/hooks'
import { Header } from '../../components/common/Header'
import { SectionPill } from '../../components/common/SectionPill'
import { HighlightedText } from '../../components/search/HighlightedText'
import { SearchInput } from '../../components/search/SearchInput'
import { SearchInputWrapper } from '../../components/search/SearchInputWrapper'
import { useHashLocation } from '../../contexts/HashLocationContext'
import { usePeople } from '../../hooks/usePeople'
import type { Person } from '../../services/api'
import { apiService } from '../../services/api'
import { fuzzyFilter } from '../../utils/fuzzySearch'

const SEARCH_RESULT_AVATAR_SIZE = 44

type SortMode = 'name' | 'photoCount'

export function People() {
  const { people, isLoading, error } = usePeople()
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { route } = useHashLocation()

  // Navigate to person detail
  const handlePersonClick = (personId: string) => {
    route(`/people/${personId}`)
  }

  // Filter out people without names and hidden people, then apply search filter
  const { sortedPeople, peopleByLetter, sortedLetters, hasSearchResults, isSearching } =
    useMemo(() => {
      // Filter out hidden people and those without names
      const basePeople = people.filter(
        (person: Person) => !person.isHidden && person.name.trim() !== '',
      )

      const hasQuery = searchQuery.trim().length > 0

      // When searching, return fuzzy-filtered results sorted by relevance (no grouping)
      if (hasQuery) {
        const filtered = fuzzyFilter(basePeople, searchQuery, (person: Person) => person.name)
        return {
          sortedPeople: filtered,
          peopleByLetter: {} as Record<string, Person[]>,
          sortedLetters: [] as string[],
          hasSearchResults: filtered.length > 0,
          isSearching: true,
        }
      }

      // No search query - apply normal sorting and grouping
      if (sortMode === 'photoCount') {
        // Sort by photo count (API order) - no grouping
        return {
          sortedPeople: basePeople,
          peopleByLetter: {} as Record<string, Person[]>,
          sortedLetters: [] as string[],
          hasSearchResults: basePeople.length > 0,
          isSearching: false,
        }
      }

      // Sort by name using locale-aware comparison
      const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
      const sortedByName = [...basePeople].sort((a, b) => collator.compare(a.name, b.name))
      const byLetter: Record<string, Person[]> = {}

      for (const person of sortedByName) {
        const firstLetter = person.name.charAt(0).toLocaleUpperCase()
        if (!byLetter[firstLetter]) {
          byLetter[firstLetter] = []
        }
        byLetter[firstLetter].push(person)
      }

      // Sort letter sections using locale-aware comparison
      const letters = Object.keys(byLetter).sort((a, b) => collator.compare(a, b))
      return {
        sortedPeople: sortedByName,
        peopleByLetter: byLetter,
        sortedLetters: letters,
        hasSearchResults: sortedByName.length > 0,
        isSearching: false,
      }
    }, [people, sortMode, searchQuery])

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode)
    setShowSortDropdown(false)
  }

  const renderPersonCard = (person: Person) => (
    <button
      key={person.id}
      type="button"
      class="person-card"
      onClick={() => handlePersonClick(person.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        minWidth: 0,
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'inherit',
        font: 'inherit',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '80px',
          aspectRatio: '1',
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
          fontSize: 'var(--font-size-sm)',
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
    </button>
  )

  const renderPersonSearchResult = (person: Person) => (
    <button
      key={person.id}
      type="button"
      onClick={() => handlePersonClick(person.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-sm)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        backgroundColor: 'var(--color-light)',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: SEARCH_RESULT_AVATAR_SIZE,
          height: SEARCH_RESULT_AVATAR_SIZE,
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--color-gray-light)',
          flexShrink: 0,
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

      {/* Name */}
      <HighlightedText
        text={person.name}
        query={searchQuery}
        style={{
          color: 'var(--color-dark)',
          fontSize: 'var(--font-size-md)',
          fontWeight: 'var(--font-weight-medium)',
        }}
      />
    </button>
  )

  const renderContent = () => {
    if (isLoading) {
      return (
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
          <p style={{ marginTop: 'var(--spacing-md)' }}>Loading people...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )
    }

    if (error) {
      return (
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
          <p style={{ textAlign: 'center' }}>{error}</p>
          <button
            type="button"
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
      )
    }

    if (!hasSearchResults && searchQuery.trim()) {
      return (
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
          <p style={{ marginTop: 'var(--spacing-md)' }}>No people found for "{searchQuery}"</p>
        </div>
      )
    }

    if (sortedPeople.length === 0) {
      return (
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
          <p style={{ textAlign: 'center' }}>No people found</p>
        </div>
      )
    }

    // Search mode - list sorted by relevance
    if (isSearching) {
      return (
        <div
          style={{
            padding: 'var(--spacing-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
          }}
        >
          {sortedPeople.map(renderPersonSearchResult)}
        </div>
      )
    }

    // Photo count mode - flat grid
    if (sortMode === 'photoCount') {
      return (
        <div style={{ padding: 'var(--spacing-md)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--spacing-md)',
            }}
          >
            {sortedPeople.map(renderPersonCard)}
          </div>
        </div>
      )
    }

    // Name mode - grouped by letter with sticky section pills
    return (
      <div style={{ padding: 'var(--spacing-md)', paddingTop: 0 }}>
        {sortedLetters.map((letter) => (
          <div key={letter} class="people-letter-section">
            <SectionPill sticky={true}>{letter}</SectionPill>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--spacing-md)',
              }}
            >
              {peopleByLetter[letter]?.map(renderPersonCard)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const sortIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 6h18M6 12h12M9 18h6"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )

  return (
    <div class="ios-page">
      <Header
        title="People"
        rightAction={{
          icon: sortIcon,
          onClick: () => setShowSortDropdown(!showSortDropdown),
        }}
      />

      {/* Search Input */}
      <SearchInputWrapper>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search people..." />
      </SearchInputWrapper>

      {/* Sort dropdown */}
      {showSortDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--header-height) + env(safe-area-inset-top, 0px))',
            right: 'var(--spacing-md)',
            backgroundColor: 'var(--color-background)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 'var(--z-index-header)',
            overflow: 'hidden',
            border: '1px solid rgba(var(--color-text-rgb), 0.1)',
          }}
        >
          <button
            type="button"
            onClick={() => handleSortChange('name')}
            style={{
              display: 'block',
              width: '100%',
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: sortMode === 'name' ? 'rgba(var(--color-text-rgb), 0.05)' : 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-sm)',
              fontWeight:
                sortMode === 'name' ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)',
            }}
          >
            Sort by Name
          </button>
          <button
            type="button"
            onClick={() => handleSortChange('photoCount')}
            style={{
              display: 'block',
              width: '100%',
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: sortMode === 'photoCount' ? 'rgba(var(--color-text-rgb), 0.05)' : 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-sm)',
              fontWeight:
                sortMode === 'photoCount'
                  ? 'var(--font-weight-semibold)'
                  : 'var(--font-weight-regular)',
            }}
          >
            Sort by Photo Count
          </button>
        </div>
      )}

      <div class="ios-content">{renderContent()}</div>
    </div>
  )
}
