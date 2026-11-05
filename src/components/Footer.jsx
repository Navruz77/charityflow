// Disclaimer, the required prices credit, and a link to the status page.
export default function Footer() {
  return (
    <footer className="app-footer">
      <p className="disclaimer">
        CharityFlow gives an estimate to help you plan your own Zakat. It is not religious or
        financial advice. For your specific situation, please confirm with a qualified scholar.
      </p>
      <p className="muted">
        <a href="https://metalcharts.org" target="_blank" rel="noreferrer">
          Prices via metalcharts.org
        </a>{' '}
        · <a href="#/status">Price status</a>
      </p>
    </footer>
  )
}
