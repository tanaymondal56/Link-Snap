import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000; // 1 second

const connectDB = async (retryCount = 0) => {
  try {
    const useLocal = process.env.USE_LOCAL_DB === 'true';
    const uri = useLocal ? process.env.MONGO_URI_LOCAL : process.env.MONGO_URI;

    if (!uri) {
      throw new Error('MongoDB URI is not defined. Check MONGO_URI in .env');
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });

    logger.info(`MongoDB Connected: ${conn.connection.host} (${useLocal ? 'Local' : 'Cloud'})`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(2, retryCount); // Exponential backoff
      logger.warn(`Retrying MongoDB connection in ${delay / 1000}s... (${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retryCount + 1);
    }

    logger.error(`Failed to connect to MongoDB after ${MAX_RETRIES} retries`);
    
    // In production, exit after exhausting retries
    if (process.env.NODE_ENV === 'production') {
      logger.error('Exiting due to database connection failure in production');
      process.exit(1);
    }
    
    // In development, throw error but don't exit (allows for debugging)
    throw error;
  }
};

// Export connection state checker for health endpoints
export const isConnected = () => mongoose.connection.readyState === 1;

export default connectDB;
