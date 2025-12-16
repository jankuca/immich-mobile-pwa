import { useCallback, useEffect, useState } from 'preact/hooks'
import { type Person, apiService } from '../services/api'

interface UsePeopleResult {
  people: Person[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function usePeople(): UsePeopleResult {
  const [people, setPeople] = useState<Person[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPeople = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data = await apiService.getPeople()
      setPeople(data.people || [])
    } catch (_err) {
      setError('Failed to load people. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPeople()
  }, [fetchPeople])

  return {
    people,
    isLoading,
    error,
    refetch: fetchPeople,
  }
}
