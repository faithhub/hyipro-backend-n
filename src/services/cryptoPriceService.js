const axios = require('axios');
const logger = require('../utils/logger');
const pool = require('../config/database');

// CoinGecko API - Free, no API key required
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Fallback prices (updated manually if API fails)
const FALLBACK_PRICES = {
  BTC: 65000, // USD
  ETH: 3500,  // USD
};

// Cache configuration
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let priceCache = {
  data: null,
  timestamp: 0,
};

// API failure tracking
let apiFailureCount = 0;
let lastApiFailureTime = null;
const MAX_FAILURES_BEFORE_FALLBACK = 3;
const FAILURE_RESET_TIME = 30 * 60 * 1000; // 30 minutes

/**
 * Get current crypto prices from CoinGecko API
 * @returns {Object} Prices in USD { BTC: number, ETH: number }
 */
async function getPrices() {
  const now = Date.now();

  // Check cache first
  if (priceCache.data && (now - priceCache.timestamp) < CACHE_DURATION) {
    logger.debug('Using cached crypto prices');
    return priceCache.data;
  }

  // Check if we should use fallback due to API failures
  if (shouldUseFallback()) {
    logger.warn('Using fallback prices due to API failures');
    return FALLBACK_PRICES;
  }

  // Try to load from database first
  try {
    const dbPrices = await loadPricesFromDatabase();
    if (dbPrices && (now - dbPrices.timestamp) < CACHE_DURATION) {
      logger.debug('Using database cached crypto prices');
      priceCache = dbPrices;
      return dbPrices.data;
    }
  } catch (error) {
    logger.warn('Failed to load prices from database, will fetch from API');
  }

  try {
    const response = await axios.get(
      `${COINGECKO_API}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`,
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Hyipro/1.0'
        }
      }
    );

    const prices = {
      BTC: response.data.bitcoin.usd,
      ETH: response.data.ethereum.usd,
    };

    // Save to database
    await savePricesToDatabase(prices);

    // Update cache
    priceCache = {
      data: prices,
      timestamp: now,
    };

    // Reset failure count on success
    apiFailureCount = 0;
    lastApiFailureTime = null;

    logger.info('Crypto prices fetched successfully', { prices });
    return prices;

  } catch (error) {
    apiFailureCount++;
    lastApiFailureTime = now;

    logger.apiError('CoinGecko API', error, {
      failureCount: apiFailureCount,
      endpoint: `${COINGECKO_API}/simple/price`
    });

    // Use fallback if API fails
    logger.warn('Using fallback prices due to API error');
    return FALLBACK_PRICES;
  }
}

/**
 * Load prices from database
 */
async function loadPricesFromDatabase() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT crypto_symbol, price_usd, fetched_at
       FROM crypto_prices
       WHERE crypto_symbol IN ('BTC', 'ETH')
       ORDER BY fetched_at DESC
       LIMIT 2`
    );

    if (rows.length === 2) {
      const prices = {};
      let latestTimestamp = 0;

      rows.forEach(row => {
        prices[row.crypto_symbol] = parseFloat(row.price_usd);
        if (new Date(row.fetched_at).getTime() > latestTimestamp) {
          latestTimestamp = new Date(row.fetched_at).getTime();
        }
      });

      return {
        data: prices,
        timestamp: latestTimestamp,
      };
    }

    return null;
  } finally {
    connection.release();
  }
}

/**
 * Save prices to database
 */
async function savePricesToDatabase(prices) {
  const connection = await pool.getConnection();
  try {
    const now = new Date();

    for (const [symbol, price] of Object.entries(prices)) {
      await connection.execute(
        `INSERT INTO crypto_prices (crypto_symbol, price_usd, source, fetched_at)
         VALUES (?, ?, 'coingecko', ?)`,
        [symbol, price, now]
      );
    }

    logger.info('Crypto prices saved to database', { prices });
  } finally {
    connection.release();
  }
}

/**
 * Check if we should use fallback prices
 */
function shouldUseFallback() {
  if (apiFailureCount >= MAX_FAILURES_BEFORE_FALLBACK) {
    const timeSinceLastFailure = Date.now() - lastApiFailureTime;
    // Reset if enough time has passed
    if (timeSinceLastFailure > FAILURE_RESET_TIME) {
      apiFailureCount = 0;
      lastApiFailureTime = null;
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Convert USD amount to BTC
 * @param {number} usdAmount - Amount in USD
 * @returns {number} Amount in BTC
 */
async function convertToBTC(usdAmount) {
  const prices = await getPrices();
  const btcAmount = usdAmount / prices.BTC;
  return btcAmount;
}

/**
 * Convert USD amount to ETH
 * @param {number} usdAmount - Amount in USD
 * @returns {number} Amount in ETH
 */
async function convertToETH(usdAmount) {
  const prices = await getPrices();
  const ethAmount = usdAmount / prices.ETH;
  return ethAmount;
}

/**
 * Convert crypto amount to USD
 * @param {string} crypto - 'BTC' or 'ETH'
 * @param {number} cryptoAmount - Amount in crypto
 * @returns {number} Amount in USD
 */
async function convertToUSD(crypto, cryptoAmount) {
  const prices = await getPrices();
  const usdAmount = cryptoAmount * prices[crypto.toUpperCase()];
  return usdAmount;
}

/**
 * Get current prices with metadata
 * @returns {Object} Prices with metadata
 */
async function getPricesWithMetadata() {
  const prices = await getPrices();
  return {
    prices,
    cached: priceCache.data === prices,
    timestamp: priceCache.timestamp,
    usingFallback: shouldUseFallback(),
    apiFailureCount,
  };
}

/**
 * Clear the price cache
 */
function clearCache() {
  priceCache = {
    data: null,
    timestamp: 0,
  };
  logger.info('Crypto price cache cleared');
}

/**
 * Update fallback prices (for manual updates)
 * @param {Object} newPrices - { BTC: number, ETH: number }
 */
function updateFallbackPrices(newPrices) {
  Object.assign(FALLBACK_PRICES, newPrices);
  logger.info('Fallback prices updated', { newPrices });
}

module.exports = {
  getPrices,
  convertToBTC,
  convertToETH,
  convertToUSD,
  getPricesWithMetadata,
  clearCache,
  updateFallbackPrices,
  FALLBACK_PRICES,
};
