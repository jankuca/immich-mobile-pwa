import axios, { AxiosInstance } from 'axios';

// Types for Immich API responses
export interface Asset {
  id: string;
  deviceAssetId: string;
  ownerId: string;
  deviceId: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'OTHER';
  originalPath: string;
  originalFileName: string;
  fileCreatedAt: string;
  fileModifiedAt: string;
  localDateTime: string;
  thumbhash: string;
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  duration?: string;
  exifInfo?: {
    dateTimeOriginal?: string;
    exifImageWidth?: number;
    exifImageHeight?: number;
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    country?: string;
    description?: string;
    // Add other exif properties as needed
  };
}

export interface TimeBucket {
  [key: string]: Asset[];
}

export interface Album {
  id: string;
  albumName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  shared: boolean;
  assetCount: number;
  albumThumbnailAssetId: string;
  startDate?: string;
  endDate?: string;
}

export interface Person {
  id: string;
  name: string;
  thumbnailPath: string;
  isHidden: boolean;
  isFavorite?: boolean;
  birthDate?: string;
}

export interface SearchResult {
  albums?: Album[];
  people?: Person[];
  assets?: Asset[];
}

class ApiService {
  private api: AxiosInstance;
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor() {
    // Use the proxy URL (Vite will proxy requests to the Immich server)
    this.baseUrl = '/api';

    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      // We don't need withCredentials since we're using API key
      withCredentials: false,
    });

    // Add request interceptor to include API key
    this.api.interceptors.request.use((config) => {
      if (this.apiKey) {
        // Set the API key in the headers for each request
        config.headers['x-api-key'] = this.apiKey;

        // Log the headers for debugging (only in development)
        if (process.env.NODE_ENV !== 'production') {
          console.log('Request headers:', config.headers);
          console.log('Request URL:', config.url);
        }
      } else {
        console.warn('No API key set for request:', config.url);
      }
      return config;
    });
  }

  // Set API key for authentication
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  // Verify API key by making a test request
  async verifyApiKey(): Promise<boolean> {
    try {
      console.log('Verifying API key...');

      // Try a simple request to the server-info endpoint
      try {
        const response = await this.api.get('/server-info');
        console.log('API key verification successful with server-info:', response.data);
        return true;
      } catch (serverInfoError) {
        console.warn('server-info endpoint failed, trying user-info:', serverInfoError);

        // If server-info fails, try user-info
        try {
          const userResponse = await this.api.get('/user/me');
          console.log('API key verification successful with user-info:', userResponse.data);
          return true;
        } catch (userError) {
          console.warn('user-info endpoint failed, trying albums:', userError);

          // If user-info fails, try albums
          try {
            const albumsResponse = await this.api.get('/albums');
            console.log('API key verification successful with albums:', albumsResponse.data);
            return true;
          } catch (albumsError) {
            console.warn('albums endpoint failed:', albumsError);
            throw albumsError;
          }
        }
      }
    } catch (error) {
      console.error('API key verification failed after trying multiple endpoints:', error);

      // Log the request headers for debugging
      console.log('API key being used:', this.apiKey);
      console.log('Base URL:', this.baseUrl);

      return false;
    }
  }

  // Timeline
  async getTimeBuckets(params: {
    size: 'DAY' | 'MONTH';
    isFavorite?: boolean;
    isArchived?: boolean;
    isTrashed?: boolean;
    personId?: string;
    albumId?: string;
  }): Promise<{ timeBucket: string; count: number }[]> {
    // Use the correct endpoint for getting time buckets
    console.log('Fetching time buckets with params:', params);
    const response = await this.api.get('/timeline/buckets', { params });
    console.log('Time buckets response:', response.data);
    return response.data;
  }

  async getTimeBucket(params: {
    timeBucket: string;
    size: 'DAY' | 'MONTH';
    isFavorite?: boolean;
    isArchived?: boolean;
    isTrashed?: boolean;
    personId?: string;
    albumId?: string;
  }): Promise<Asset[]> {
    // Use the correct endpoint for getting assets in a time bucket
    console.log('Fetching time bucket with params:', params);
    const response = await this.api.get(`/timeline/bucket`, {
      params: {
        timeBucket: params.timeBucket,
        size: params.size,
        isFavorite: params.isFavorite,
        isArchived: params.isArchived,
        isTrashed: params.isTrashed,
        personId: params.personId,
        albumId: params.albumId,
      }
    });
    console.log('Time bucket response:', response.data);
    return response.data;
  }

  // Albums
  async getAlbums(): Promise<Album[]> {
    const response = await this.api.get('/albums');
    return response.data;
  }

  async getAlbum(albumId: string): Promise<Album> {
    const response = await this.api.get(`/albums/${albumId}`);
    return response.data;
  }

  async getAlbumAssets(albumId: string): Promise<Asset[]> {
    const response = await this.api.get(`/albums/${albumId}/assets`);
    return response.data;
  }

  // People
  async getPeople(params: { withHidden?: boolean } = {}): Promise<{ people: Person[] }> {
    const response = await this.api.get('/people', { params });
    return response.data;
  }

  async getPerson(personId: string): Promise<Person> {
    const response = await this.api.get(`/people/${personId}`);
    return response.data;
  }

  // Search
  async search(query: string, options: {
    page?: number;
    size?: number;
    isArchived?: boolean;
    isFavorite?: boolean;
    withArchived?: boolean;
  } = {}): Promise<SearchResult> {
    // Log the API key for debugging
    console.log('Using API key for search:', this.apiKey ? 'API key is set' : 'No API key');

    // Prepare the request payload
    const payload = {
      query, // Required parameter
      page: options.page || 1,
      size: options.size || 100,
      isArchived: options.isArchived,
      isFavorite: options.isFavorite,
      withArchived: options.withArchived
    };

    console.log('Search payload:', payload);

    try {
      // Use the searchSmart endpoint with POST request
      const response = await this.api.post('/search/smart', payload);

      console.log('Search response status:', response.status);
      console.log('Search response data:', response.data);

      // The response format is different from what our app expects
      // We need to transform it to match our SearchResult interface
      const data = response.data;

      const result = {
        albums: data.albums?.items || [],
        people: data.people?.items || [],
        assets: data.assets?.items || []
      };

      console.log('Transformed search result:', result);

      return result;
    } catch (error) {
      console.error('Search API error:', error);

      // Log more details about the error
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('Error request:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', error.message);
      }

      throw error;
    }
  }

  // Asset URLs
  getAssetThumbnailUrl(assetId: string, format: 'webp' | 'jpeg' = 'webp'): string {
    // Include the API key in the URL for direct image requests
    // Use the current origin to ensure the URL works when accessed from different origins
    const origin = window.location.origin;
    return `${origin}/api/assets/${assetId}/thumbnail?format=${format}&key=${this.apiKey}`;
  }

  getAssetUrl(assetId: string): string {
    // Include the API key in the URL for direct image requests
    // Use the current origin to ensure the URL works when accessed from different origins
    const origin = window.location.origin;
    return `${origin}/api/assets/${assetId}/original?key=${this.apiKey}`;
  }

  getPersonThumbnailUrl(personId: string): string {
    // Include the API key in the URL for direct image requests
    // Use the current origin to ensure the URL works when accessed from different origins
    const origin = window.location.origin;
    return `${origin}/api/people/${personId}/thumbnail?key=${this.apiKey}`;
  }
}

// Create a singleton instance
const apiService = new ApiService();

export default apiService;
