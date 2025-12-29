
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from server root
dotenv.config({ path: join(__dirname, '.env') });

const trustedDeviceSchema = new mongoose.Schema({}, { strict: false });
const TrustedDevice = mongoose.model('TrustedDevice', trustedDeviceSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const result = await TrustedDevice.deleteMany({});
    console.log(`Deleted ${result.deletedCount} devices.`);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
