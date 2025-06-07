const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const https = require('https'); 
const cron = require("node-cron");
const { connectRedis } = require('./config/redis');
const connectDB = require('./config/database'); 

const app = express();

const backendUrl = "https://shrey-iitbbs-project-secret.onrender.com/api/v1/chapters";

// Cron job to keep server alive on render (every 3 minutes)
cron.schedule("*/180 * * * * *", async function () {
  console.log("Restarting server");

  await https
    .get(backendUrl, (res) => {
      if (res.statusCode === 200) {
        console.log("Restarted");
      } else {
        console.error(`failed to restart with status code: ${res.statusCode}`);
      }
    })
    .on("error", (err) => {
      console.log("Error during server restart:");
      console.error("Error ", err.message);
    });
});

// Initialize database connections
const initializeApp = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();
    console.log('MongoDB connected successfully');
    
    // Then connect to Redis
    await connectRedis();
    console.log('Redis connected successfully');
  } catch (error) {
    console.warn('Redis connection failed, using memory fallback:', error.message);
    // Note: MongoDB connection failure will exit the process in connectDB function
  }

  app.use(helmet());
  app.use(compression());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Health check endpoint (before rate limiting and other routes)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      }
    });
  });

  // Now it's safe to import rate limiter (after Redis is initialized)
  const { apiLimiter } = require('./middleware/rateLimiter');

  // Apply rate limiting AND routes together to avoid duplicate route definitions
  app.use('/api/v1/chapters', apiLimiter, require('./routes/chapters'));

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    
    // Rate limiting errors
    if (err.status === 429) {
      return res.status(429).json({
        error: 'Too many requests',
        message: err.message,
        retryAfter: err.retryAfter
      });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.details || err.message
      });
    }

    // Default error response
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      path: req.originalUrl
    });
  });

  return app;
};

// Enhanced graceful shutdown
const gracefulShutdown = async () => {
  console.log('Starting graceful shutdown...');
  
  try {
    // Disconnect Redis
    const { disconnectRedis } = require('./config/redis');
    await disconnectRedis();
    console.log('Redis disconnected');
  } catch (error) {
    console.error('Error during Redis shutdown:', error);
  }
  
  try {
    // Disconnect MongoDB
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error during MongoDB shutdown:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, initializeApp };