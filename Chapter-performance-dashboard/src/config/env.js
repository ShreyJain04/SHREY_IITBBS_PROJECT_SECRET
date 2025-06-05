require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chapter-dashboard'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  admin: {
    apiKey: process.env.ADMIN_API_KEY || 'default-admin-key'
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 3600
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 30
  }
};