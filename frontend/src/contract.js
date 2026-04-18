export const CONTRACT_ADDRESS = "0x2D24bA0482733aD12E2CfD9D415d5bD2Abbd8fa1";
export const CONTRACT_ABI = [
"function totalLands() external view returns (uint256)",
"function getLand(uint256 _tokenId) external view returns (tuple(uint256 id, string location, uint256 areaSqMeters, uint256 price, bool forSale))",
"function landOwner(uint256 _tokenId) external view returns (address)",
"function listLandForSale(uint256 _tokenId, uint256 _price) external",
"function buyLand(uint256 _tokenId) external payable",
"function verifyAndMintLand(address _to, string memory _location, uint256 area) external returns (uint256)"
];