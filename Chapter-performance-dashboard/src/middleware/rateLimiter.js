const rateLimit = require('express-rate-limit');
const { getRedisClient, isRedisConnected } = require('../config/redis');

class RedisStore {
  constructor() {
    this.hits = new Map(); 
    this.resetTimes = new Map(); 
  }

  async increment(key) {
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        const current = await client.incr(key);
        
        // Set expiration only on first increment
        if (current === 1) {
          await client.expire(key, 60); // 60 seconds
        }
        
        // Get TTL to calculate reset time
        const ttl = await client.ttl(key);
        const resetTime = new Date(Date.now() + (ttl * 1000));
        
        return {
          totalHits: current,
          resetTime: resetTime
        };
      } else {
        // Fallback to memory store
        const now = Date.now();
        const windowStart = Math.floor(now / 60000) * 60000; // Start of current minute
        const memoryKey = `${key}:${windowStart}`;
        
        const current = (this.hits.get(memoryKey) || 0) + 1;
        this.hits.set(memoryKey, current);
        this.resetTimes.set(memoryKey, windowStart + 60000); // Reset after 1 minute
        
        // Cleanup old entries
        this.cleanupMemoryStore();
        
        return {
          totalHits: current,
          resetTime: new Date(windowStart + 60000)
        };
      }
    } catch (error) {
      console.error('Rate limiter increment error:', error);
      // Fail open - allow the request
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + 60000)
      };
    }
  }

  async decrement(key) {
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        const current = await client.get(key);
        if (current && parseInt(current) > 0) {
          await client.decr(key);
        }
      } else {
        // For memory store, find the current window
        const now = Date.now();
        const windowStart = Math.floor(now / 60000) * 60000;
        const memoryKey = `${key}:${windowStart}`;
        
        const current = this.hits.get(memoryKey) || 0;
        if (current > 0) {
          this.hits.set(memoryKey, current - 1);
        }
      }
    } catch (error) {
      console.error('Rate limiter decrement error:', error);
    }
  }

  async resetKey(key) {
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        await client.del(key);
      } else {
        // Remove all entries for this key from memory
        const keysToDelete = [];
        for (const memKey of this.hits.keys()) {
          if (memKey.startsWith(key + ':')) {
            keysToDelete.push(memKey);
          }
        }
        keysToDelete.forEach(k => {
          this.hits.delete(k);
          this.resetTimes.delete(k);
        });
      }
    } catch (error) {
      console.error('Rate limiter reset error:', error);
    }
  }

  // Clean up expired entries from memory store
  cleanupMemoryStore() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, resetTime] of this.resetTimes) {
      if (now > resetTime) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.hits.delete(key);
      this.resetTimes.delete(key);
    });
  }
}

const createRateLimiter = (options = {}) => {
  const store = new RedisStore();
  
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000, // Default 1 minute
    max: options.max || 30, // Default 30 requests
    message: options.message || {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((options.windowMs || 60 * 1000) / 1000)
    },
    standardHeaders: true, 
    legacyHeaders: false,
    
    store: {
      incr: (key, cb) => {
        store.increment(key)
          .then(result => cb(null, result.totalHits, result.resetTime))
          .catch(err => {
            console.error('Store increment error:', err);
            cb(null, 1, new Date(Date.now() + (options.windowMs || 60000))); // Fail open
          });
      },
      decrement: (key) => store.decrement(key),
      resetKey: (key) => store.resetKey(key)
    },
    
    // Generate key from IP address
    keyGenerator: (req) => {
      return `rate_limit:${req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'}`;
    },
    
    // Skip rate limiting for certain paths
    skip: (req) => {
      return req.path === '/health' || req.path === '/api/health';
    },
    
    // Custom handler for when limit is exceeded
    handler: (req, res) => {
      const retryAfter = Math.ceil((options.windowMs || 60000) / 1000);
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message?.error || 'Rate limit exceeded. Please try again later.',
        retryAfter: retryAfter,
        limit: options.max || 30,
        windowMs: options.windowMs || 60000
      });
    }
  });
};


module.exports = {
  // Main API rate limiter - 30 requests per minute as per your requirements
  apiLimiter: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute (changed from 15 minutes)
    max: 30, // 30 requests per minute (changed from 100)
    message: {
      error: 'Too many API requests, please try again later.',
      retryAfter: 60
    }
  }),

  // Stricter limiter for auth endpoints
  authLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 900
    }
  }),

  // Very strict limiter for password reset
  passwordResetLimiter: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
      error: 'Too many password reset attempts, please try again later.',
      retryAfter: 3600
    }
  }),

  // Upload limiter - stricter for file uploads
  uploadLimiter: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Only 5 uploads per minute
    message: {
      error: 'Too many upload attempts, please try again later.',
      retryAfter: 60
    }
  })
};

