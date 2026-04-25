import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";

const REQUESTS_FILE = "./requests.json";

function loadRequests() {
  if (!fs.existsSync(REQUESTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8"));
}

function saveRequests(requests) {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2));
}
dotenv.config();
console.log("ENV:", process.env.PORT, process.env.RPC_URL, process.env.CONTRACT_ADDRESS);
const app = express();
app.use(cors());
app.use(express.json());
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const providerInfura = new ethers.JsonRpcProvider(process.env.RPC_URL_INFURA);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractABI = [
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "_to", "type": "address" }, { "internalType": "string", "name": "_location", "type": "string" }, { "internalType": "uint256", "name": "_area", "type": "uint256" }], "name": "verifyAndMintLand", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "totalLands", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_tokenId", "type": "uint256" }], "name": "getLand", "outputs": [{ "components": [{ "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "string", "name": "location", "type": "string" }, { "internalType": "uint256", "name": "areaSqMeters", "type": "uint256" }, { "internalType": "uint256", "name": "price", "type": "uint256" }, { "internalType": "bool", "name": "forSale", "type": "bool" }], "internalType": "struct SecureLandRegistry.Land", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_tokenId", "type": "uint256" }], "name": "landOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "_price", "type": "uint256" }], "name": "listLandForSale", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_tokenId", "type": "uint256" }], "name": "buyLand", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": false, "internalType": "string", "name": "location", "type": "string" }, { "indexed": false, "internalType": "uint256", "name": "areaSqMeters", "type": "uint256" }], "name": "LandMinted", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "seller", "type": "address" }, { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }], "name": "LandSold", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }], "name": "LandListed", "type": "event" }
];
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS,
  contractABI, wallet);
const contractRead = new ethers.Contract(process.env.CONTRACT_ADDRESS,
  contractABI, provider);
const contractReadInfura = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, providerInfura);
app.get("/", (req, res) => {
  res.json({ message: "Teranga Land backend running" });
});

async function getBlockTimestamp(blockNumber) {
  const block = await provider.getBlock(blockNumber);
  return block ? new Date(block.timestamp * 1000).toLocaleString("fr-FR") : "—";
}

let historyCache = null;
let historyCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute

app.get("/lands", async (req, res) => {
  try {
    const total = Number(await contractRead.totalLands());
    const lands = [];
    for (let i = 1; i <= total; i++) {
      const land = await contractRead.getLand(i);
      const owner = await contractRead.landOwner(i);
      lands.push({
        id: Number(land.id),
        location: land.location,
        areaSqMeters: Number(land.areaSqMeters),
        price: ethers.formatEther(land.price),
        forSale: land.forSale,
        owner
      });
    }
    res.json(lands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/admin/mint", async (req, res) => {
  try {
    const { to, location, areaSqMeters } = req.body;
    const tx = await contract.verifyAndMintLand(to, location, areaSqMeters);
    const receipt = await tx.wait();
    res.json({ success: true, hash: receipt.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const PORT = process.env.PORT || 5000;

app.get("/lands/:id/history", async (req, res) => {
  try {
    const tokenId = Number(req.params.id);
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 50000);

    const [mints, sales, listings] = await Promise.all([
      contractReadInfura.queryFilter(contractReadInfura.filters.LandMinted(tokenId), fromBlock, latestBlock),
      contractReadInfura.queryFilter(contractReadInfura.filters.LandSold(tokenId), fromBlock, latestBlock),
      contractReadInfura.queryFilter(contractReadInfura.filters.LandListed(tokenId), fromBlock, latestBlock)
    ]);

    const allEvents = [
      ...mints.map(e => ({ type: "Création", tokenId: Number(e.args.tokenId), from: e.args.owner, location: e.args.location, tx: e.transactionHash, block: e.blockNumber })),
      ...sales.map(e => ({ type: "Achat", tokenId: Number(e.args.tokenId), from: e.args.seller, to: e.args.buyer, price: ethers.formatEther(e.args.price), tx: e.transactionHash, block: e.blockNumber })),
      ...listings.map(e => ({ type: "Mise en vente", tokenId: Number(e.args.tokenId), price: ethers.formatEther(e.args.price), tx: e.transactionHash, block: e.blockNumber }))
    ].sort((a, b) => b.block - a.block);

    const history = await Promise.all(
      allEvents.map(async (e) => ({
        ...e,
        date: await getBlockTimestamp(e.block)
      }))
    );

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get("/history", async (req, res) => {
  try {
    const now = Date.now();
    if (historyCache && now - historyCacheTime < CACHE_DURATION) {
      return res.json(historyCache);
    }

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000);

    const [mints, sales, listings] = await Promise.all([
      contractReadInfura.queryFilter(contractReadInfura.filters.LandMinted(), fromBlock, currentBlock),
      contractReadInfura.queryFilter(contractReadInfura.filters.LandSold(), fromBlock, currentBlock),
      contractReadInfura.queryFilter(contractReadInfura.filters.LandListed(), fromBlock, currentBlock)
    ]);

    const allEvents = [
      ...mints.map(e => ({ type: "Création", tokenId: Number(e.args.tokenId), from: e.args.owner, location: e.args.location, tx: e.transactionHash, block: e.blockNumber })),
      ...sales.map(e => ({ type: "Achat", tokenId: Number(e.args.tokenId), from: e.args.seller, to: e.args.buyer, price: ethers.formatEther(e.args.price), tx: e.transactionHash, block: e.blockNumber })),
      ...listings.map(e => ({ type: "Mise en vente", tokenId: Number(e.args.tokenId), price: ethers.formatEther(e.args.price), tx: e.transactionHash, block: e.blockNumber }))
    ].sort((a, b) => b.block - a.block);

    const history = [];
    for (const e of allEvents) {
      const date = await getBlockTimestamp(e.block);
      history.push({ ...e, date });
      await new Promise(r => setTimeout(r, 100));
    }

    historyCache = history;
    historyCacheTime = Date.now();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit a land registration request
app.post("/requests", (req, res) => {
  try {
    const { owner, location, areaSqMeters, description } = req.body;
    const requests = loadRequests();
    const newRequest = {
      id: Date.now(),
      owner,
      location,
      areaSqMeters,
      description,
      status: "pending",
      createdAt: new Date().toLocaleString("fr-FR")
    };
    requests.push(newRequest);
    saveRequests(requests);
    res.json({ success: true, request: newRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all requests (admin only)
app.get("/requests", (req, res) => {
  try {
    const requests = loadRequests();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve a request (mint the land)
app.post("/requests/:id/approve", async (req, res) => {
  try {
    const requests = loadRequests();
    const request = requests.find(r => r.id === Number(req.params.id));
    if (!request) return res.status(404).json({ error: "Request not found" });
    const tx = await contract.verifyAndMintLand(request.owner, request.location, request.areaSqMeters);
    const receipt = await tx.wait();
    request.status = "approved";
    request.tx = receipt.hash;
    saveRequests(requests);
    res.json({ success: true, hash: receipt.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject a request
app.post("/requests/:id/reject", (req, res) => {
  try {
    const requests = loadRequests();
    const request = requests.find(r => r.id === Number(req.params.id));
    if (!request) return res.status(404).json({ error: "Request not found" });
    request.status = "rejected";
    saveRequests(requests);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/owner", async (req, res) => {
  try {
    const owner = await contractRead.owner();
    res.json({ owner });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);
});


// DEBUG TEST
contractRead.totalLands().then(result => {
  console.log("totalLands result:", result);
}).catch(err => {
  console.log("totalLands error:", err.message);
});