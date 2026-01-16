import nodemailer from 'nodemailer';
import Settings from '../models/Settings.js';

// Simple in-memory cache for settings
let settingsCache = {
    data: null,
    expiresAt: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const sendEmail = async (options) => {
    // Check cache
    let settings;
    if (settingsCache.data && settingsCache.expiresAt > Date.now()) {
        settings = settingsCache.data;
    } else {
        // Fetch from DB
        settings = await Settings.findOne();
        if (settings) {
            settingsCache = {
                data: settings,
                expiresAt: Date.now() + CACHE_TTL
            };
        }
    }

    if (!settings || !settings.emailConfigured) {
        throw new Error('Email is not configured. Please configure email settings in the admin panel.');
    }

    // Get decrypted password
    const decryptedPassword = settings.getDecryptedPassword();

    if (!decryptedPassword) {
        throw new Error('Failed to decrypt email password. Please reconfigure email settings.');
    }

    // Configure transporter based on provider
    let transporterConfig;

    switch (settings.emailProvider) {
        case 'gmail':
            transporterConfig = {
                service: 'gmail',
                auth: {
                    user: settings.emailUsername,
                    pass: decryptedPassword,
                },
            };
            break;
        case 'outlook':
            transporterConfig = {
                service: 'hotmail',
                auth: {
                    user: settings.emailUsername,
                    pass: decryptedPassword,
                },
            };
            break;
        case 'yahoo':
            transporterConfig = {
                service: 'yahoo',
                auth: {
                    user: settings.emailUsername,
                    pass: decryptedPassword,
                },
            };
            break;
        case 'smtp':
            // Custom SMTP configuration
            transporterConfig = {
                host: settings.smtpHost,
                port: settings.smtpPort || 587,
                secure: settings.smtpSecure || false, // true for 465, false for other ports
                auth: {
                    user: settings.emailUsername,
                    pass: decryptedPassword,
                },
            };
            break;
        default:
            transporterConfig = {
                host: settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
                port: settings.smtpPort || process.env.SMTP_PORT || 587,
                secure: settings.smtpSecure || false,
                auth: {
                    user: settings.emailUsername,
                    pass: decryptedPassword,
                },
            };
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    const mailOptions = {
        from: `"Link Snap" <${settings.emailUsername}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    await transporter.sendMail(mailOptions);
};

export default sendEmail;
