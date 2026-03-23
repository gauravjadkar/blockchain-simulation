import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:5000",
  headers: {
    "Content-Type": "application/json"
  }
})

export const getChain = () => API.get("/chain")
export const getPending = () => API.get("/pending")
export const getStats = () => API.get("/stats")
export const getBalance = (address) =>
  API.get(`/balance/${encodeURIComponent(address)}`)
export const validateChain = () => API.get("/validate")
export const getDifficulty = () => API.get("/difficulty")
export const setDifficulty = (difficulty) =>
  API.post("/set_difficulty", { difficulty })
export const tamperBlock = (index, newData) =>
  API.post("/tamper", { index, new_data: newData })
export const registerNode = (nodeUrl) =>
  API.post("/register_node", { node_url: nodeUrl })
export const getNodes = () => API.get("/nodes")
export const resolveConflicts = () => API.get("/resolve")
// Stage 1: send structured transaction payload.
export async function addTransaction(sender, receiver, amount) {
  const response = await fetch("http://127.0.0.1:5000/add_transaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender,
      receiver,
      amount
    })
  });

  return await response.json();
}

export const mineBlock = (minerName) =>
  API.post("/mine", {
    miner: minerName
  })
