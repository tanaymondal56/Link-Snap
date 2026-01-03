// eslint-disable-next-line no-unused-vars -- mongoose imported for type hints
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';
import connectDB from '../config/db.js';

// Robustly load .env from the server directory, regardless of where the script is run
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const registerUser = async () => {
    try {
        await connectDB();

        const email = process.argv[2];
        const password = process.argv[3];
        const role = process.argv[4] || 'user';

        if (!email || !password) {
            console.log('Usage: node scripts/registerUser.js <email> <password> [role]');
            process.exit(1);
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            console.log('User already exists.');
            process.exit(1);
        }

        const user = await User.create({
            email,
            password,
            role,
            isVerified: true, // Manually registered users are auto-verified
        });

        console.log(`User registered successfully:`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`Verified: ${user.isVerified}`);

        process.exit();
    } catch (error) {
        console.error('Error registering user:', error.message);
        process.exit(1);
    }
};

registerUser();
