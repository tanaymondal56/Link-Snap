import connectDB from '../config/db.js';
import { connectRedis, disconnectRedis } from '../config/redis.js';
import { scanPendingLinks, scanUncheckedLinks } from '../services/safeBrowsingService.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

const run = async () => {
  logger.info('[CronJob] Running Safe Browsing Scans...');
  try {
    await connectDB();
    connectRedis();
    await scanPendingLinks();
    await scanUncheckedLinks();
    logger.info('[CronJob] Safe Browsing Scans finished successfully.');
    disconnectRedis();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error(`[CronJob] Error: ${error.message}`);
    try {
      disconnectRedis();
      await mongoose.connection.close();
    } catch (e) {
      logger.error(`[CronJob] Connection close error: ${e.message}`);
    }
    process.exit(1);
  }
};

run();
