/**
 * Normalize a string for fuzzy matching by:
 * 1. Converting to lowercase
 * 2. Removing diacritics (accents) so "café" matches "cafe"
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Simple fuzzy search implementation for filtering lists by name.
 * Matches if all characters in the query appear in order in the target string.
 * Diacritics are treated as optional (e.g., "cafe" matches "café").
 */
export function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  if (!target) return false

  const normalizedQuery = normalizeForSearch(query)
  const normalizedTarget = normalizeForSearch(target)

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
 * Diacritics are treated as optional (e.g., "cafe" matches "café").
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  if (!target) return -1

  const normalizedQuery = normalizeForSearch(query)
  const normalizedTarget = normalizeForSearch(target)

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
export function fuzzyFilter<T>(items: T[], query: string, getName: (item: T) => string): T[] {
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

/**
 * Build a mapping from normalized string indices to original string indices.
 * When NFD normalization splits "é" into "e" + combining accent, we need to
 * know which original character each normalized character came from.
 */
function buildIndexMapping(original: string): number[] {
  const mapping: number[] = []
  const normalized = original.toLowerCase().normalize('NFD')

  let normalizedIdx = 0
  for (let origIdx = 0; origIdx < original.length; origIdx++) {
    // Get the NFD form of this single character
    const charNormalized = original[origIdx].toLowerCase().normalize('NFD')
    for (let j = 0; j < charNormalized.length; j++) {
      if (normalizedIdx < normalized.length) {
        mapping[normalizedIdx] = origIdx
        normalizedIdx++
      }
    }
  }

  return mapping
}

/**
 * Get the indices of matched characters for highlighting.
 * Returns an array of indices in the target string that matched the query.
 * Diacritics are treated as optional (e.g., "cafe" matches "café").
 */
export function getMatchIndices(query: string, target: string): number[] {
  if (!query || !target) return []

  const normalizedQuery = normalizeForSearch(query)
  const normalizedTarget = normalizeForSearch(target)

  // Build mapping from normalized indices to original indices
  const indexMapping = buildIndexMapping(target)

  // Check for substring match first (most common case)
  const substringIndex = normalizedTarget.indexOf(normalizedQuery)
  if (substringIndex !== -1) {
    // Map normalized indices back to original indices, deduplicating
    const originalIndices = new Set<number>()
    for (let i = 0; i < normalizedQuery.length; i++) {
      const normalizedIdx = substringIndex + i
      if (normalizedIdx < indexMapping.length) {
        originalIndices.add(indexMapping[normalizedIdx])
      }
    }
    return Array.from(originalIndices).sort((a, b) => a - b)
  }

  // Fuzzy match: find character positions
  const originalIndices = new Set<number>()
  let queryIndex = 0

  for (let i = 0; i < normalizedTarget.length && queryIndex < normalizedQuery.length; i++) {
    if (normalizedTarget[i] === normalizedQuery[queryIndex]) {
      if (i < indexMapping.length) {
        originalIndices.add(indexMapping[i])
      }
      queryIndex++
    }
  }

  // Only return indices if all query characters were found
  if (queryIndex === normalizedQuery.length) {
    return Array.from(originalIndices).sort((a, b) => a - b)
  }

  return []
}
