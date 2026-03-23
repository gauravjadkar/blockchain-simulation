from flask import Flask,jsonify,request
from urllib.parse import urlparse
import argparse
import time
from blockchain_prj import  Blockchain,block
from flask_cors import CORS
print("The file is running")
app=Flask(__name__)
# CORS enabled for React frontend.
CORS(app, origins=["http://localhost:5173"])
bc=Blockchain()

@app.route("/ping")
def ping():
    return "pong", 200

@app.route("/chain", methods=["GET"])
def get_chain():
    return jsonify({
        "length": len(bc.chain),
        "chain": [b.__dict__ for b in bc.chain]
    }), 200


@app.route("/register_node", methods=["POST"])
def register_node():
    data = request.get_json(silent=True) or {}
    node_url = str(data.get("node_url", "")).strip()

    if not node_url:
        return jsonify({"error": "node_url is required"}), 400

    parsed = urlparse(node_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return jsonify({"error": "node_url must include scheme and host"}), 400

    bc.nodes.add(f"{parsed.scheme}://{parsed.netloc}")

    return jsonify({
        "message": "Node registered",
        "total_nodes": len(bc.nodes),
        "nodes": sorted(bc.nodes)
    }), 200


@app.route("/nodes", methods=["GET"])
def get_nodes():
    return jsonify({
        "nodes": sorted(bc.nodes),
        "count": len(bc.nodes)
    }), 200


@app.route("/resolve", methods=["GET"])
def resolve_chain():
    try:
        replaced = bc.resolve_conflicts()
        return jsonify({
            "replaced": replaced,
            "new_length": len(bc.chain)
        }), 200
    except Exception:
        return jsonify({"error": "Failed to resolve conflicts"}), 500


@app.route("/mine", methods=["POST"])
def mine():
    data = request.get_json(silent=True) or {}
    miner = str(data.get("miner", "")).strip()

    # Miner name/address is required so reward can be assigned to a recipient.
    if not miner:
        return jsonify({"error": "miner is required"}), 400

    # Artificial delay to simulate mining time for UI feedback only.
    time.sleep(1)
    new_block = bc.mine_block(miner)

    return jsonify({
        "message": "Block mined successfully",
        "block_index": new_block.index
    }), 200


@app.route("/is_valid",methods=['GET'])
def validate_chain():
    # Backward-compatible route kept for earlier stages/clients.
    return jsonify({"valid":bc.is_chain_valid()})


@app.route("/validate", methods=["GET"])
def validate():
    return jsonify({
        "valid": bc.is_chain_valid()
    }), 200


@app.route("/difficulty", methods=["GET"])
def get_difficulty():
    return jsonify({
        "difficulty": bc.difficulty
    }), 200


@app.route("/set_difficulty", methods=["POST"])
def set_difficulty():
    data = request.get_json(silent=True) or {}
    raw_difficulty = data.get("difficulty")

    if raw_difficulty is None:
        return jsonify({"error": "difficulty is required"}), 400

    # Difficulty must be an integer target size. In this project we cap it at
    # 1..5 so mining stays responsive while still demonstrating PoW scaling.
    if isinstance(raw_difficulty, bool) or not isinstance(raw_difficulty, int):
        return jsonify({"error": "difficulty must be an integer between 1 and 5"}), 400

    if raw_difficulty < 1 or raw_difficulty > 5:
        return jsonify({"error": "difficulty must be between 1 and 5"}), 400

    bc.difficulty = raw_difficulty
    return jsonify({
        "message": "Difficulty updated",
        "difficulty": bc.difficulty
    }), 200

@app.route("/add_transaction", methods=["POST"])
def add_transaction():
    data = request.get_json()
    print("Received:", data)

    if not data:
        return jsonify({"error": "No data received"}), 400

    # Stage 1 input: prefer structured payload, but keep legacy payload support.
    if all(field in data for field in ["sender", "receiver", "amount"]):
        sender = str(data["sender"]).strip()
        receiver = str(data["receiver"]).strip()
        amount = data["amount"]
    elif "transaction" in data:
        tx_raw = str(data["transaction"]).strip()
        # Legacy format support: "A->B" or "A->B:10"
        if "->" not in tx_raw:
            return jsonify({"error": "legacy transaction must be in 'sender->receiver' format"}), 400
        parts = tx_raw.split("->", 1)
        sender = parts[0].strip()
        right = parts[1].strip()
        if ":" in right:
            receiver_part, amount_part = right.split(":", 1)
            receiver = receiver_part.strip()
            amount = amount_part.strip()
        else:
            receiver = right
            amount = 1
    else:
        return jsonify({"error": "Missing required fields: sender, receiver, amount"}), 400

    if not sender or not receiver:
        return jsonify({"error": "sender and receiver cannot be empty"}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400

    bc.add_transaction(sender, receiver, amount)

    return jsonify({
        "message": "Transaction added",
        "pending": bc.pending_transactions
    }), 200


@app.route("/pending",methods=["GET"])
def get_pending():
    return jsonify({
        "pending":bc.pending_transactions}),200

@app.route("/stats", methods=["GET"])
def get_stats():
    # Count every transaction stored in every block across the full chain.
    total_transactions = 0
    # Count and sum protocol-minted reward transactions where sender is SYSTEM.
    total_coins_minted = 0.0

    for chain_block in bc.chain:
        # Keep compatibility with both "transaction" and "transactions" fields.
        block_transactions = getattr(chain_block, "transactions", getattr(chain_block, "transaction", []))
        if not isinstance(block_transactions, list):
            continue

        total_transactions += len(block_transactions)

        for tx in block_transactions:
            if not isinstance(tx, dict):
                continue
            if tx.get("sender") != "SYSTEM":
                continue
            try:
                total_coins_minted += float(tx.get("amount", 0))
            except (TypeError, ValueError):
                continue

    return jsonify({
        "total_blocks": len(bc.chain),
        "total_transactions": total_transactions,
        "current_difficulty": bc.difficulty,
        "pending_transactions": len(bc.pending_transactions),
        "total_coins_minted": total_coins_minted
    }), 200


@app.route("/balance/<address>", methods=["GET"])
def get_balance(address):
    try:
        wallet_address = str(address).strip()
        if not wallet_address:
            return jsonify({"error": "address cannot be empty"}), 400

        balance = bc.get_balance(wallet_address)
        return jsonify({
            "address": wallet_address,
            "balance": balance
        }), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "Failed to calculate balance"}), 500

