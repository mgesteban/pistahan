import Help from './pages/Help'
import Pass from './pages/Pass'
import Scanner from './pages/Scanner'

// Routed by path: "/pass" is the public volunteer pass, "/help" the how-to
// guides, everything else is the station scanner. A bare visit to the root
// (no setup-link query string) is someone typing pistahan.app on their
// phone — send them to the volunteer guide.
export default function App() {
  const path = window.location.pathname
  if (path.startsWith('/pass')) return <Pass />
  if (path.startsWith('/help')) return <Help />
  if (path === '/' && !window.location.search) {
    window.location.replace('/help#volunteers')
    return null
  }
  return <Scanner />
}
