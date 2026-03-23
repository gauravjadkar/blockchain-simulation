# Blockchain Simulation Project

This project is a full-stack blockchain simulator built for learning core blockchain concepts through a working application. It combines a Python Flask backend with a React + Vite frontend so you can create transactions, mine blocks, validate the chain, adjust proof-of-work difficulty, simulate network peers, and observe how tampering breaks integrity.

## Project Overview

The application demonstrates:

- Block creation with SHA-256 hashing
- Proof-of-work mining using configurable difficulty
- Pending transaction handling
- Mining rewards for miners
- Wallet balance calculation from on-chain history
- Chain validation and tamper detection
- Basic multi-node registration and longest-valid-chain conflict resolution
- A browser-based dashboard for interacting with the blockchain

## Tech Stack

### Backend

- Python
- Flask
- Flask-CORS
- Requests

### Frontend

- React
- Vite
- Axios
- CSS

## Repository Structure

```text
Blockchain_prj/
|-- Backend/
|   |-- app.py
|   |-- blockchain_prj.py
|
|-- blockchain-ui/
|   |-- src/
|   |   |-- App.jsx
|   |   |-- api.js
|   |   |-- components/
|   |   |   |-- DashboardStats.jsx
|   |-- package.json
|   |-- vite.config.js
|
|-- README.md
```

## How It Works

### 1. Blockchain Core

The blockchain logic lives in `Backend/blockchain_prj.py`. It defines:

- `block`: stores block metadata like index, transactions, previous hash, nonce, timestamp, difficulty, and the current hash
- `Blockchain`: manages the chain, pending transactions, mining, validation, balances, and peer-node conflict resolution

Each block includes:

- `index`
- `transactions`
- `prev_hash`
- `difficulty`
- `nonce`
- `time_stamp`
- `block_hash`

### 2. Mining

Mining works by repeatedly changing the block nonce until the resulting SHA-256 hash starts with a required number of leading zeroes. The number of leading zeroes is controlled by the current `difficulty`.

When a block is mined:

- all pending transactions are included
- a mining reward transaction is added automatically
- the new block is linked to the previous block hash
- the block is appended to the chain
- pending transactions are cleared

### 3. Validation

The chain is considered valid only if:

- every block correctly points to the previous block hash
- each block hash still matches its stored content
- each non-genesis block satisfies the proof-of-work rule for its recorded difficulty

### 4. Network Simulation

The backend supports registering peer nodes and checking whether a longer valid chain exists on another node. If found, the local node replaces its chain with the longest valid one.

This models a simplified blockchain consensus rule:

- prefer the longest valid chain

## Features

- Create structured transactions in the format `sender -> receiver : amount`
- Mine blocks and award `10` coins to the miner
- View all blocks in the chain
- View pending transactions
- Check wallet balances
- Validate the full blockchain
- Change mining difficulty from `1` to `5`
- Register other blockchain nodes
- Resolve conflicts across nodes
- Tamper with a block to demonstrate immutability failure
- View blockchain statistics in the dashboard

## Prerequisites

Make sure you have the following installed:

- Python 3.10+ recommended
- Node.js 18+ recommended
- npm

## Backend Setup

Open a terminal in the project root and run:

```powershell
cd Backend
python -m venv .venv
.venv\Scripts\activate
pip install flask flask-cors requests
python app.py
```

The backend starts on:

```text
http://127.0.0.1:5000
```

To run a second node on another port:

```powershell
cd Backend
python app.py --port 5001
```

You can start additional nodes the same way, for example `5002`, `5003`, and so on.

## Frontend Setup

Open a second terminal in the project root and run:

```powershell
cd blockchain-ui
npm install
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

The frontend is already configured to call the backend at:

```text
http://127.0.0.1:5000
```

## Running the Full Project

Start the backend first, then the frontend:

1. Run Flask from `Backend/`
2. Run Vite from `blockchain-ui/`
3. Open `http://localhost:5173`
4. Add transactions
5. Mine a block
6. Validate the chain and inspect the dashboard

## Example User Flow

### Add a transaction

Enter:

```text
A->B:25
```

This queues a pending transaction from `A` to `B` worth `25` coins.

### Mine a block

Enter a miner name such as:

```text
miner1
```

When the block is mined:

- the pending transaction is included
- a reward transaction from `SYSTEM` to `miner1` is added
- the chain length increases

### Check balance

You can check the balance of:

- `A`
- `B`
- `miner1`

Balances are calculated by scanning confirmed on-chain transactions.

### Tamper with a block

Use the `Tamper` button on a non-genesis block and change its stored transaction data. After that, validating the chain should show it as invalid.

## API Endpoints

The backend exposes the following routes:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/ping` | Health check |
| `GET` | `/chain` | Get the full blockchain |
| `POST` | `/add_transaction` | Add a transaction |
| `GET` | `/pending` | Get pending transactions |
| `POST` | `/mine` | Mine a block and reward a miner |
| `GET` | `/validate` | Validate the blockchain |
| `GET` | `/is_valid` | Backward-compatible validation route |
| `GET` | `/difficulty` | Get current mining difficulty |
| `POST` | `/set_difficulty` | Update difficulty from `1` to `5` |
| `GET` | `/stats` | Get blockchain dashboard statistics |
| `GET` | `/balance/<address>` | Get wallet balance |
| `POST` | `/register_node` | Register a peer node |
| `GET` | `/nodes` | List registered nodes |
| `GET` | `/resolve` | Resolve chain conflicts |
| `POST` | `/tamper` | Intentionally corrupt a block for demo purposes |

## Sample Request Payloads

### Add transaction

```json
{
  "sender": "Alice",
  "receiver": "Bob",
  "amount": 15
}
```

### Mine block

```json
{
  "miner": "miner1"
}
```

### Set difficulty

```json
{
  "difficulty": 3
}
```

### Register node

```json
{
  "node_url": "http://127.0.0.1:5001"
}
```

### Tamper block

```json
{
  "index": 1,
  "new_data": "Fake transaction data"
}
```

## Multi-Node Demo

To try the network features:

1. Start one backend node on `5000`
2. Start another backend node on `5001`
3. Use the frontend connected to `5000`
4. Register `http://127.0.0.1:5001`
5. Mine different chains on the nodes
6. Call conflict resolution
7. Observe whether the local node adopts the longer valid chain

## Notes and Limitations

This is an educational blockchain simulator, not a production blockchain implementation.

Important simplifications:

- no persistent database
- no cryptographic wallet signing
- no real peer-to-peer networking
- no transaction fee market
- no mempool propagation between nodes
- no distributed storage or security hardening

Everything is stored in memory, so restarting the backend resets the blockchain state.

## Suggested Improvements

Possible next steps for the project:

- store chain data in a database or file
- add wallet key generation and digital signatures
- support transaction history lookup per address
- improve consensus and peer synchronization
- add automated tests for mining, validation, and balance logic
- add Docker support
- add environment-based API configuration for the frontend

## Main Files

- `Backend/app.py`: Flask API routes and node server
- `Backend/blockchain_prj.py`: blockchain logic, mining, validation, and consensus
- `blockchain-ui/src/App.jsx`: main React UI
- `blockchain-ui/src/api.js`: frontend API client
- `blockchain-ui/src/components/DashboardStats.jsx`: dashboard statistics cards

## License

This project does not currently include a license file. Add one if you plan to share or publish it.
