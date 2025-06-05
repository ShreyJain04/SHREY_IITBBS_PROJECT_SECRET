const redis = require('redis');

let client = null;
let isConnected = false;

const connectRedis = async () => {
  if (client && isConnected) {
    return client;
  }

  try {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.log('Redis server is not running');
          return new Error('Redis server is not running');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return new Error('Too many retry attempts');
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isConnected = false;
    });

    client.on('connect', () => {
      console.log('Connected to Redis');
      isConnected = true;
    });

    client.on('ready', () => {
      console.log('Redis client ready');
      isConnected = true;
    });

    client.on('end', () => {
      console.log('Redis connection ended');
      isConnected = false;
    });

    await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    isConnected = false;
    throw error;
  }
};

const getRedisClient = () => {
  if (!client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return client;
};

const isRedisConnected = () => {
  return isConnected && client && client.isOpen;
};

const disconnectRedis = async () => {
  if (client) {
    await client.quit();
    client = null;
    isConnected = false;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  isRedisConnected,
  disconnectRedis
};