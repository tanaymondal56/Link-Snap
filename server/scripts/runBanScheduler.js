import connectDB from '../config/db.js';
import { connectRedis, disconnectRedis } from '../config/redis.js';
import { processExpiredBans, processScheduledChangelogs } from '../services/banScheduler.js';
import { processExpiredSubscriptions } from '../services/subscriptionService.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

const run = async () => {
  logger.info('[CronJob] Running Ban Expiry, Subscription Expiry & Changelog Publisher...');
  try {
    await connectDB();
    connectRedis();
    await processExpiredBans();
    await processScheduledChangelogs();
    await processExpiredSubscriptions();
    logger.info('[CronJob] Ban Expiry, Subscription Expiry & Changelog Publisher finished successfully.');
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
