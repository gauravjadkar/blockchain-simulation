import { useEffect, useState } from "react"
import {
  getChain,
  mineBlock,
  addTransaction,
  getPending,
  getStats,
  getBalance,
  validateChain,
  getDifficulty,
  setDifficulty,
  tamperBlock,
  registerNode,
  getNodes,
  resolveConflicts
} from "./api"
import DashboardStats from "./components/DashboardStats"
import "./App.css"

export default function App() {
  const [chain, setChain] = useState([])
  const [pending, setPending] = useState([])
  const [txInput, setTxInput] = useState("")
  const [minerName, setMinerName] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [walletBalance, setWalletBalance] = useState(null)
  const [balanceError, setBalanceError] = useState("")
  const [validationResult, setValidationResult] = useState("")
  const [difficulty, setDifficultyValue] = useState(2)
  const [difficultyError, setDifficultyError] = useState("")
  const [isMining, setIsMining] = useState(false)
  const [miningNonce, setMiningNonce] = useState(0)
  const [lastMinedIndex, setLastMinedIndex] = useState(null)
  const [isChainInvalid, setIsChainInvalid] = useState(false)
  const [stats, setStats] = useState({
    total_blocks: 0,
    total_transactions: 0,
    current_difficulty: 0,
    pending_transactions: 0,
    total_coins_minted: 0
  })
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState("")
  const [nodeUrl, setNodeUrl] = useState("")
  const [nodes, setNodes] = useState([])
  const [nodeError, setNodeError] = useState("")
  const [resolveStatus, setResolveStatus] = useState("")

  const loadChain = async () => {
    const res = await getChain()
    setChain(res.data.chain)
  }

  const loadPending = async () => {
    const res = await getPending()
    setPending(res.data.pending)
  }

  const loadStats = async () => {
    setStatsLoading(true)
    setStatsError("")
    try {
      const res = await getStats()
      setStats(res.data)
    } catch {
      setStatsError("Failed to load dashboard stats")
    } finally {
      setStatsLoading(false)
    }
  }

  const loadNodes = async () => {
    try {
      const res = await getNodes()
      setNodes(res.data.nodes || [])
    } catch {
      setNodes([])
    }
  }

  const handleAddTransaction = async () => {
    if (!txInput.trim()) return
    // Accept both "A->B:10" and legacy "A->B" (defaults amount to 1).
    const withAmount = txInput.trim().match(/^(.+?)\s*->\s*(.+?)\s*:\s*([0-9]*\.?[0-9]+)$/)
    const legacy = txInput.trim().match(/^(.+?)\s*->\s*(.+)$/)

    let sender = ""
    let receiver = ""
    let amount = 1

    if (withAmount) {
      sender = withAmount[1].trim()
      receiver = withAmount[2].trim()
      amount = Number(withAmount[3])
    } else if (legacy) {
      sender = legacy[1].trim()
      receiver = legacy[2].trim()
    } else {
      return
    }

    await addTransaction(sender, receiver, amount)
    setTxInput("")
    await loadPending()
    await loadStats()
  }

  const handleMine = async () => {
    if (!minerName.trim()) return

    setIsMining(true)
    setMiningNonce(0)
    try {
      const res = await mineBlock(minerName.trim())
      await loadChain()
      await loadPending()
      await loadStats()
      if (res?.data?.block_index !== undefined && res?.data?.block_index !== null) {
        setLastMinedIndex(res.data.block_index)
      }
    } finally {
      setIsMining(false)
    }
  }

  const handleCheckBalance = async () => {
    const address = walletAddress.trim()
    if (!address) return

    setBalanceError("")
    try {
      const res = await getBalance(address)
      setWalletBalance(res.data.balance)
    } catch (error) {
      setWalletBalance(null)
      setBalanceError(error?.response?.data?.error || "Failed to fetch balance")
    }
  }

  const handleValidateChain = async () => {
    try {
      const res = await validateChain()
      if (res.data.valid) {
        setValidationResult("Blockchain is valid ✅")
        setIsChainInvalid(false)
      } else {
        setValidationResult("❌ Blockchain is invalid")
        setIsChainInvalid(true)
      }
    } catch {
      setValidationResult("❌ Blockchain is invalid")
      setIsChainInvalid(true)
    }
  }

  const loadDifficulty = async () => {
    try {
      const res = await getDifficulty()
      setDifficultyValue(res.data.difficulty)
    } catch {
      setDifficultyError("Failed to load difficulty")
    }
  }

  const handleDifficultyChange = async (event) => {
    const nextDifficulty = Number(event.target.value)
    setDifficultyValue(nextDifficulty)
    setDifficultyError("")

    try {
      const res = await setDifficulty(nextDifficulty)
      setDifficultyValue(res.data.difficulty)
    } catch (error) {
      setDifficultyError(error?.response?.data?.error || "Failed to update difficulty")
    }
  }

  const handleRegisterNode = async () => {
    const url = nodeUrl.trim()
    if (!url) return
    setNodeError("")
    try {
      const res = await registerNode(url)
      setNodes(res.data.nodes || [])
      setNodeUrl("")
    } catch (error) {
      setNodeError(error?.response?.data?.error || "Failed to register node")
    }
  }

  const handleResolveConflicts = async () => {
    setResolveStatus("")
    try {
      const res = await resolveConflicts()
      if (res.data.replaced) {
        setResolveStatus(`Chain replaced. New length: ${res.data.new_length}`)
      } else {
        setResolveStatus(`Chain kept. Length: ${res.data.new_length}`)
      }
      await loadChain()
    } catch {
      setResolveStatus("Failed to resolve conflicts")
    }
  }

  useEffect(() => {
    loadChain()
    loadPending()
    loadStats()
    loadDifficulty()
    loadNodes()
  }, [])

  useEffect(() => {
    if (!isMining) return
    const timer = setInterval(() => {
      setMiningNonce((prev) => prev + 1)
    }, 50)
    return () => clearInterval(timer)
  }, [isMining])

  const handleTamper = async (index) => {
    if (index === 0) return
    const raw = window.prompt("Enter new transaction data for this block:")
    if (raw === null) return
    const newData = String(raw).trim()
    if (!newData) return

    await tamperBlock(index, newData)
    await loadChain()
    const res = await validateChain()
    if (res.data.valid) {
      setValidationResult("Blockchain is valid ✅")
      setIsChainInvalid(false)
    } else {
      setValidationResult("❌ Blockchain is invalid")
      setIsChainInvalid(true)
    }
  }

  const getInvalidBlockIndexes = (currentChain) => {
    const invalid = new Set()
    for (let i = 0; i < currentChain.length; i += 1) {
      const block = currentChain[i]
      if (i > 0) {
        const prev = currentChain[i - 1]
        if (block.prev_hash !== prev.block_hash) {
          invalid.add(i)
        }
      }

      const difficultyValue = Number(block.difficulty)
      if (Number.isInteger(difficultyValue) && difficultyValue > 0) {
        const prefix = "0".repeat(difficultyValue)
        if (typeof block.block_hash === "string" && !block.block_hash.startsWith(prefix)) {
          invalid.add(i)
        }
      }
    }
    return invalid
  }

  const shortHash = (hash) => {
    if (!hash || typeof hash !== "string") return "-"
    if (hash.length <= 24) return hash
    return `${hash.slice(0, 12)}...${hash.slice(-10)}`
  }

  const invalidIndexes = getInvalidBlockIndexes(chain)

  return (
    <div className="app-shell">
      <header className="hero-card">
        <p className="hero-chip">Distributed Ledger Playground</p>
        <h1>Blockchain Simulation</h1>
        <p className="hero-subtitle">
          Add transactions, mine blocks, and inspect the chain in real time.
        </p>
      </header>

      <DashboardStats stats={stats} isLoading={statsLoading} error={statsError} />

      <section className="panel action-panel">
        <h2>Create Transaction</h2>
        <div className="action-row">
          <input
            type="text"
            value={txInput}
            onChange={(e) => setTxInput(e.target.value)}
            placeholder="Enter transaction (e.g., A->B:10)"
            className="tx-input"
            disabled={isMining}
          />
          <button
            onClick={handleAddTransaction}
            className="btn btn-primary"
            disabled={!txInput.trim() || isMining}
          >
            Add Transaction
          </button>
        </div>

        <div className="action-row" style={{ marginTop: "12px" }}>
          <input
            type="text"
            value={minerName}
            onChange={(e) => setMinerName(e.target.value)}
            placeholder="Enter miner name"
            className="tx-input"
            disabled={isMining}
          />
          <button
            onClick={handleMine}
            className={`btn btn-accent${isMining ? " mining-glow" : ""}`}
            disabled={isMining || !minerName.trim()}
          >
            {isMining ? "Mining..." : "Mine Block"}
          </button>
        </div>
        {isMining && (
          <div className="mining-status">
            <span className="spinner" aria-hidden="true" />
            <span>Mining in progress...</span>
            <span className="nonce-counter">Nonce trials: {miningNonce}</span>
          </div>
        )}

        <div className="action-row" style={{ marginTop: "12px" }}>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter wallet address"
            className="tx-input"
            disabled={isMining}
          />
          <button
            onClick={handleCheckBalance}
            className="btn btn-primary"
            disabled={!walletAddress.trim() || isMining}
          >
            Check Balance
          </button>
        </div>

        {walletBalance !== null && (
          <p style={{ marginTop: "10px" }}>Balance: {walletBalance} coins</p>
        )}
        {balanceError && (
          <p style={{ marginTop: "10px", color: "#c53030" }}>{balanceError}</p>
        )}

        <div className="action-row" style={{ marginTop: "12px" }}>
          <button
            onClick={handleValidateChain}
            className="btn btn-accent"
            disabled={isMining}
          >
            Validate Chain
          </button>
        </div>
        {validationResult && (
          <p style={{ marginTop: "10px" }}>{validationResult}</p>
        )}

        <div className="action-row" style={{ marginTop: "12px", alignItems: "center", gap: "12px" }}>
          <label htmlFor="difficulty-slider">Mining Difficulty</label>
          <input
            id="difficulty-slider"
            type="range"
            min="1"
            max="5"
            step="1"
            value={difficulty}
            onChange={handleDifficultyChange}
            disabled={isMining}
          />
          <span>{difficulty}</span>
        </div>
        <p className="difficulty-readout">Current difficulty: {difficulty}</p>
        {difficultyError && (
          <p style={{ marginTop: "10px", color: "#c53030" }}>{difficultyError}</p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Network</h2>
          <span className="count-badge">{nodes.length} Nodes</span>
        </div>

        <div className="action-row">
          <input
            type="text"
            value={nodeUrl}
            onChange={(e) => setNodeUrl(e.target.value)}
            placeholder="http://127.0.0.1:5001"
            className="tx-input"
          />
          <button
            onClick={handleRegisterNode}
            className="btn btn-primary"
            disabled={!nodeUrl.trim()}
          >
            Register Node
          </button>
          <button
            onClick={handleResolveConflicts}
            className="btn btn-accent"
          >
            Resolve Conflicts
          </button>
        </div>
        {nodeError && (
          <p style={{ marginTop: "10px", color: "#c53030" }}>{nodeError}</p>
        )}
        {resolveStatus && (
          <p style={{ marginTop: "10px" }}>{resolveStatus}</p>
        )}

        {nodes.length === 0 ? (
          <p className="empty-state" style={{ marginTop: "10px" }}>
            No nodes registered yet
          </p>
        ) : (
          <ul className="pending-list" style={{ marginTop: "10px" }}>
            {nodes.map((node) => (
              <li key={node}>{node}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Pending Transactions</h2>
          <span className="count-badge">{pending.length}</span>
        </div>

        {pending.length === 0 ? (
          <p className="empty-state">No pending transactions</p>
        ) : (
          <ul className="pending-list">
            {pending.map((tx, index) => (
              <li key={index}>
                {typeof tx === "string" ? tx : `${tx.sender} -> ${tx.receiver}: ${tx.amount}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Blockchain</h2>
          <span className="count-badge">{chain.length} Blocks</span>
        </div>

        <div className="chain-grid">
          {chain.map((block, index) => {
            const isInvalid = isChainInvalid && invalidIndexes.has(index)
            const txs = block.transaction
            const isNew = lastMinedIndex !== null && index === lastMinedIndex
            return (
            <article
              key={index}
              className={`block-card${isInvalid ? " invalid" : ""}${isNew ? " block-new" : ""}`}
            >
              <div className="block-head">
                <h3>Block #{block.index}</h3>
                <div className="block-head-right">
                  {block.index > 0 && (
                    <button
                      className="btn btn-tamper"
                      disabled={isMining}
                      onClick={() => handleTamper(block.index)}
                    >
                      Tamper
                    </button>
                  )}
                  <span>Nonce: {block.nonce}</span>
                </div>
              </div>

              <dl className="meta-grid">
                <div>
                  <dt>Previous Hash</dt>
                  <dd title={block.prev_hash}>{shortHash(block.prev_hash)}</dd>
                </div>
                <div>
                  <dt>Block Hash</dt>
                  <dd title={block.block_hash}>{shortHash(block.block_hash)}</dd>
                </div>
              </dl>

              <div>
                <p className="tx-title">Transactions</p>
                {Array.isArray(txs) && txs.length ? (
                  <ul className="tx-list">
                    {txs.map((tx, i) => (
                      <li key={i}>
                        {typeof tx === "string" ? tx : `${tx.sender} -> ${tx.receiver}: ${tx.amount}`}
                      </li>
                    ))}
                  </ul>
                ) : typeof txs === "string" && txs ? (
                  <p>{txs}</p>
                ) : (
                  <p className="empty-state">No transactions in this block</p>
                )}
              </div>
            </article>
          )})}
        </div>
      </section>
    </div>
  )
}
