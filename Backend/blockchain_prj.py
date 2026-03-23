import hashlib
import time
import json
import requests

class block:
    def __init__(self, index, transactions, prev_hash, difficulty, nonce=0):
        self.index = index
        # Keep "transaction" for compatibility with existing API/frontend
        # payloads, but also expose "transactions" for clearer semantics.
        self.transaction = transactions
        self.transactions = transactions
        self.prev_hash = prev_hash
        # Difficulty is part of the block data so historical blocks remain
        # verifiable even if network/global difficulty changes later.
        self.difficulty = int(difficulty)
        self.nonce = nonce
        self.time_stamp = time.time()
        self.block_hash = self.cal_hash()

    def cal_hash(self):
        block_string = json.dumps({
            "index": self.index,
            "nonce": self.nonce,
            "transaction": self.transaction,
            "time": self.time_stamp,
            "prev_hash": self.prev_hash
        }, sort_keys=True).encode()

        return hashlib.sha256(block_string).hexdigest()

    def mine_block(self, difficulty=None):
        # Backward-compatible optional arg: if provided, sync block difficulty.
        if difficulty is not None:
            self.difficulty = int(difficulty)

        # Proof-of-work target is derived from the block's own difficulty.
        target = "0" * self.difficulty
        while self.block_hash[:self.difficulty] != target:
            self.nonce += 1
            self.block_hash = self.cal_hash()
        print("Block mined:", self.block_hash)


