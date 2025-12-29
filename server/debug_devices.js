
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from server root
dotenv.config({ path: join(__dirname, '.env') });

const trustedDeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  credentialId: { type: Buffer, required: true },
  publicKey: { type: Buffer, required: true },
  counter: { type: Number, required: true },
  deviceName: { type: String, required: true },
}, { timestamps: true });

const TrustedDevice = mongoose.model('TrustedDevice', trustedDeviceSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const devices = await TrustedDevice.find({});
    console.log(`Found ${devices.length} devices.`);

    for (const d of devices) {
      console.log('--- Device ---');
      console.log('Name:', d.deviceName);
      console.log('Cred ID (Base64URL):', d.credentialId.toString('base64url'));
      console.log('Cred ID (Hex):', d.credentialId.toString('hex'));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
