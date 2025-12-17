import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { useAuth } from '../contexts/AuthContext'
import { type SearchResult, apiService } from '../services/api'

const RECENT_SEARCHES_KEY = 'immich_recent_searches'
const MAX_RECENT_SEARCHES = 10
const AUTO_SUBMIT_DELAY = 500

interface UseTimelineSearchResult {
  query: string
  setQuery: (query: string) => void
  isSearching: boolean
  searchResults: SearchResult | null
  error: string | null
  recentSearches: string[]
  clearRecentSearches: () => void
  handleRecentSearchClick: (search: string) => void
  clearSearch: () => void
}

export function useTimelineSearch(): UseTimelineSearchResult {
  const [query, setQueryState] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const { apiKey, isAuthenticated } = useAuth()
  const autoSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const savedSearches = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches))
    }
  }, [])

  // Save recent search to localStorage
  const saveRecentSearch = useCallback(
    (search: string) => {
      if (!search.trim()) return

      const updatedSearches = [search, ...recentSearches.filter((s) => s !== search)].slice(
        0,
        MAX_RECENT_SEARCHES,
      )

      setRecentSearches(updatedSearches)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updatedSearches))
    },
    [recentSearches],
  )

  // Perform the search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchResults(null)
        return
      }

      if (!isAuthenticated) {
        setError('You must be logged in to search.')
        return
      }

      if (!apiKey) {
        setError('API key is not set. Please log in again.')
        return
      }

      try {
        setIsSearching(true)
        setError(null)
        saveRecentSearch(searchQuery)

        const results = await apiService.search(searchQuery, {
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

  // Set query with auto-submit
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery)

      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current)
      }

      if (!newQuery.trim()) {
        setSearchResults(null)
        return
      }

      autoSubmitTimeoutRef.current = setTimeout(() => {
        performSearch(newQuery)
      }, AUTO_SUBMIT_DELAY)
    },
    [performSearch],
  )

  // Handle recent search click
  const handleRecentSearchClick = useCallback(
    (search: string) => {
      setQueryState(search)
      performSearch(search)
    },
    [performSearch],
  )

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }, [])

  // Clear search completely
  const clearSearch = useCallback(() => {
    setQueryState('')
    setSearchResults(null)
    setError(null)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current)
      }
    }
  }, [])

  return {
    query,
    setQuery,
    isSearching,
    searchResults,
    error,
    recentSearches,
    clearRecentSearches,
    handleRecentSearchClick,
    clearSearch,
  }
}

