const validateBTCAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  const btcRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
  return btcRegex.test(address);
};

const validateETHAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  const ethRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethRegex.test(address);
};

const validateWalletAddress = (address, cryptoType) => {
  if (!address || !cryptoType) return false;
  
  if (cryptoType === 'BTC') {
    return validateBTCAddress(address);
  } else if (cryptoType === 'ETH') {
    return validateETHAddress(address);
  }
  
  return false;
};

const generateDepositReference = () => {
  return 'DEP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

module.exports = {
  validateBTCAddress,
  validateETHAddress,
  validateWalletAddress,
  generateDepositReference
};
