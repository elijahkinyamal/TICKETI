import { useNavigate } from 'react-router-dom'

export default function Header({ title, wordmark, back, right }) {
  const nav = useNavigate()
  return (
    <>
      {wordmark && <div className="countrystrip"><span>🇺🇸 US</span></div>}
      <div className="apphead">
        {back && <button aria-label="Back" onClick={() => nav(-1)}>‹</button>}
        {wordmark
          ? <div className="wordmark">ticketmaster</div>
          : <div className="title">{title}</div>}
        {right}
      </div>
    </>
  )
}
