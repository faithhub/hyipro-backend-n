const cryptoPriceService = require('../services/cryptoPriceService');

/**
 * Get current crypto prices
 */
const getPrices = async (req, res, next) => {
  try {
    const pricesWithMetadata = await cryptoPriceService.getPricesWithMetadata();
    res.json(pricesWithMetadata);
  } catch (error) {
    next(error);
  }
};

/**
 * Convert USD to BTC
 */
const convertUsdToBtc = async (req, res, next) => {
  try {
    const { amount } = req.query;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const usdAmount = parseFloat(amount);
    const btcAmount = await cryptoPriceService.convertToBTC(usdAmount);

    res.json({
      usd: usdAmount,
      btc: btcAmount,
      rate: (await cryptoPriceService.getPrices()).BTC,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Convert USD to ETH
 */
const convertUsdToEth = async (req, res, next) => {
  try {
    const { amount } = req.query;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const usdAmount = parseFloat(amount);
    const ethAmount = await cryptoPriceService.convertToETH(usdAmount);

    res.json({
      usd: usdAmount,
      eth: ethAmount,
      rate: (await cryptoPriceService.getPrices()).ETH,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Convert crypto to USD
 */
const convertCryptoToUsd = async (req, res, next) => {
  try {
    const { amount, crypto } = req.query;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!crypto || !['BTC', 'ETH'].includes(crypto.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid crypto (must be BTC or ETH)' });
    }

    const cryptoAmount = parseFloat(amount);
    const usdAmount = await cryptoPriceService.convertToUSD(crypto.toUpperCase(), cryptoAmount);

    res.json({
      crypto: crypto.toUpperCase(),
      amount: cryptoAmount,
      usd: usdAmount,
      rate: (await cryptoPriceService.getPrices())[crypto.toUpperCase()],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear price cache (admin only)
 */
const clearCache = async (req, res, next) => {
  try {
    cryptoPriceService.clearCache();
    res.json({ message: 'Price cache cleared' });
  } catch (error) {
    next(error);
  }
};

/**
 * Update fallback prices (admin only)
 */
const updateFallbackPrices = async (req, res, next) => {
  try {
    const { BTC, ETH } = req.body;

    if (!BTC || !ETH || isNaN(BTC) || isNaN(ETH)) {
      return res.status(400).json({ error: 'Invalid prices' });
    }

    cryptoPriceService.updateFallbackPrices({
      BTC: parseFloat(BTC),
      ETH: parseFloat(ETH),
    });

    res.json({ message: 'Fallback prices updated' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrices,
  convertUsdToBtc,
  convertUsdToEth,
  convertCryptoToUsd,
  clearCache,
  updateFallbackPrices,
};
