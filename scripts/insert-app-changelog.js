
import mongoose from 'mongoose';
import Changelog from '../server/models/Changelog.js'; // Adjust path if necessary
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const releaseData = {
  version: "0.6.0",
  title: "Performance, Security & UI Overhaul",
  description: "A major update bringing significant performance gains, V2 Security features including Safe Browsing, and a polished mobile experience.",
  type: "major",
  icon: "Rocket",
  date: new Date().toISOString(),
  isPublished: true,
  changes: [
    {
      type: "improvement",
      text: "Huge Performance Boost: 88% smaller CSS, 70% smaller JS bundles."
    },
    {
      type: "feature",
      text: "Safe Browsing: Active protection against malicious links."
    },
    {
      type: "feature",
      text: "PWA & Mobile Polish: Improved offline mode and gestures."
    },
    {
      type: "improvement",
      text: "Lazy Loading: Faster initial load times for all users."
    },
    {
      type: "fix",
      "text": "Security Hardening: Patched known vulnerabilities and reinforced headers."
    }
  ]
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

const insertChangelog = async () => {
  await connectDB();

  try {
    // Check if version exists
    const existing = await Changelog.findOne({ version: releaseData.version });
    if (existing) {
      console.log(`Version ${releaseData.version} already exists in DB. Skipping.`);
      process.exit(0);
    }

    // Get highest order
    const highestOrder = await Changelog.findOne().sort({ order: -1 }).select('order');
    const newOrder = highestOrder ? highestOrder.order + 1 : 0;

    const newLog = await Changelog.create({
      ...releaseData,
      order: newOrder,
      history: [{
        action: 'created',
        timestamp: new Date(),
        changes: JSON.stringify({ version: releaseData.version, title: releaseData.title })
      }]
    });

    console.log(`Successfully inserted Changelog v${newLog.version}`);
  } catch (error) {
    console.error('Error inserting changelog:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

insertChangelog();
