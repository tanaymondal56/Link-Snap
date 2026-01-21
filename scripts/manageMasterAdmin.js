import mongoose from 'mongoose';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import Model (Late import to ensure env is loaded if needed)
import MasterAdmin from '../server/models/MasterAdmin.js';

// ==========================================
// SCRIPT CONFIGURATION (QUICK TEMPLATE)
// ==========================================
// To use Quick Action: Set enabled: true and fill details.
const QUICK_ACTION = {
    enabled: false, 
    action: 'UPDATE', // Options: 'CREATE', 'UPDATE', 'DELETE'
    data: {
        email: 'admin@example.com', // The REAL email (no -ma suffix)
        password: 'securePassword123!',
        username: 'MasterChief',
        firstName: 'Master',
        lastName: 'Admin'
    }
};
// ==========================================

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// --- Actions ---

const createMasterAdmin = async (data = null) => {
    console.log('\n--- CREATE MASTER ADMIN ---');
    
    let email, password, username, firstName, lastName;

    if (data) {
        ({ email, password, username, firstName, lastName } = data);
    } else {
        email = await askQuestion('Email (Real email, NO "-ma" suffix): ');
        
        if (email.endsWith('-ma')) {
            console.error('❌ Error: Email should NOT end with "-ma". The suffix is only for login!');
            return;
        }

        password = await askQuestion('Password (min 8 chars): ');
        username = await askQuestion('Username: ');
        firstName = await askQuestion('First Name: ');
        lastName = await askQuestion('Last Name: ');
    }

    // Validation
    if (email.endsWith('-ma')) {
        console.error('❌ Error: Email should NOT end with "-ma". That suffix is only for login!');
        return;
    }

    const exists = await MasterAdmin.findOne({ email });
    if (exists) {
        console.error(`❌ Error: Master Admin with email ${email} already exists.`);
        return;
    }

    try {
        const admin = await MasterAdmin.create({
            email,
            password,
            username,
            firstName,
            lastName,
            role: 'master_admin',
            isVerified: true
        });
        console.log(`\n✅ Success! Master Admin created.`);
        console.log(`LOGIN: ${email}-ma`);
        console.log(`PASS:  [The password you entered - not logged for security]`);
    } catch (err) {
        console.error('❌ Failed to create:', err.message);
    }
};

const updateMasterAdmin = async (data = null) => {
    console.log('\n--- UPDATE MASTER ADMIN ---');
    
    const email = data ? data.email : await askQuestion('Enter Email of Admin to Update: ');
    
    const admin = await MasterAdmin.findOne({ email });
    if (!admin) {
        console.error('❌ Admin not found.');
        return;
    }

    console.log(`Found: ${admin.username} (${admin.email})`);
    
    let newPassword, newUsername, newFirstName, newLastName;
    
    if (data) {
        newPassword = data.password;
        newUsername = data.username;
        newFirstName = data.firstName;
        newLastName = data.lastName;
    } else {
        newPassword = await askQuestion('New Password (leave empty to keep current): ');
        newUsername = await askQuestion('New Username (leave empty to keep current): ');
        newFirstName = await askQuestion('New First Name (leave empty to keep current): ');
        newLastName = await askQuestion('New Last Name (leave empty to keep current): ');
    }

    if (newPassword) admin.password = newPassword;
    if (newUsername) admin.username = newUsername;
    if (newFirstName) admin.firstName = newFirstName;
    if (newLastName) admin.lastName = newLastName;

    await admin.save();
    console.log('✅ Master Admin Updated successfully.');
};

const deleteMasterAdmin = async (data = null) => {
    console.log('\n--- DELETE MASTER ADMIN ---');
    const email = data ? data.email : await askQuestion('Enter Email of Admin to DELETE: ');

    if (!data) {
        const confirm = await askQuestion(`Are you sure you want to delete ${email}? (yes/no): `);
        if (confirm.toLowerCase() !== 'yes') {
            console.log('Cancelled.');
            return;
        }
    }

    const res = await MasterAdmin.findOneAndDelete({ email });
    if (res) {
        console.log(`✅ Master Admin ${email} deleted.`);
    } else {
        console.log('❌ Admin not found.');
    }
};

const showMenu = async () => {
    console.log('\n================================');
    console.log('   MASTER ADMIN MANAGER v1.0    ');
    console.log('================================');
    console.log('1. Create Master Admin');
    console.log('2. Update Master Admin');
    console.log('3. Delete Master Admin');
    console.log('4. Exit');
    
    const choice = await askQuestion('\nSelect Option (1-4): ');

    switch (choice.trim()) {
        case '1': await createMasterAdmin(); break;
        case '2': await updateMasterAdmin(); break;
        case '3': await deleteMasterAdmin(); break;
        case '4': 
            console.log('Exiting...');
            process.exit(0);
        default: console.log('Invalid option.');
    }
    
    await showMenu(); // Loop
};

const main = async () => {
    await connectDB();

    if (QUICK_ACTION.enabled) {
        console.log('⚡ QUICK ACTION MODE DETECTED ⚡');
        switch (QUICK_ACTION.action) {
            case 'CREATE': await createMasterAdmin(QUICK_ACTION.data); break;
            case 'UPDATE': await updateMasterAdmin(QUICK_ACTION.data); break;
            case 'DELETE': await deleteMasterAdmin(QUICK_ACTION.data); break;
            default: console.error('Unknown Action');
        }
        process.exit(0);
    } else {
        await showMenu();
    }
};

main();
