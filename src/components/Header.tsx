import { useHashLocation } from '../contexts/HashLocationContext'

export function Header() {
  const { url } = useHashLocation()

  return (
    <header>
      <nav>
        <a href="#/" class={url === '/' ? 'active' : undefined}>
          Home
        </a>
        <a href="#/404" class={url === '/404' ? 'active' : undefined}>
          404
        </a>
      </nav>
    </header>
  )
}
