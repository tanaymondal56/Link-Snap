
import mongoose from 'mongoose';
import Url from './models/Url.js';
import dotenv from 'dotenv';
dotenv.config();

const checkCounts = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI is missing in .env');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const pending = await Url.countDocuments({ safetyStatus: 'pending' });
        const unchecked = await Url.countDocuments({ safetyStatus: 'unchecked' });
        const safe = await Url.countDocuments({ safetyStatus: 'safe' });
        const malware = await Url.countDocuments({ safetyStatus: 'malware' });
        const unknown = await Url.countDocuments({ safetyStatus: { $exists: false } });

        console.log('--- SAFETY STATUS COUNTS ---');
        console.log(`Pending: ${pending}`);
        console.log(`Unchecked: ${unchecked}`);
        console.log(`Safe: ${safe}`);
        console.log(`Malware: ${malware}`);
        console.log(`Unknown/Missing: ${unknown}`);
        console.log('----------------------------');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkCounts();
