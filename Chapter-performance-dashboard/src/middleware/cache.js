const { getRedisClient } = require('../config/redis');

const cache = (duration = 3600) => { // Default 1 hour
  return async (req, res, next) => {
    try {
      const client = getRedisClient();
      
      // If Redis is not connected, skip caching
      if (!client) {
        console.log('Redis not connected, skipping cache');
        res.set('X-Cache-Status', 'DISABLED');
        return next();
      }
      
      const key = `cache:${req.originalUrl}`;
      
      const cachedData = await client.get(key);
      
      if (cachedData) {
        console.log('Cache hit for:', key);
        res.set('X-Cache-Status', 'HIT - Data served from cache');
        
        return res.json(JSON.parse(cachedData));
      }
      
      // Cache miss
      res.set('X-Cache-Status', 'MISS - Data will be cached');
      console.log('Cache miss for:', key);
      
      const originalJson = res.json;
      
      res.json = function(data) {
        // Cache the response
        client.setEx(key, duration, JSON.stringify(data))
          .catch(err => console.error('Cache set error:', err));
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      res.set('X-Cache-Status', 'ERROR - Cache failed');
      next(); // Continue without caching if there's an error
    }
  };
};

const invalidateCache = async (pattern = 'cache:*') => {
  try {
    const client = getRedisClient();
    if (!client) {
      console.log('Redis not connected, cannot invalidate cache');
      return;
    }
    
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      await client.del(keys);
      console.log(`Invalidated ${keys.length} cache entries`);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

module.exports = {
  cache,
  invalidateCache
};