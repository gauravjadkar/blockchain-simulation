const STAT_CARDS = [
  { key: "total_blocks", label: "Total Blocks" },
  { key: "total_transactions", label: "Total Transactions" },
  { key: "current_difficulty", label: "Current Difficulty" },
  { key: "pending_transactions", label: "Pending Transactions" },
  { key: "total_coins_minted", label: "Total Coins Minted" }
]

const formatValue = (key, value) => {
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return "0"
  if (key === "total_coins_minted") return numericValue.toFixed(2)
  return numericValue.toLocaleString()
}

export default function DashboardStats({ stats, isLoading, error }) {
  const blocks = Number(stats?.total_blocks || 0)
  const transactions = Number(stats?.total_transactions || 0)
  const maxValue = Math.max(blocks, transactions, 1)

  return (
    <section className="panel dashboard-panel">
      <div className="section-heading">
        <h2>Blockchain Analytics Dashboard</h2>
      </div>

      {error && <p className="dashboard-error">{error}</p>}

      <div className="stats-grid">
        {STAT_CARDS.map((card) => (
          <article key={card.key} className="stat-card">
            <p className="stat-label">{card.label}</p>
            <p className={`stat-value${isLoading ? " loading" : ""}`}>
              {formatValue(card.key, stats?.[card.key] ?? 0)}
            </p>
          </article>
        ))}
      </div>

      <div className="mini-chart" aria-label="Blocks vs Transactions">
        <p className="mini-chart-title">Blocks vs Transactions</p>
        <div className="mini-bar-wrap">
          <span className="mini-bar-label">Blocks</span>
          <div className="mini-bar-track">
            <div
              className="mini-bar-fill blocks"
              style={{ width: `${(blocks / maxValue) * 100}%` }}
            />
          </div>
          <span className="mini-bar-value">{blocks}</span>
        </div>
        <div className="mini-bar-wrap">
          <span className="mini-bar-label">Transactions</span>
          <div className="mini-bar-track">
            <div
              className="mini-bar-fill txs"
              style={{ width: `${(transactions / maxValue) * 100}%` }}
            />
          </div>
          <span className="mini-bar-value">{transactions}</span>
        </div>
      </div>
    </section>
  )
}
