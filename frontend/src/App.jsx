import { useEffect, useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "./contract";

export default function App() {
  const [account, setAccount] = useState("");
  const [lands, setLands] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLand, setSelectedLand] = useState(null);
  const [landHistory, setLandHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [mintForm, setMintForm] = useState({ to: "", location: "", areaSqMeters: "" });
  const [saleForm, setSaleForm] = useState({ tokenId: "", price: "" });

  const backendURL = "http://localhost:5000";

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask non détecté");
      return;
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
  };

  const loadLands = async () => {
    try {
      const res = await axios.get(`${backendURL}/lands`);
      setLands(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${backendURL}/history`);
      setHistory(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const openLandDetail = async (land) => {
    setSelectedLand(land);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${backendURL}/lands/${land.id}/history`);
      const sorted = res.data.sort((a, b) => b.block - a.block);
      setLandHistory(sorted);
    } catch (error) {
      console.error(error);
    }
    setLoadingHistory(false);
  };

  const closeLandDetail = () => {
    setSelectedLand(null);
    setLandHistory([]);
  };

  useEffect(() => {
    loadLands();
    loadHistory();
  }, []);

  const mintLand = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${backendURL}/admin/mint`, mintForm);
      alert("Terrain créé avec succès");
      setMintForm({ to: "", location: "", areaSqMeters: "" });
      loadLands();
      loadHistory();
    } catch (error) {
      alert(error.response?.data?.error || error.message);
    }
    setLoading(false);
  };

  const listForSale = async (e) => {
    e.preventDefault();
    try {
      if (!window.ethereum) return alert("MetaMask requis");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.listLandForSale(saleForm.tokenId, ethers.parseEther(saleForm.price));
      await tx.wait();
      alert("Terrain mis en vente");
      setSaleForm({ tokenId: "", price: "" });
      loadLands();
      loadHistory();
    } catch (error) {
      alert(error.reason || error.message);
    }
  };

  const buyLand = async (id, price) => {
    try {
      if (!window.ethereum) return alert("MetaMask requis");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.buyLand(id, { value: ethers.parseEther(price) });
      await tx.wait();
      alert("Achat effectué avec succès");
      loadLands();
      loadHistory();
      if (selectedLand?.id === id) openLandDetail({ ...selectedLand });
    } catch (error) {
      alert(error.reason || error.message);
    }
  };

  const getBadgeColor = (type) => {
    if (type === "Création") return "bg-yellow-400 text-slate-900";
    if (type === "Achat") return "bg-emerald-500 text-white";
    if (type === "Mise en vente") return "bg-pink-500 text-white";
    return "bg-gray-500 text-white";
  };

  const getTypeIcon = (type) => {
    if (type === "Création") return "🏗️";
    if (type === "Achat") return "🤝";
    if (type === "Mise en vente") return "🏷️";
    return "📋";
  };

  // DETAIL PAGE
  if (selectedLand) {
    return (
      <div className="min-h-screen text-white p-6">
        <div className="max-w-4xl mx-auto">

          <button
            onClick={closeLandDetail}
            className="mb-6 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 font-semibold flex items-center gap-2"
          >
            ← Retour
          </button>

          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 mb-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold">Terrain #{selectedLand.id}</h1>
              <span className={`px-4 py-2 rounded-full font-bold ${selectedLand.forSale ? "bg-emerald-500" : "bg-gray-500"}`}>
                {selectedLand.forSale ? "En vente" : "Non disponible"}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-2xl p-4">
                <p className="text-white/60 text-sm mb-1">Localisation</p>
                <p className="text-xl font-bold">📍 {selectedLand.location}</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4">
                <p className="text-white/60 text-sm mb-1">Surface</p>
                <p className="text-xl font-bold">📐 {selectedLand.areaSqMeters} m²</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4">
                <p className="text-white/60 text-sm mb-1">Propriétaire actuel</p>
                <p className="font-mono text-sm break-all">{selectedLand.owner}</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4">
                <p className="text-white/60 text-sm mb-1">Prix</p>
                <p className="text-xl font-bold text-yellow-300">
                  {selectedLand.forSale ? `💰 ${selectedLand.price} ETH` : "—"}
                </p>
              </div>
            </div>
            {selectedLand.forSale && (
              <button
                onClick={() => buyLand(selectedLand.id, selectedLand.price)}
                className="mt-4 w-full p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-bold text-lg"
              >
                Acheter ce terrain
              </button>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-2">Historique complet du terrain</h2>
            <p className="text-white/50 text-sm mb-6">Trié du plus récent au plus ancien</p>

            {loadingHistory && (
              <p className="text-white/60 text-center py-4">Chargement...</p>
            )}

            {!loadingHistory && landHistory.length === 0 && (
              <p className="text-white/60 text-center py-4">Aucune transaction trouvée</p>
            )}

            <div className="relative">
              {landHistory.map((item, index) => (
                <div key={index} className="flex gap-4 mb-6 relative">
                  {index < landHistory.length - 1 && (
                    <div className="absolute left-5 top-10 w-0.5 h-full bg-white/20"></div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0 z-10">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1 bg-slate-900/60 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className={`text-sm px-3 py-1 rounded-full font-bold ${getBadgeColor(item.type)}`}>
                        {item.type}
                      </span>
                      {item.date && (
                        <span className="text-white/50 text-sm">🕐 {item.date}</span>
                      )}
                    </div>

                    {item.type === "Création" && (
                      <div className="space-y-1">
                        <p className="text-sm text-white/70">Propriétaire initial</p>
                        <p className="font-mono text-sm break-all">{item.from}</p>
                        <p className="text-sm text-white/70 mt-2">Localisation : <span className="text-white">{item.location}</span></p>
                      </div>
                    )}
                    {item.type === "Mise en vente" && (
                      <div className="space-y-1">
                        <p className="text-sm text-white/70">Prix de vente</p>
                        <p className="text-yellow-300 font-bold">💰 {item.price} ETH</p>
                      </div>
                    )}
                    {item.type === "Achat" && (
                      <div className="space-y-1">
                        <p className="text-sm text-white/70">Vendeur</p>
                        <p className="font-mono text-sm break-all">{item.from}</p>
                        <p className="text-sm text-white/70 mt-2">Acheteur</p>
                        <p className="font-mono text-sm break-all">{item.to}</p>
                        <p className="text-yellow-300 font-bold mt-2">💰 {item.price} ETH</p>
                      </div>
                    )}

                    <a
                      href={`https://sepolia.etherscan.io/tx/${item.tx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-sky-400 hover:text-sky-300 text-sm underline"
                    >
                      Voir la transaction sur Etherscan →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN PAGE
  return (
    <div className="min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold">Teranga Land</h1>
              <p className="text-white/80 mt-2">Registre foncier web3 sécurisé et moderne</p>
            </div>
            <button
              onClick={connectWallet}
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-semibold shadow-lg"
            >
              {account ? `Connecté: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connecter MetaMask"}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <form onSubmit={mintLand} className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-4">Créer un terrain</h2>
            <div className="space-y-3">
              <input className="w-full p-3 rounded-2xl text-black" placeholder="Adresse du propriétaire" value={mintForm.to} onChange={(e) => setMintForm({ ...mintForm, to: e.target.value })} />
              <input className="w-full p-3 rounded-2xl text-black" placeholder="Localisation" value={mintForm.location} onChange={(e) => setMintForm({ ...mintForm, location: e.target.value })} />
              <input className="w-full p-3 rounded-2xl text-black" placeholder="Surface en m²" value={mintForm.areaSqMeters} onChange={(e) => setMintForm({ ...mintForm, areaSqMeters: e.target.value })} />
              <button className="w-full p-3 rounded-2xl bg-yellow-400 text-slate-900 font-bold hover:bg-yellow-300">
                {loading ? "Création..." : "Créer le terrain"}
              </button>
            </div>
          </form>

          <form onSubmit={listForSale} className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-4">Mettre en vente</h2>
            <div className="space-y-3">
              <input className="w-full p-3 rounded-2xl text-black" placeholder="ID du terrain" value={saleForm.tokenId} onChange={(e) => setSaleForm({ ...saleForm, tokenId: e.target.value })} />
              <input className="w-full p-3 rounded-2xl text-black" placeholder="Prix en ETH" value={saleForm.price} onChange={(e) => setSaleForm({ ...saleForm, price: e.target.value })} />
              <button className="w-full p-3 rounded-2xl bg-pink-500 hover:bg-pink-600 font-bold">
                Mettre en vente
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Liste des terrains</h2>
            <button onClick={() => { loadLands(); loadHistory(); }} className="px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600 font-semibold">
              Actualiser
            </button>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {lands.map((land) => (
              <div key={land.id} className="bg-slate-900/60 rounded-3xl p-5 border border-white/10 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm bg-white/10 px-3 py-1 rounded-full">Terrain #{land.id}</span>
                  <span className={`text-sm px-3 py-1 rounded-full ${land.forSale ? "bg-emerald-500" : "bg-gray-500"}`}>
                    {land.forSale ? "En vente" : "Non disponible"}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{land.location}</h3>
                <p className="text-white/80">Surface : {land.areaSqMeters} m²</p>
                <p className="text-white/80 break-all">Propriétaire : {land.owner.slice(0, 6)}...{land.owner.slice(-4)}</p>
                <p className="text-yellow-300 font-bold mt-2">Prix : {land.price} ETH</p>
                <div className="mt-4 flex gap-3">
                  <button
                    disabled={!land.forSale}
                    onClick={() => buyLand(land.id, land.price)}
                    className="flex-1 p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 font-bold"
                  >
                    Acheter
                  </button>
                  <button
                    onClick={() => openLandDetail(land)}
                    className="flex-1 p-3 rounded-2xl bg-sky-500 hover:bg-sky-600 font-bold"
                  >
                    Voir détails
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold mb-2">Historique global des transactions</h2>
          <p className="text-white/50 text-sm mb-6">Trié du plus récent au plus ancien</p>
          <div className="space-y-3">
            {history.length === 0 && (
              <p className="text-white/60 text-center py-4">Aucune transaction trouvée</p>
            )}
            {history.map((item, index) => (
              <div key={index} className="bg-slate-900/60 rounded-2xl p-4 border border-white/10 flex flex-col md:flex-row md:items-center gap-3">
                {item.date && (
                  <span className="text-white/40 text-xs min-w-fit">🕐 {item.date}</span>
                )}
                <span className={`text-sm px-3 py-1 rounded-full font-bold w-fit ${getBadgeColor(item.type)}`}>
                  {item.type}
                </span>
                <button
                  onClick={() => { const land = lands.find(l => l.id === item.tokenId); if (land) openLandDetail(land); }}
                  className="font-bold hover:text-sky-300 text-left"
                >
                  Terrain #{item.tokenId} →
                </button>
                {item.location && <span className="text-white/70">📍 {item.location}</span>}
                {item.price && <span className="text-yellow-300 font-bold">💰 {item.price} ETH</span>}
                {item.to && <span className="text-white/70 text-sm">→ {item.to.slice(0, 6)}...{item.to.slice(-4)}</span>}
                <a
                  href={`https://sepolia.etherscan.io/tx/${item.tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-sky-400 hover:text-sky-300 text-sm underline"
                >
                  Voir sur Etherscan
                </a>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
