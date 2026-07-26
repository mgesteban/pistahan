import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Volunteer } from '../lib/types'

// The volunteer's pass: big QR (token only), token in plain text as the
// manual-entry fallback, and their assignment details.
export default function PassCard({ volunteer }: { volunteer: Volunteer }) {
  const [qr, setQr] = useState('')

  useEffect(() => {
    QRCode.toDataURL(volunteer.token, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 12,
    })
      .then(setQr)
      .catch(() => setQr(''))
  }, [volunteer.token])

  const assignments = volunteer.assignments
    ? volunteer.assignments.split(' ; ')
    : []

  return (
    <div className="pass">
      <div className="pass-screenshot-banner">📸 Screenshot this page now</div>
      <div className="pass-qr-wrap">
        {qr && <img className="pass-qr" src={qr} alt={`QR code ${volunteer.token}`} />}
      </div>
      <div className="pass-token">{volunteer.token}</div>
      <div className="pass-name">
        {volunteer.first_name} {volunteer.last_name}
      </div>
      <div className="pass-details">
        <div className="pass-row">
          <span>Shirt</span>
          <b>{volunteer.shirt_size || 'TBD'}</b>
        </div>
        <div className="pass-row">
          <span>Team</span>
          <b>{volunteer.team || '—'}</b>
        </div>
        <div className="pass-row">
          <span>Post</span>
          <b>{volunteer.post || '—'}</b>
        </div>
        <div className="pass-row">
          <span>Days</span>
          <b>{volunteer.days ? volunteer.days.replaceAll('|', ' + ') : 'TBD'}</b>
        </div>
        {volunteer.shift_start && (
          <div className="pass-row">
            <span>Shift</span>
            <b>
              {volunteer.shift_start}–{volunteer.shift_end}
            </b>
          </div>
        )}
        {assignments.length > 1 && (
          <div className="pass-assignments">
            {assignments.map((a) => (
              <div key={a}>{a}</div>
            ))}
          </div>
        )}
      </div>
      <p className="pass-hint">
        Show the QR at check-in. If the camera can’t read it, give the code
        above. Works offline once screenshotted.
      </p>
    </div>
  )
}
