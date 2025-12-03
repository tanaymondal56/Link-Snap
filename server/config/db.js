import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  try {
    const useLocal = process.env.USE_LOCAL_DB === 'true';
    const uri = useLocal ? process.env.MONGO_URI_LOCAL : process.env.MONGO_URI;

    const conn = await mongoose.connect(uri);

    logger.info(`MongoDB Connected: ${conn.connection.host} (${useLocal ? 'Local' : 'Cloud'})`);
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