class Blockchain:
    def __init__(self):
        self.chain = []
        # Registry of peer nodes for multi-node simulation.
        # Stored as a set to avoid duplicates.
        self.nodes = set()
        # Difficulty is the number of leading zeros required in a valid block
        # hash. Higher values make mining harder because miners must try more
        # nonce values before finding a hash below the target.
        self.difficulty = 2
        # Stage 1: store structured transaction objects in pending list.
        self.pending_transactions = []
        # Backward-compatible alias so existing code using old name still works.
        self.pending_transaction = self.pending_transactions
        self.create_genesis_block()

    def create_genesis_block(self):
        # Genesis also records a difficulty value so block schema is uniform.
        genesis = block(0, ["Genesis Block"], "0", self.difficulty)
        self.chain.append(genesis)

    def mine_block(self, miner_address):
        # Mining reward: miners are incentivized with newly created coins for
        # spending computation to secure the chain.
        reward_transaction = {
            # SYSTEM is the sender because this reward is minted by protocol,
            # not transferred from an existing user account.
            "sender": "SYSTEM",
            "receiver": miner_address,
            "amount": 10
        }
        # Add reward before block creation so it is included in the mined block.
        self.pending_transactions.append(reward_transaction)

        prev = self.chain[-1]

        new_block = block(
            index=len(self.chain),
            # Keep mining logic unchanged; block now carries transaction objects.
            transactions=self.pending_transactions.copy(),
            prev_hash=prev.block_hash,
            difficulty=self.difficulty
        )

        # Global difficulty controls future blocks; each new block snapshots
        # that value into its own header before mining.
        new_block.mine_block()   # VERY IMPORTANT
        self.chain.append(new_block)
        self.pending_transactions = []
        self.pending_transaction = self.pending_transactions
        return new_block

    def add_transaction(self, sender, receiver, amount):
         # Stage 1 structured transaction payload.
         transaction = {
             "sender": sender,
             "receiver": receiver,
             "amount": float(amount)
         }
         self.pending_transactions.append(transaction)

    def get_balance(self, address):
        # The blockchain itself is the ledger: every confirmed transfer is
        # stored in block transactions, so balance is derived from history.
        if not isinstance(address, str):
            raise ValueError("address must be a string")

        address = address.strip()
        if not address:
            raise ValueError("address cannot be empty")

        # We do not keep a central mutable balance table because that would
        # duplicate state and can drift from the source-of-truth ledger.
        # Instead, scan the full chain and calculate net flow for this wallet.
        balance = 0.0

        for block_item in self.chain:
            transactions = getattr(block_item, "transaction", [])
            if not isinstance(transactions, list):
                continue

            for tx in transactions:
                # Skip legacy/non-structured records like the genesis marker.
                if not isinstance(tx, dict):
                    continue

                sender = tx.get("sender")
                receiver = tx.get("receiver")

                try:
                    amount = float(tx.get("amount", 0))
                except (TypeError, ValueError):
                    continue

                if sender == address:
                    balance -= amount
                if receiver == address:
                    balance += amount

        return balance

    def is_chain_valid(self):
        # Start from index 1 because genesis block has no previous block link.
        for i in range(1, len(self.chain)):
            current_block = self.chain[i]
            previous_block = self.chain[i - 1]

            # prev_hash is the chain link. If it does not match the previous
            # block hash, the ledger sequence has been broken/tampered.
            if current_block.prev_hash != previous_block.block_hash:
                return False

            # Recalculate hash from block contents to verify immutability.
            # Any post-mining change in transactions/nonce/time/prev_hash
            # produces a different digest and must invalidate the chain.
            recalculated_hash = current_block.cal_hash()
            if current_block.block_hash != recalculated_hash:
                return False

            # Validation must use difficulty stored in each block. This mirrors
            # real blockchains where historical blocks keep the difficulty that
            # existed when they were mined, even after later adjustments.
            block_difficulty = getattr(current_block, "difficulty", self.difficulty)
            if not current_block.block_hash.startswith("0" * block_difficulty):
                return False

        return True

    def _build_chain_from_data(self, chain_data):
        if not isinstance(chain_data, list):
            raise ValueError("chain data must be a list")

        rebuilt_chain = []
        for item in chain_data:
            if not isinstance(item, dict):
                raise ValueError("invalid block data in chain")

            transactions = item.get("transaction", item.get("transactions", []))
            prev_hash = item.get("prev_hash")
            difficulty = item.get("difficulty", self.difficulty)

            # Create a block shell and then hydrate from serialized data so
            # hashes validate against the original timestamps and nonces.
            candidate = block(
                index=item.get("index"),
                transactions=transactions,
                prev_hash=prev_hash,
                difficulty=difficulty,
                nonce=item.get("nonce", 0)
            )
            candidate.time_stamp = item.get("time_stamp", candidate.time_stamp)
            candidate.block_hash = item.get("block_hash", candidate.block_hash)
            candidate.transaction = transactions
            candidate.transactions = transactions
            candidate.difficulty = int(difficulty) if difficulty is not None else self.difficulty
            rebuilt_chain.append(candidate)

        return rebuilt_chain

    def resolve_conflicts(self):
        """
        Consensus means the network agrees on a single shared history even if
        multiple nodes mined competing blocks. When a fork happens (two chains
        diverge), we resolve it by preferring the longest valid chain because
        it represents the most cumulative proof-of-work effort.
        """
        if not self.nodes:
            return False

        longest_chain = None
        max_length = len(self.chain)

        for node in self.nodes:
            try:
                response = requests.get(f"{node}/chain", timeout=4)
            except requests.RequestException:
                continue

            if response.status_code != 200:
                continue

            try:
                data = response.json()
            except ValueError:
                continue

            length = data.get("length")
            chain_data = data.get("chain")
            if not isinstance(length, int) or not isinstance(chain_data, list):
                continue

            if length <= max_length:
                continue

            try:
                candidate_chain = self._build_chain_from_data(chain_data)
            except ValueError:
                continue

            verifier = Blockchain()
            verifier.chain = candidate_chain

            if verifier.is_chain_valid():
                max_length = length
                longest_chain = candidate_chain

        if longest_chain:
            self.chain = longest_chain
            return True

        return False

blk=Blockchain()
#print(blk.is_valid_chain())
