import { useEffect, useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "./contract";

const BACKEND = "http://localhost:5000";

export default function App() {
  const [account, setAccount] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [lands, setLands] = useState([]);
  const [history, setHistory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedLand, setSelectedLand] = useState(null);
  const [landHistory, setLandHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingApprove, setLoadingApprove] = useState(null);
  const [requestForm, setRequestForm] = useState({ owner: "", location: "", areaSqMeters: "", description: "" });
  const [saleForm, setSaleForm] = useState({ tokenId: "", price: "" });
  const [requestSent, setRequestSent] = useState(false);
  const [page, setPage] = useState("accueil");
  const [menuOpen, setMenuOpen] = useState(false);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("MetaMask non détecté");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const connectedAccount = accounts[0];
    setAccount(connectedAccount);
    setRequestForm(f => ({ ...f, owner: connectedAccount }));
    const res = await axios.get(`${BACKEND}/owner`);
    setIsOwner(res.data.owner.toLowerCase() === connectedAccount.toLowerCase());
  };

  const loadLands = async () => {
    try { const res = await axios.get(`${BACKEND}/lands`); setLands(res.data); }
    catch (error) { console.error(error); }
  };

  const loadHistory = async () => {
    try { const res = await axios.get(`${BACKEND}/history`); setHistory(res.data); }
    catch (error) { console.error(error); }
  };

  const loadRequests = async () => {
    try { const res = await axios.get(`${BACKEND}/requests`); setRequests(res.data); }
    catch (error) { console.error(error); }
  };

  const openLandDetail = async (land) => {
    setSelectedLand(land);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${BACKEND}/lands/${land.id}/history`);
      setLandHistory(res.data.sort((a, b) => b.block - a.block));
    } catch (error) { console.error(error); }
    setLoadingHistory(false);
  };

  const closeLandDetail = () => { setSelectedLand(null); setLandHistory([]); };

  useEffect(() => { loadLands(); loadHistory(); loadRequests(); }, []);

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${BACKEND}/requests`, requestForm);
      setRequestSent(true);
      setRequestForm({ owner: account, location: "", areaSqMeters: "", description: "" });
      loadRequests();
    } catch (error) { alert(error.response?.data?.error || error.message); }
  };

  const approveRequest = async (id) => {
    setLoadingApprove(id);
    try {
      await axios.post(`${BACKEND}/requests/${id}/approve`);
      alert("Terrain approuvé");
      loadRequests(); loadLands(); loadHistory();
    } catch (error) { alert(error.response?.data?.error || error.message); }
    setLoadingApprove(null);
  };

  const rejectRequest = async (id) => {
    try { await axios.post(`${BACKEND}/requests/${id}/reject`); loadRequests(); }
    catch (error) { alert(error.response?.data?.error || error.message); }
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
      loadLands(); loadHistory();
    } catch (error) { alert(error.reason || error.message); }
  };

  const buyLand = async (id, price) => {
    try {
      if (!window.ethereum) return alert("MetaMask requis");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.buyLand(id, { value: ethers.parseEther(price) });
      await tx.wait();
      alert("Achat effectué");
      loadLands(); loadHistory();
      if (selectedLand?.id === id) openLandDetail({ ...selectedLand });
    } catch (error) { alert(error.reason || error.message); }
  };

  const getStatusColor = (status) => {
    if (status === "pending") return "bg-yellow-100 text-yellow-800 border border-yellow-300";
    if (status === "approved") return "bg-green-100 text-green-800 border border-green-300";
    if (status === "rejected") return "bg-red-100 text-red-800 border border-red-300";
    return "bg-gray-100 text-gray-600";
  };

  const getStatusLabel = (status) => {
    if (status === "pending") return "En attente";
    if (status === "approved") return "Approuvé";
    if (status === "rejected") return "Rejeté";
    return status;
  };

  const getTypeBadge = (type) => {
    if (type === "Création") return "bg-green-100 text-green-800 border border-green-200";
    if (type === "Achat") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    if (type === "Mise en vente") return "bg-teal-100 text-teal-800 border border-teal-200";
    return "bg-gray-100 text-gray-600";
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const myLands = account ? lands.filter(l => l.owner.toLowerCase() === account.toLowerCase()) : [];
  const myRequests = account ? requests.filter(r => r.owner.toLowerCase() === account.toLowerCase()) : [];

  const navItems = [
    { id: "accueil", label: "Accueil" },
    { id: "terrains", label: "Terrains" },
    ...(account ? [{ id: "mes_terrains", label: "Mes terrains", badge: myLands.length > 0 ? myLands.length : null }] : []),
    { id: "historique", label: "Historique" },
    { id: "demande", label: "Enregistrement" },
    ...(isOwner ? [{ id: "admin", label: "Admin", badge: pendingCount > 0 ? pendingCount : null, isAdmin: true }] : []),
  ];

  const Navbar = ({ showBack = false }) => (
    <nav className="bg-white border-b border-green-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white text-xs font-bold">TL</div>
            <span className="text-green-800 font-bold text-base hidden sm:block">Teranga Land</span>
          </div>

          {showBack ? (
            <button onClick={closeLandDetail} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-sm font-medium text-green-700 transition-all">
              Retour
            </button>
          ) : (
            <>
              <div className="hidden lg:flex items-center gap-1 flex-1">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setPage(item.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      page === item.id
                        ? "bg-green-600 text-white"
                        : "text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {item.label}
                    {item.badge && (
                      <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${item.isAdmin ? "bg-yellow-400 text-yellow-900" : "bg-white text-green-700"}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden ml-auto p-2 rounded-lg border border-green-200 text-green-700 text-sm hover:bg-green-50">
                {menuOpen ? "Fermer" : "Menu"}
              </button>
            </>
          )}

          <div className="ml-auto hidden lg:flex items-center gap-2">
            {isOwner && <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium">Administrateur</span>}
            <button
              onClick={connectWallet}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                account
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-green-600 bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${account ? "bg-green-500" : "bg-white/50"}`}></span>
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connecter"}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden pb-3 space-y-1 border-t border-green-100 pt-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  page === item.id ? "bg-green-600 text-white" : "text-green-700 hover:bg-green-50"
                }`}
              >
                {item.label}
                {item.badge && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${item.isAdmin ? "bg-yellow-400 text-yellow-900" : "bg-green-100 text-green-700"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={connectWallet}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border mt-1 ${
                account ? "border-green-200 bg-green-50 text-green-700" : "border-green-600 bg-green-600 text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${account ? "bg-green-500" : "bg-white/50"}`}></span>
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connecter MetaMask"}
              {isOwner && <span className="ml-auto text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Admin</span>}
            </button>
          </div>
        )}
      </div>
    </nav>
  );

  const LandCard = ({ land, showBuy = true }) => (
    <div className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-green-600 font-medium border border-green-200 px-2 py-0.5 rounded-full">Terrain #{land.id}</span>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${land.forSale ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
          {land.forSale ? "En vente" : "Indisponible"}
        </span>
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-2">{land.location}</h3>
      <div className="space-y-1 mb-4">
        <p className="text-gray-500 text-sm">Surface : <span className="text-gray-800 font-medium">{land.areaSqMeters} m²</span></p>
        <p className="text-gray-500 text-sm">Propriétaire : <span className="font-mono text-gray-700 text-xs">{land.owner.slice(0, 6)}...{land.owner.slice(-4)}</span></p>
        {land.forSale && <p className="text-green-700 font-bold text-sm">{land.price} ETH</p>}
      </div>
      <div className="flex gap-2">
        {showBuy && (
          <button disabled={!land.forSale} onClick={() => buyLand(land.id, land.price)} className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-semibold text-sm transition-all">
            Acheter
          </button>
        )}
        <button onClick={() => openLandDetail(land)} className="flex-1 py-2 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 font-semibold text-sm transition-all">
          Voir détails
        </button>
      </div>
    </div>
  );

  const InputField = ({ label, ...props }) => (
    <div>
      {label && <label className="text-gray-500 text-xs uppercase tracking-wider mb-1.5 block">{label}</label>}
      <input className="w-full p-3 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-100 text-sm transition-all" {...props} />
    </div>
  );

  // DETAIL PAGE
  if (selectedLand) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar showBack={true} />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 mb-5 border border-green-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-gray-400 text-xs mb-1">Terrain enregistré sur la blockchain</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">#{selectedLand.id} — {selectedLand.location}</h1>
              </div>
              <span className={`w-fit text-xs px-3 py-1.5 rounded-full font-medium border ${selectedLand.forSale ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                {selectedLand.forSale ? "En vente" : "Non disponible"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 rounded-xl p-3 border border-green-100"><p className="text-green-600 text-xs mb-1 uppercase tracking-wider">Localisation</p><p className="font-semibold text-gray-800">{selectedLand.location}</p></div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-100"><p className="text-green-600 text-xs mb-1 uppercase tracking-wider">Surface</p><p className="font-semibold text-gray-800">{selectedLand.areaSqMeters} m²</p></div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-100"><p className="text-green-600 text-xs mb-1 uppercase tracking-wider">Propriétaire actuel</p><p className="font-mono text-xs text-gray-600 break-all">{selectedLand.owner}</p></div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-100"><p className="text-green-600 text-xs mb-1 uppercase tracking-wider">Prix</p><p className="font-bold text-gray-800">{selectedLand.forSale ? `${selectedLand.price} ETH` : "—"}</p></div>
            </div>
            {selectedLand.forSale && (
              <button onClick={() => buyLand(selectedLand.id, selectedLand.price)} className="w-full p-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all">
                Acheter ce terrain
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-green-100 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-800">Historique du terrain</h2>
              <p className="text-gray-400 text-xs mt-1">Toutes les transactions enregistrées sur la blockchain</p>
            </div>
            {loadingHistory && <p className="text-gray-400 text-center py-8 text-sm">Chargement...</p>}
            {!loadingHistory && landHistory.length === 0 && <p className="text-gray-400 text-center py-8 text-sm">Aucune transaction trouvée</p>}
            <div className="relative">
              {landHistory.map((item, index) => (
                <div key={index} className="flex gap-3 mb-4 relative">
                  {index < landHistory.length - 1 && <div className="absolute left-4 top-9 w-px h-full bg-green-100"></div>}
                  <div className="w-9 h-9 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0 z-10">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getTypeBadge(item.type)}`}>{item.type}</span>
                      {item.date && <span className="text-gray-400 text-xs">{item.date}</span>}
                    </div>
                    {item.type === "Création" && <div><p className="text-gray-400 text-xs mb-0.5">Propriétaire initial</p><p className="font-mono text-xs text-gray-600 break-all">{item.from}</p></div>}
                    {item.type === "Mise en vente" && <p className="text-green-700 font-bold text-sm">{item.price} ETH</p>}
                    {item.type === "Achat" && (
                      <div className="space-y-1">
                        <p className="text-gray-400 text-xs">Vendeur : <span className="font-mono text-gray-600">{item.from.slice(0,6)}...{item.from.slice(-4)}</span></p>
                        <p className="text-gray-400 text-xs">Acheteur : <span className="font-mono text-gray-600">{item.to.slice(0,6)}...{item.to.slice(-4)}</span></p>
                        <p className="text-green-700 font-bold text-sm">{item.price} ETH</p>
                      </div>
                    )}
                    <a href={`https://sepolia.etherscan.io/tx/${item.tx}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-green-600 hover:text-green-800 text-xs underline transition-all">
                      Voir sur Etherscan
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">

        {/* ACCUEIL */}
        {page === "accueil" && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-2">Bienvenue sur Teranga Land</h2>
              <p className="text-gray-500 text-sm sm:text-base">Registre foncier décentralisé sur la blockchain Ethereum</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <form onSubmit={submitRequest} className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-800">Demande d'enregistrement</h2>
                  <p className="text-gray-400 text-xs mt-0.5">Soumettez votre terrain pour validation</p>
                </div>
                <div className="space-y-3">
                  <InputField placeholder="Votre adresse wallet" value={requestForm.owner} onChange={(e) => setRequestForm({ ...requestForm, owner: e.target.value })} />
                  <InputField placeholder="Localisation" value={requestForm.location} onChange={(e) => setRequestForm({ ...requestForm, location: e.target.value })} />
                  <InputField placeholder="Surface en m²" value={requestForm.areaSqMeters} onChange={(e) => setRequestForm({ ...requestForm, areaSqMeters: e.target.value })} />
                  <textarea className="w-full p-3 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-green-400 text-sm transition-all" placeholder="Description du terrain..." rows={3} value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} />
                  {requestSent && <p className="text-green-600 text-xs font-semibold">Demande envoyée avec succès. En attente de validation.</p>}
                  <button className="w-full p-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-all text-sm">Soumettre la demande</button>
                </div>
              </form>

              <form onSubmit={listForSale} className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-800">Mettre en vente</h2>
                  <p className="text-gray-400 text-xs mt-0.5">Listez votre terrain sur le marché</p>
                </div>
                <div className="space-y-3">
                  <InputField placeholder="ID du terrain" value={saleForm.tokenId} onChange={(e) => setSaleForm({ ...saleForm, tokenId: e.target.value })} />
                  <InputField placeholder="Prix en ETH" value={saleForm.price} onChange={(e) => setSaleForm({ ...saleForm, price: e.target.value })} />
                  <button className="w-full p-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-all text-sm">Mettre en vente</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TERRAINS */}
        {page === "terrains" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Liste des terrains</h2>
                <p className="text-gray-400 text-xs mt-1">{lands.length} terrain{lands.length > 1 ? "s" : ""} enregistré{lands.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => { loadLands(); loadHistory(); }} className="px-3 py-2 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 font-medium text-sm transition-all">Actualiser</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {lands.map((land) => <LandCard key={land.id} land={land} />)}
            </div>
          </div>
        )}

        {/* MES TERRAINS */}
        {page === "mes_terrains" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Mes terrains</h2>
              <p className="text-gray-400 text-xs mt-1">{account ? `${myLands.length} terrain${myLands.length > 1 ? "s" : ""} possédé${myLands.length > 1 ? "s" : ""}` : "Connectez MetaMask"}</p>
            </div>

            {!account && (
              <div className="text-center py-12 bg-white rounded-2xl border border-green-100">
                <p className="text-gray-400 mb-4 text-sm">Connectez votre wallet pour voir vos terrains</p>
                <button onClick={connectWallet} className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-all">Connecter MetaMask</button>
              </div>
            )}

            {account && (
              <>
                <div className="mb-8">
                  <h3 className="text-base font-bold text-gray-700 mb-3 pb-2 border-b border-green-100">Terrains possédés</h3>
                  {myLands.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border border-green-100">
                      <p className="text-gray-400 text-sm">Vous ne possédez aucun terrain</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {myLands.map((land) => <LandCard key={land.id} land={land} showBuy={false} />)}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-700 mb-3 pb-2 border-b border-green-100">
                    Mes demandes d'enregistrement
                    {myRequests.length > 0 && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{myRequests.length}</span>}
                  </h3>
                  {myRequests.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border border-green-100">
                      <p className="text-gray-400 text-sm mb-3">Aucune demande soumise</p>
                      <button onClick={() => setPage("demande")} className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-all">Faire une demande</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myRequests.map((req) => (
                        <div key={req.id} className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(req.status)}`}>{getStatusLabel(req.status)}</span>
                            <span className="text-gray-400 text-xs">{req.createdAt}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                            <div><p className="text-gray-400 text-xs mb-0.5">Localisation</p><p className="font-semibold text-gray-800 text-sm">{req.location}</p></div>
                            <div><p className="text-gray-400 text-xs mb-0.5">Surface</p><p className="font-semibold text-gray-800 text-sm">{req.areaSqMeters} m²</p></div>
                            {req.description && <div className="sm:col-span-2"><p className="text-gray-400 text-xs mb-0.5">Description</p><p className="text-gray-600 text-sm">{req.description}</p></div>}
                          </div>
                          {req.status === "pending" && <p className="text-yellow-700 text-xs">En attente de validation par l'administrateur</p>}
                          {req.status === "approved" && req.tx && <a href={`https://sepolia.etherscan.io/tx/${req.tx}`} target="_blank" rel="noreferrer" className="text-green-600 hover:text-green-800 text-xs underline">Approuvé — Voir sur Etherscan</a>}
                          {req.status === "rejected" && <p className="text-red-600 text-xs">Demande rejetée par l'administrateur</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* HISTORIQUE */}
        {page === "historique" && (
          <div>
            <div className="mb-5">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Historique global</h2>
              <p className="text-gray-400 text-xs mt-1">Toutes les transactions, du plus récent au plus ancien</p>
            </div>
            <div className="space-y-2">
              {history.length === 0 && <p className="text-gray-400 text-center py-12 text-sm">Aucune transaction trouvée</p>}
              {history.map((item, index) => (
                <div key={index} className="bg-white rounded-xl p-3 border border-green-100 flex flex-wrap items-center gap-2 hover:border-green-200 hover:shadow-sm transition-all">
                  {item.date && <span className="text-gray-400 text-xs font-mono w-full sm:w-auto">{item.date}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getTypeBadge(item.type)}`}>{item.type}</span>
                  <button onClick={() => { const land = lands.find(l => l.id === item.tokenId); if (land) openLandDetail(land); }} className="font-semibold text-green-700 hover:text-green-900 text-sm transition-all">
                    Terrain #{item.tokenId}
                  </button>
                  {item.location && <span className="text-gray-500 text-xs">{item.location}</span>}
                  {item.price && <span className="text-green-700 font-semibold text-xs">{item.price} ETH</span>}
                  {item.to && <span className="text-gray-400 text-xs font-mono">{item.to.slice(0, 6)}...{item.to.slice(-4)}</span>}
                  <a href={`https://sepolia.etherscan.io/tx/${item.tx}`} target="_blank" rel="noreferrer" className="ml-auto text-green-600 hover:text-green-800 text-xs underline transition-all">Etherscan</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEMANDE */}
        {page === "demande" && (
          <div className="max-w-xl">
            <div className="mb-5">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Demande d'enregistrement</h2>
              <p className="text-gray-400 text-sm mt-1">Soumettez votre terrain pour validation par l'autorité compétente</p>
            </div>
            <form onSubmit={submitRequest} className="bg-white rounded-2xl p-5 sm:p-6 border border-green-100 shadow-sm">
              <div className="space-y-4">
                <InputField label="Adresse wallet" placeholder="0x..." value={requestForm.owner} onChange={(e) => setRequestForm({ ...requestForm, owner: e.target.value })} />
                <InputField label="Localisation" placeholder="Ex: Dakar, Plateau" value={requestForm.location} onChange={(e) => setRequestForm({ ...requestForm, location: e.target.value })} />
                <InputField label="Surface (m²)" placeholder="Ex: 500" value={requestForm.areaSqMeters} onChange={(e) => setRequestForm({ ...requestForm, areaSqMeters: e.target.value })} />
                <div>
                  <label className="text-gray-500 text-xs uppercase tracking-wider mb-1.5 block">Description et documents</label>
                  <textarea className="w-full p-3 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-green-400 text-sm transition-all" placeholder="Références cadastrales, documents officiels..." rows={4} value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} />
                </div>
                {requestSent && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-green-700 font-semibold text-sm">Demande envoyée avec succès</p>
                    <p className="text-green-600 text-xs mt-0.5">En attente de validation par l'autorité.</p>
                  </div>
                )}
                <button className="w-full p-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-all text-sm">Soumettre la demande</button>
              </div>
            </form>
          </div>
        )}

        {/* ADMIN */}
        {page === "admin" && isOwner && (
          <div>
            <div className="mb-5">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Tableau de bord administrateur</h2>
              <p className="text-gray-400 text-xs mt-1">{pendingCount} demande{pendingCount > 1 ? "s" : ""} en attente de validation</p>
            </div>
            {requests.length === 0 && <p className="text-gray-400 text-center py-12 text-sm">Aucune demande reçue</p>}
            <div className="space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-green-100 shadow-sm hover:border-green-200 transition-all">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(req.status)}`}>{getStatusLabel(req.status)}</span>
                    <span className="text-gray-400 text-xs">{req.createdAt}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div><p className="text-gray-400 text-xs mb-0.5">Demandeur</p><p className="font-mono text-xs text-gray-600 break-all">{req.owner}</p></div>
                    <div><p className="text-gray-400 text-xs mb-0.5">Localisation</p><p className="font-semibold text-gray-800 text-sm">{req.location}</p></div>
                    <div><p className="text-gray-400 text-xs mb-0.5">Surface</p><p className="font-semibold text-gray-800 text-sm">{req.areaSqMeters} m²</p></div>
                    <div><p className="text-gray-400 text-xs mb-0.5">Description</p><p className="text-gray-600 text-sm">{req.description || "—"}</p></div>
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => approveRequest(req.id)} disabled={loadingApprove === req.id} className="flex-1 p-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-semibold text-sm transition-all">
                        {loadingApprove === req.id ? "Enregistrement..." : "Approuver"}
                      </button>
                      <button onClick={() => rejectRequest(req.id)} className="flex-1 p-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm transition-all">Rejeter</button>
                    </div>
                  )}
                  {req.status === "approved" && req.tx && (
                    <a href={`https://sepolia.etherscan.io/tx/${req.tx}`} target="_blank" rel="noreferrer" className="text-green-600 hover:text-green-800 text-xs underline transition-all">Voir sur Etherscan</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
