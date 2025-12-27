
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Simple .env parser to avoid module issues if dotenv is not set up with ES modules perfectly in standalone scripts
const loadEnv = () => {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.join(__dirname, '.env');
    console.log(`Debug: Looking for .env at ${envPath}`);
    if (!fs.existsSync(envPath)) {
        console.log('Debug: .env file NOT found');
        return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    console.log(`Debug: .env found. File length: ${content.length}`);
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/); // Improved regex
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        // Handle quotes
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        
        process.env[key] = val;
        // console.log(`Debug: Loaded key ${key}`);
      }
    });
    console.log('Debug: Env loading complete.');
  } catch (e) {

    console.error('Error loading .env:', e);
  }
};

loadEnv();

const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const PORT = process.env.PORT || 5000;
const URL = `http://localhost:${PORT}/api/webhooks`;

if (!SECRET) {
  console.error('❌ Error: LEMONSQUEEZY_WEBHOOK_SECRET is missing from .env');
  process.exit(1);
}

// Mock Payload (Subscription Created)
const payload = {
  meta: {
    id: 'evt_' + Date.now(), // Generate unique event ID
    event_name: 'subscription_created',
    custom_data: {
      user_id: '507f1f77bcf86cd799439011' // Valid MongoDB ObjectId format but likely non-existent
    }
  },
  data: {
    id: '1',
    type: 'subscriptions',
    attributes: {
      store_id: 12345,
      customer_id: 12345,
      order_id: 12345,
      order_item_id: 12345,
      product_id: 12345,
      variant_id: 12345,
      product_name: "Test Pro Plan",
      variant_name: "Monthly",
      user_name: "Test User",
      user_email: "test@example.com",
      status: "active",
      status_formatted: "Active",
      card_brand: "visa",
      card_last_four: "4242",
      pause: null,
      cancelled: false,
      trial_ends_at: null,
      billing_anchor: 123,
      renews_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      ends_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      test_mode: true 
    }
  }
};

const rawBody = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', SECRET);
const digest = hmac.update(rawBody).digest('hex');

console.log(`🚀 Sending Webhook to ${URL}...`);
console.log(`🔑 Signature: ${digest}`);

fetch(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': digest
  },
  body: rawBody
})
.then(async res => {
  const text = await res.text();
  console.log(`\nResponse Status: ${res.status}`);
  console.log(`Response Body: ${text}`);
  
  if (res.ok) {
    console.log('\n✅ Webhook Verified! Server accepted the signature.');
  } else {
    console.log('\n❌ Webhook Failed. Check server logs.');
  }
})
.catch(err => {
  console.error('\n❌ Connection Error:', err.message);
  console.log('Ensure your server is running (npm run prod or npm start)');
});
