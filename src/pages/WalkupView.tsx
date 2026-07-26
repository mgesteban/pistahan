import { useState } from 'react'
import { queueWalkup } from '../lib/db'
import type { Walkup } from '../lib/types'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']

interface Props {
  operator: string
  onQueued: () => void
}

export default function WalkupView({ operator, onQueued }: Props) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [phone, setPhone] = useState('')
  const [shirt, setShirt] = useState('')
  const [post, setPost] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit() {
    if (!first.trim() || !last.trim()) return
    const w: Walkup = {
      walkup_id: crypto.randomUUID(),
      first_name: first.trim(),
      last_name: last.trim(),
      phone: phone.trim(),
      shirt_size: shirt,
      post: post.trim(),
      added_by: operator,
    }
    await queueWalkup(w)
    onQueued()
    setSaved(true)
    setFirst('')
    setLast('')
    setPhone('')
    setShirt('')
    setPost('')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="walkupview">
      <p className="walkup-hint">
        Not on the roster? Add them here — it syncs to the Walkups tab.
      </p>
      <input className="input" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
      <input className="input" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
      <input className="input" placeholder="Phone (optional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="size-grid">
        {SIZES.map((s) => (
          <button
            key={s}
            className={`station-btn ${shirt === s ? 'selected' : ''}`}
            onClick={() => setShirt(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <input className="input" placeholder="Assigned post (optional)" value={post} onChange={(e) => setPost(e.target.value)} />
      <button
        className="btn btn-primary btn-big"
        disabled={!first.trim() || !last.trim()}
        onClick={() => void submit()}
      >
        Add walk-up
      </button>
      {saved && <div className="roster-loaded">✓ Added to queue</div>}
    </div>
  )
}
