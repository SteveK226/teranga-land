import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config();
console.log("ENV:", process.env.PORT, process.env.RPC_URL, process.env.CONTRACT_ADDRESS);
const app = express();
app.use(cors());
app.use(express.json());
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractABI = [
  {"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"string","name":"_location","type":"string"},{"internalType":"uint256","name":"_area","type":"uint256"}],"name":"verifyAndMintLand","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"totalLands","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"getLand","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"string","name":"location","type":"string"},{"internalType":"uint256","name":"areaSqMeters","type":"uint256"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"bool","name":"forSale","type":"bool"}],"internalType":"struct SecureLandRegistry.Land","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"landOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"uint256","name":"_price","type":"uint256"}],"name":"listLandForSale","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"buyLand","outputs":[],"stateMutability":"payable","type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"string","name":"location","type":"string"},{"indexed":false,"internalType":"uint256","name":"areaSqMeters","type":"uint256"}],"name":"LandMinted","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"}],"name":"LandSold","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"}],"name":"LandListed","type":"event"}
];
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS,
contractABI, wallet);
const contractRead = new ethers.Contract(process.env.CONTRACT_ADDRESS,
contractABI, provider);
app.get("/", (req, res) => {
res.json({ message: "Teranga Land backend running" });
});
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
      contractRead.queryFilter(contractRead.filters.LandMinted(tokenId), fromBlock, latestBlock),
      contractRead.queryFilter(contractRead.filters.LandSold(tokenId), fromBlock, latestBlock),
      contractRead.queryFilter(contractRead.filters.LandListed(tokenId), fromBlock, latestBlock)
    ]);

    const history = [
      ...mints.map(e => ({
        type: "Création",
        tokenId: Number(e.args.tokenId),
        from: e.args.owner,
        location: e.args.location,
        tx: e.transactionHash,
        block: e.blockNumber
      })),
      ...sales.map(e => ({
        type: "Achat",
        tokenId: Number(e.args.tokenId),
        from: e.args.seller,
        to: e.args.buyer,
        price: ethers.formatEther(e.args.price),
        tx: e.transactionHash,
        block: e.blockNumber
      })),
      ...listings.map(e => ({
        type: "Mise en vente",
        tokenId: Number(e.args.tokenId),
        price: ethers.formatEther(e.args.price),
        tx: e.transactionHash,
        block: e.blockNumber
      }))
    ].sort((a, b) => a.block - b.block);

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get("/history", async (req, res) => {
  try {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 50000);

    const [mints, sales, listings] = await Promise.all([
      contractRead.queryFilter(contractRead.filters.LandMinted(), fromBlock, latestBlock),
      contractRead.queryFilter(contractRead.filters.LandSold(), fromBlock, latestBlock),
      contractRead.queryFilter(contractRead.filters.LandListed(), fromBlock, latestBlock)
    ]);

    const history = [
      ...mints.map(e => ({
        type: "Création",
        tokenId: Number(e.args.tokenId),
        from: e.args.owner,
        location: e.args.location,
        tx: e.transactionHash
      })),
      ...sales.map(e => ({
        type: "Achat",
        tokenId: Number(e.args.tokenId),
        from: e.args.seller,
        to: e.args.buyer,
        price: ethers.formatEther(e.args.price),
        tx: e.transactionHash
      })),
      ...listings.map(e => ({
        type: "Mise en vente",
        tokenId: Number(e.args.tokenId),
        price: ethers.formatEther(e.args.price),
        tx: e.transactionHash
      }))
    ];

    res.json(history);
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