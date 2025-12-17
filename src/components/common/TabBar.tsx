import { useHashLocation } from '../../contexts/HashLocationContext'

export const TabBar = () => {
  const { url, route } = useHashLocation()

  // Check if the current URL is in the albums section
  const isInAlbumsSection = url === '/albums' || url.startsWith('/albums/')
  const isInPeopleSection = url === '/people' || url.startsWith('/people/')

  // Handle tab click without reloading the page
  const handleTabClick = (e: MouseEvent, path: string) => {
    e.preventDefault()
    route(path)
  }

  return (
    <div class="ios-tabbar-area">
      <nav class="ios-tabbar ios-tabbar-labeled liquid-glass">
        <a
          href="#/"
          class={`ios-tabbar-item ios-tabbar-labeled-item ${url === '/' ? 'active' : ''}`}
          onClick={(e) => handleTabClick(e, '/')}
        >
          <div class="ios-tabbar-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span>Timeline</span>
        </a>

        <a
          href="#/albums"
          class={`ios-tabbar-item ios-tabbar-labeled-item ${isInAlbumsSection ? 'active' : ''}`}
          onClick={(e) => handleTabClick(e, '/albums')}
        >
          <div class="ios-tabbar-icon">
            <svg
              width="24"
              height="24"
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
                fill="none"
              />
              <path
                d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
              <path
                d="M21 15L16 10L5 21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <span>Albums</span>
        </a>

        <a
          href="#/people"
          class={`ios-tabbar-item ios-tabbar-labeled-item ${isInPeopleSection ? 'active' : ''}`}
          onClick={(e) => handleTabClick(e, '/people')}
        >
          <div class="ios-tabbar-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
              <path
                d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span>People</span>
        </a>
      </nav>
    </div>
  )
}
