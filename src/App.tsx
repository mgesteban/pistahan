import Help from './pages/Help'
import Pass from './pages/Pass'
import Rsvp from './pages/Rsvp'
import Scanner from './pages/Scanner'

// Routed by path: "/pass" is the public volunteer pass, "/help" the how-to
// guides, "/appreciation" (or "/rsvp") the appreciation-night RSVP,
// everything else is the station scanner. A bare browser visit to
// the root (no setup-link query string, not a home-screen launch) is someone
// typing pistahan.app on their phone — send them to the volunteer guide.
export default function App() {
  const path = window.location.pathname
  if (path.startsWith('/pass')) return <Pass />
  if (path.startsWith('/help')) return <Help />
  if (path.startsWith('/appreciation') || path.startsWith('/rsvp')) return <Rsvp />
  const installed = window.matchMedia('(display-mode: standalone)').matches
  if (path === '/' && !window.location.search && !installed) {
    window.location.replace('/help#volunteers')
    return null
  }
  return <Scanner />
}