@app.route("/tamper", methods=["POST"])
def tamper_block():
    # Educational simulation only: this intentionally mutates a stored block.
    # Real blockchains do NOT allow post-mining edits like this.
    # The purpose is to demonstrate immutability by making validation fail.
    data = request.get_json(silent=True) or {}
    raw_index = data.get("index")
    new_data = data.get("new_data")

    if raw_index is None or new_data is None:
        return jsonify({"error": "index and new_data are required"}), 400

    if not isinstance(raw_index, int) or isinstance(raw_index, bool):
        return jsonify({"error": "index must be an integer"}), 400

    if raw_index < 0 or raw_index >= len(bc.chain):
        return jsonify({"error": "index out of range"}), 400

    if raw_index == 0:
        return jsonify({"error": "cannot tamper with genesis block"}), 400

    target_block = bc.chain[raw_index]
    target_block.transaction = str(new_data)
    # Keep alias in sync for any consumers using "transactions".
    target_block.transactions = target_block.transaction
    # Recalculate hash without mining; this should break validation.
    target_block.block_hash = target_block.cal_hash()

    return jsonify({
        "message": "Block tampered",
        "index": raw_index
    }), 200

if __name__=="__main__":
    parser = argparse.ArgumentParser(description="Blockchain node server")
    parser.add_argument("--port", type=int, default=5000, help="Port to run the node on")
    args = parser.parse_args()

    app.run(debug=True, use_reloader=False, port=args.port)


'''
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/ping")
def ping():
    return "pong", 200

@app.route("/test")
def test():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    app.run(debug=True)
'''
