import { useNavigate } from 'react-router-dom'

export default function Header({ title, wordmark, back, right }) {
  const nav = useNavigate()
  return (
    <>
      {wordmark && (
        <div className="countrystrip">
          <svg className="usflag" viewBox="0 0 74 39" aria-label="United States">
            <rect width="74" height="39" fill="#fff" />
            {[0, 2, 4, 6, 8, 10, 12].map((i) => <rect key={i} y={i * 3} width="74" height="3" fill="#b22234" />)}
            <rect width="30" height="21" fill="#3c3b6e" />
            {Array.from({ length: 4 }).flatMap((_, r) =>
              Array.from({ length: 5 }).map((__, c) => (
                <circle key={`${r}-${c}`} cx={4 + c * 5.5} cy={4 + r * 4.5} r="0.9" fill="#fff" />
              )))}
          </svg>
          <span>United States</span>
        </div>
      )}
      <div className="apphead">
        {back && <button aria-label="Back" onClick={() => nav(-1)}>‹</button>}
        {wordmark
          ? <div className="wordmark">
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <path style={{ fill: '#fff', stroke: 'none' }} d="M5 13c0-1.7 1.3-3 3-3h24c1.7 0 3 1.3 3 3v3.2a3.8 3.8 0 0 0 0 7.6V27c0 1.7-1.3 3-3 3H8c-1.7 0-3-1.3-3-3v-3.2a3.8 3.8 0 0 0 0-7.6V13z" />
                <path style={{ fill: 'none', stroke: 'var(--navbar)', strokeWidth: 2, strokeLinecap: 'round', strokeDasharray: '2 3' }} d="M20 12v16" />
              </svg>
              <span>Ticket</span>
            </div>
          : <div className="title">{title}</div>}
        {right}
      </div>
    </>
  )
}
