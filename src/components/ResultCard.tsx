import type { Volunteer } from '../lib/types'

export type ScanStatus = 'ok' | 'already' | 'notfound'

interface Props {
  status: ScanStatus
  volunteer?: Volunteer
  token: string
  checkedInAt?: string
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ResultCard({ status, volunteer, token, checkedInAt }: Props) {
  if (status === 'notfound' || !volunteer) {
    return (
      <div className="result result-notfound">
        <div className="result-banner">NOT ON ROSTER</div>
        <div className="result-token">{token}</div>
        <p className="result-help">Send to the help desk — do not hold the lane.</p>
      </div>
    )
  }

  const assignments = volunteer.assignments
    ? volunteer.assignments.split(' ; ')
    : []

  return (
    <div className={`result ${status === 'already' ? 'result-already' : 'result-ok'}`}>
      {status === 'already' && checkedInAt && (
        <div className="result-banner">ALREADY CHECKED IN · {fmtTime(checkedInAt)}</div>
      )}
      {/* Visual hierarchy per brief: shirt size legible at arm's length */}
      <div className="result-shirt">{volunteer.shirt_size || '?'}</div>
      <div className="result-name">
        {volunteer.first_name} {volunteer.last_name}
      </div>
      <div className="result-post">{volunteer.post || volunteer.team}</div>
      <div className="result-meta">
        {volunteer.team}
        {volunteer.days ? ` · ${volunteer.days.replaceAll('|', ' + ')}` : ''}
        {volunteer.shift_start ? ` · ${volunteer.shift_start}–${volunteer.shift_end}` : ''}
      </div>
      {assignments.length > 1 && (
        <ul className="result-assignments">
          {assignments.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {volunteer.is_minor && <div className="flag flag-minor">MINOR</div>}
      {volunteer.notes && <div className="result-notes">{volunteer.notes}</div>}
    </div>
  )
}
