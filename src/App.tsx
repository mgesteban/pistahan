import Help from './pages/Help'
import Pass from './pages/Pass'
import Scanner from './pages/Scanner'

// Routed by path: "/pass" is the public volunteer pass, "/help" the how-to
// guides, everything else is the station scanner.
export default function App() {
  const path = window.location.pathname
  if (path.startsWith('/pass')) return <Pass />
  if (path.startsWith('/help')) return <Help />
  return <Scanner />
}
