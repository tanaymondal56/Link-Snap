import connectDB from '../config/db.js';
import { connectRedis, disconnectRedis } from '../config/redis.js';
import { scanPendingLinks, scanUncheckedLinks, scanStaleLinks } from '../services/safeBrowsingService.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

const run = async () => {
  logger.info('[CronJob] Running Safe Browsing Scans...');
  try {
    await connectDB();
    await connectRedis();
    await scanPendingLinks();
    await scanUncheckedLinks();
    await scanStaleLinks();
    logger.info('[CronJob] Safe Browsing Scans finished successfully.');
    await disconnectRedis();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error(`[CronJob] Error: ${error.message}`);
    try {
      await disconnectRedis();
      await mongoose.connection.close();
    } catch (e) {
      logger.error(`[CronJob] Connection close error: ${e.message}`);
    }
    process.exit(1);
  }
};

const handleShutdown = async (signal) => {
  logger.warn(`[CronJob] Received ${signal}. Shutting down gracefully...`);
  try {
    await disconnectRedis();
    await mongoose.connection.close();
  } catch (e) {
    logger.error(`[CronJob] Connection close error: ${e.message}`);
  }
  process.exit(1);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

run();
