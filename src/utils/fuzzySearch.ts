/**
 * Simple fuzzy search implementation for filtering lists by name.
 * Matches if all characters in the query appear in order in the target string.
 */
export function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  if (!target) return false

  const normalizedQuery = query.toLowerCase()
  const normalizedTarget = target.toLowerCase()

  // Simple contains check first (most common case)
  if (normalizedTarget.includes(normalizedQuery)) {
    return true
  }

  // Fuzzy match: all query characters must appear in order
  let queryIndex = 0
  for (let i = 0; i < normalizedTarget.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedTarget[i] === normalizedQuery[queryIndex]) {
      queryIndex++
    }
  }

  return queryIndex === normalizedQuery.length
}

/**
 * Calculate a match score for sorting results.
 * Higher scores indicate better matches.
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  if (!target) return -1

  const normalizedQuery = query.toLowerCase()
  const normalizedTarget = target.toLowerCase()

  // Exact match gets highest score
  if (normalizedTarget === normalizedQuery) {
    return 100
  }

  // Starts with query gets high score
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return 90
  }

  // Contains query as substring
  const containsIndex = normalizedTarget.indexOf(normalizedQuery)
  if (containsIndex !== -1) {
    // Earlier matches score higher
    return 80 - containsIndex
  }

  // Word boundary match (query matches start of a word)
  const words = normalizedTarget.split(/\s+/)
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(normalizedQuery)) {
      return 70 - i * 5
    }
  }

  // Fuzzy match score based on character positions
  let queryIndex = 0
  let score = 0
  let lastMatchIndex = -1

  for (let i = 0; i < normalizedTarget.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedTarget[i] === normalizedQuery[queryIndex]) {
      // Consecutive matches score higher
      if (lastMatchIndex === i - 1) {
        score += 5
      } else {
        score += 1
      }
      lastMatchIndex = i
      queryIndex++
    }
  }

  // Return 0 if not all characters matched
  if (queryIndex !== normalizedQuery.length) {
    return -1
  }

  return score
}

/**
 * Filter and sort an array of items by fuzzy matching a name field.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getName: (item: T) => string,
): T[] {
  if (!query.trim()) {
    return items
  }

  const scored = items
    .map((item) => ({
      item,
      score: fuzzyScore(query, getName(item)),
    }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)

  return scored.map(({ item }) => item)
}

