import axios, { isAxiosError, type AxiosInstance } from 'axios'

// Types for Immich API responses
export interface TimeBucketAsset {
  /** city name extracted from EXIF GPS data */
  city: string | null
  /** country name extracted from EXIF GPS data */
  country: string | null
  /** video duration in HH:MM:SS format (null for images) */
  duration: string | null
  /** file creation timestamp in UTC (ISO 8601 format, without timezone) */
  fileCreatedAt: string
  /** asset ID */
  id: string
  /** whether the asset is favorited */
  isFavorite: boolean
  /** whether the asset is an image (false for videos) */
  isImage: boolean
  /** whether the asset is in the trash */
  isTrashed: boolean
  /** latitude coordinate extracted from EXIF GPS data */
  latitude: number | null
  /** live photo video asset ID (null for non-live photos) */
  livePhotoVideoId: string | null
  /** UTC offset hours at the time the photo was taken. Positive values are east of UTC, negative values are west of UTC. Values may be fractional (e.g., 5.5 for +05:30, -9.75 for -09:45). Applying this offset to 'fileCreatedAt' will give you the time the photo was taken from the photographer's perspective. */
  localOffsetHours: number
  /** longitude coordinate extracted from EXIF GPS data */
  longitude: number | null
  /** owner ID for the asset */
  ownerId: string
  /** projection type for 360° content (e.g., "EQUIRECTANGULAR", "CUBEFACE", "CYLINDRICAL") */
  projectionType: string | null
  /** aspect ratio (width/height) for the asset */
  ratio: number
  /** stack information as [stackId, assetCount] tuples (null for non-stacked assets) */
  stack: string | null
  /** BlurHash string for generating the asset preview (base64 encoded) */
  thumbhash: string | null
  /** visibility status for the asset (e.g., ARCHIVE, TIMELINE, HIDDEN, LOCKED) */
  visibility: 'archive' | 'timeline' | 'hidden' | 'locked'
}

export interface AssetTimelineItem {
  id: string
  ownerId: string
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER'
  fileCreatedAt: string
  /** The timeBucket this asset belongs to (used for grouping, based on localDateTime) */
  timeBucket?: string
  thumbhash: string | null
  isFavorite: boolean
  isTrashed: boolean
  duration?: string | null
  exifInfo?: {
    latitude?: number | null
    longitude?: number | null
    city?: string | null
    country?: string | null
  }
}

export interface Asset extends TimeBucketAsset {
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER'
  deviceAssetId: string
  deviceId: string
  originalPath: string
  originalFileName: string
  fileModifiedAt: string
  localDateTime: string
  isArchived: boolean
  exifInfo?: NonNullable<AssetTimelineItem['exifInfo']> & {
    dateTimeOriginal?: string | null
    exifImageWidth?: number | null
    exifImageHeight?: number | null
    state?: string | null
    description?: string | null
    make?: string | null
    model?: string | null
    lensModel?: string | null
    fNumber?: string | null
    exposureTime?: string | null
    iso?: string | null
    focalLength?: string | null
    // Add other exif properties as needed
  }
  people: Array<{
    birthDate: string | null
    color: string
    faces: Array<{
      boundingBoxX1: number
      boundingBoxX2: number
      boundingBoxY1: number
      boundingBoxY2: number
      id: string
      imageHeight: number
      imageWidth: number
      sourceType: 'machine-learning' | 'exif' | 'manual'
    }>
    id: string
    isFavorite: boolean
    isHidden: boolean
    name: string
    thumbnailPath: string
    updatedAt: string
  }>
}

export type AssetOrder = 'asc' | 'desc'

export interface Album {
  id: string
  albumName: string
  description: string
  createdAt: string
  updatedAt: string
  ownerId: string
  shared: boolean
  assetCount: number
  albumThumbnailAssetId: string
  startDate?: string
  endDate?: string
  order?: AssetOrder
}

export interface Person {
  id: string
  name: string
  thumbnailPath: string
  isHidden: boolean
  isFavorite?: boolean
  birthDate?: string
}

export interface SearchResult {
  albums?: Album[]
  people?: Person[]
  assets?: Asset[]
}

export type SharedLinkType = 'ALBUM' | 'INDIVIDUAL'

export interface SharedLink {
  id: string
  key: string
  userId: string
  type: SharedLinkType
  createdAt: string
  expiresAt: string | null
  description: string | null
  password: string | null
  slug: string | null
  token: string | null
  allowDownload: boolean
  allowUpload: boolean
  showMetadata: boolean
  album?: Album
  assets: Asset[]
}

