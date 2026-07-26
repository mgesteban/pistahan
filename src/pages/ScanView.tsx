import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import ResultCard from '../components/ResultCard'
import type { ResultState } from './Scanner'

interface Props {
  onToken: (raw: string, method: 'qr' | 'manual') => Promise<ResultState>
}

export default function ScanView({ onToken }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const lastSeen = useRef(new Map<string, number>())
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const [running, setRunning] = useState(false)
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [manual, setManual] = useState('')
  const [result, setResult] = useState<ResultState | null>(null)
  const [camError, setCamError] = useState('')

  async function handleDecode(data: string) {
    const token = data.trim().toUpperCase()
    const now = Date.now()
    // debounce: one held-up phone must not fire twenty scans
    const last = lastSeen.current.get(token) ?? 0
    if (now - last < 3000) return
    lastSeen.current.set(token, now)
    setResult(await onToken(token, 'qr'))
  }

  async function acquireWakeLock() {
    try {
      wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      /* not fatal — some browsers deny without user gesture */
    }
  }

  // getUserMedia must be called from a user gesture (iOS requirement).
  async function start() {
    setCamError('')
    try {
      const scanner = new QrScanner(
        videoRef.current!,
        (res) => void handleDecode(res.data),
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          highlightScanRegion: true,
          maxScansPerSecond: 8,
        }
      )
      scannerRef.current = scanner
      await scanner.start()
      setRunning(true)
      setHasFlash(await scanner.hasFlash())
      await acquireWakeLock()
    } catch (err) {
      setCamError(`Camera failed: ${String(err)}. Use manual entry below.`)
    }
  }

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && running) void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      scannerRef.current?.destroy()
      wakeLockRef.current?.release().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  async function submitManual() {
    let token = manual.trim().toUpperCase().replace(/\s+/g, '')
    if (!token) return
    if (!token.startsWith('PST-')) token = `PST-${token.replace(/^PST/, '')}`
    setManual('')
    setResult(await onToken(token, 'manual'))
  }

  return (
    <div className="scanview">
      <div className={`viewfinder ${running ? '' : 'viewfinder-idle'}`}>
        <video ref={videoRef} playsInline muted />
        {!running && (
          <button className="btn btn-primary btn-big" onClick={() => void start()}>
            Start scanning
          </button>
        )}
        {running && hasFlash && (
          <button
            className={`torch ${flashOn ? 'torch-on' : ''}`}
            onClick={() => {
              void scannerRef.current?.toggleFlash()
              setFlashOn((f) => !f)
            }}
          >
            🔦
          </button>
        )}
      </div>
      {camError && <div className="error">{camError}</div>}

      <div className="manual-entry">
        <input
          className="input input-mono"
          placeholder="Type code: PST-…"
          value={manual}
          autoCapitalize="characters"
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submitManual()}
        />
        <button className="btn" onClick={() => void submitManual()}>
          Go
        </button>
      </div>

      {result && (
        <ResultCard
          status={result.status}
          volunteer={result.volunteer}
          token={result.token}
          checkedInAt={result.checkedInAt}
        />
      )}
    </div>
  )
}