export interface SharedLinkCreateParams {
  type: SharedLinkType
  albumId?: string
  assetIds?: string[]
  description?: string | null
  expiresAt?: string | null
  password?: string | null
  slug?: string | null
  allowDownload?: boolean
  allowUpload?: boolean
  showMetadata?: boolean
}

export interface ServerConfig {
  externalDomain: string
  isInitialized: boolean
  isOnboarded: boolean
  loginPageMessage: string
  maintenanceMode: boolean
  mapDarkStyleUrl: string
  mapLightStyleUrl: string
  oauthButtonText: string
  publicUsers: boolean
  trashDays: number
  userDeleteDelay: number
}

class ApiService {
  private api: AxiosInstance
  private baseUrl: string
  private apiKey: string | null = null
  private serverConfig: ServerConfig | null = null

  private fullAssetCache: Record<string, Asset> = {}

  constructor() {
    // Use the proxy URL (Vite will proxy requests to the Immich server)
    this.baseUrl = '/api'

    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      // We don't need withCredentials since we're using API key
      withCredentials: false,
    })

    // Add request interceptor to include API key
    this.api.interceptors.request.use((config) => {
      if (this.apiKey) {
        // Set the API key in the headers for each request
        config.headers['x-api-key'] = this.apiKey
      } else {
        console.warn('No API key set for request:', config.url)
      }

      return config
    })
  }

  // Set API key for authentication
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  // Verify API key by making a test request
  async verifyApiKey(): Promise<boolean> {
    try {
      console.log('Verifying API key...')

      // Try a simple request to the server-info endpoint
      try {
        const response = await this.api.get('/server-info')
        console.log('API key verification successful with server-info:', response.data)
        return true
      } catch (serverInfoError) {
        console.warn('server-info endpoint failed, trying user-info:', serverInfoError)
        // If server-info fails, try user-info
        try {
          const userResponse = await this.api.get('/user/me')
          console.log('API key verification successful with user-info:', userResponse.data)
          return true
        } catch (userError) {
          console.warn('user-info endpoint failed, trying albums:', userError)

          // If user-info fails, try albums
          try {
            const albumsResponse = await this.api.get('/albums')
            console.log('API key verification successful with albums:', albumsResponse.data)
            return true
          } catch (albumsError) {
            console.warn('albums endpoint failed:', albumsError)
            throw albumsError
          }
        }
      }
    } catch (error) {
      console.error('API key verification failed after trying multiple endpoints:', error)

      // Log the request headers for debugging
      console.log('API key being used:', this.apiKey)
      console.log('Base URL:', this.baseUrl)

      return false
    }
  }

  // Timeline
  async getTimeBuckets(params: {
    size: 'DAY' | 'MONTH'
    isFavorite?: boolean
    isArchived?: boolean
    isTrashed?: boolean
    personId?: string
    albumId?: string
    order?: AssetOrder
  }): Promise<{ timeBucket: string; count: number }[]> {
    const response = await this.api.get('/timeline/buckets', { params })
    return response.data
  }

  async getTimeBucket(params: {
    timeBucket: string
    size: 'DAY' | 'MONTH'
    isFavorite?: boolean
    isArchived?: boolean
    isTrashed?: boolean
    personId?: string
    albumId?: string
    order?: AssetOrder
  }): Promise<AssetTimelineItem[]> {
    const response = await this.api.get('/timeline/bucket', {
      params: {
        timeBucket: params.timeBucket,
        size: params.size,
        isFavorite: params.isFavorite,
        isArchived: params.isArchived,
        isTrashed: params.isTrashed,
        personId: params.personId,
        albumId: params.albumId,
        order: params.order,
      },
    })

    // NOTE: Convert response data from {a:[],b:[],c:[]} to [{a,b,c},{a,b,c}]
    const itemIds = response.data.id
    if (!Array.isArray(itemIds)) {
      return []
    }

    const items = itemIds.map(
      (_id, index) =>
        Object.fromEntries(
          Object.entries(response.data).map(([key, values]) => [
            key,
            Array.isArray(values) ? values[index] : null,
          ]),
        ) as TimeBucketAsset,
    )

    // Include the timeBucket with each asset for proper grouping
    // (since fileCreatedAt is UTC but bucket grouping uses localDateTime)
    const bucketDate = params.timeBucket.split('T')[0] ?? params.timeBucket

    return items.map((item) => ({
      id: item.id,
      ownerId: item.ownerId,
      type: item.isImage ? 'IMAGE' : 'VIDEO',
      fileCreatedAt: item.fileCreatedAt,
      timeBucket: bucketDate,
      thumbhash: item.thumbhash,
      isFavorite: item.isFavorite,
      isTrashed: item.isTrashed,
      duration: item.duration,
      exifInfo: {
        latitude: item.latitude,
        longitude: item.longitude,
        city: item.city,
        country: item.country,
      },
    }))
  }

  async getAsset(assetId: string, options: { signal?: AbortSignal } = {}): Promise<Asset> {
    if (this.fullAssetCache[assetId]) {
      return this.fullAssetCache[assetId]
    }

    const response = await this.api.get(`/assets/${assetId}`, options)

    this.fullAssetCache[assetId] = response.data
    setTimeout(
      () => {
        delete this.fullAssetCache[assetId]
      },
      1000 * 60 * 5,
    ) // 30 seconds

    return response.data
  }

  // Albums
  async getAlbums(): Promise<Album[]> {
    const response = await this.api.get('/albums')
    return response.data
  }

  async getAlbum(albumId: string): Promise<Album> {
    const response = await this.api.get(`/albums/${albumId}`)
    return response.data
  }

  async getAlbumAssets(albumId: string): Promise<Asset[]> {
    const response = await this.api.get(`/albums/${albumId}/assets`)
    return response.data
  }

  // People
  async getPeople(params: { withHidden?: boolean } = {}): Promise<{ people: Person[] }> {
    const response = await this.api.get('/people', { params })
    return response.data
  }

  async getPerson(personId: string): Promise<Person> {
    const response = await this.api.get(`/people/${personId}`)
    return response.data
  }

  // Search
  async search(
    query: string,
    options: {
      page?: number
      size?: number
      isArchived?: boolean
      isFavorite?: boolean
      withArchived?: boolean
    } = {},
  ): Promise<SearchResult> {
    // Prepare the request payload
    const payload = {
      query, // Required parameter
      page: options.page || 1,
      size: options.size || 100,
      isArchived: options.isArchived,
      isFavorite: options.isFavorite,
      withArchived: options.withArchived,
    }

    try {
      // Use the searchSmart endpoint with POST request
      const response = await this.api.post('/search/smart', payload)

      // The response format is different from what our app expects
      // We need to transform it to match our SearchResult interface
      const data = response.data

      const result = {
        albums: data.albums?.items || [],
        people: data.people?.items || [],
        assets: data.assets?.items || [],
      }

      return result
    } catch (error) {
      if (isAxiosError(error)) {
        // Log more details about the error
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error response data:', error.response.data)
          console.error('Error response status:', error.response.status)
          console.error('Error response headers:', error.response.headers)
        } else if (error.request) {
          // The request was made but no response was received
          console.error('Error request:', error.request)
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message)
        }
      }

      throw error
    }
  }

  // Asset URLs
  getAssetThumbnailUrl(assetId: string, format: 'webp' | 'jpeg' = 'webp'): string {
    // Include the API key in the URL for direct image requests
    // Use the current origin to ensure the URL works when accessed from different origins
    const origin = window.location.origin
    return `${origin}/api/assets/${assetId}/thumbnail?format=${format}&key=${this.apiKey}`
  }

  getAssetUrl(assetId: string): string {
    // Include the API key in the URL for direct image requests
    // Use the current origin to ensure the URL works when accessed from different origins
    const origin = window.location.origin
    return `${origin}/api/assets/${assetId}/original?key=${this.apiKey}`
  }

  getPersonThumbnailUrl(personId: string): string {
    // Include the API key in the URL for direct image requests
    // Use the current origin to ensure the URL works when accessed from different origins
    const origin = window.location.origin
    return `${origin}/api/people/${personId}/thumbnail?key=${this.apiKey}`
  }

  // Server Config
  async getServerConfig(): Promise<ServerConfig> {
    if (this.serverConfig) {
      return this.serverConfig
    }
    const response = await this.api.get('/server/config')
    this.serverConfig = response.data
    return response.data
  }

  // Shared Links
  async getSharedLinks(albumId?: string): Promise<SharedLink[]> {
    const params = albumId ? { albumId } : {}
    const response = await this.api.get('/shared-links', { params })
    return response.data
  }

  async createSharedLink(params: SharedLinkCreateParams): Promise<SharedLink> {
    const response = await this.api.post('/shared-links', params)
    return response.data
  }

  async deleteSharedLink(linkId: string): Promise<void> {
    await this.api.delete(`/shared-links/${linkId}`)
  }

  async getSharedLinkUrl(link: SharedLink): Promise<string> {
    const config = await this.getServerConfig()
    const baseUrl = config.externalDomain || window.location.origin
    if (link.slug) {
      return `${baseUrl}/share/${link.slug}`
    }
    return `${baseUrl}/share/${link.key}`
  }
}

// Create a singleton instance
export const apiService = new ApiService()
