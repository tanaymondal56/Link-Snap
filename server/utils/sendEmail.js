import nodemailer from 'nodemailer';
import { getSettings } from './getSettings.js';
import { decryptEmailPassword } from '../models/Settings.js';
import { Resend } from 'resend';

const sendEmail = async (options) => {
    // Fetch settings directly (relying on getSettings' built-in Redis cache with invalidation logic)
    // This fixes Bug 1 (settingsCache in-memory stale cache across PM2 workers)
    let settings = await getSettings();

    if (!settings) {
        // Fallback default so the app doesn't crash if DB settings aren't initialized yet (e.g. very first signup)
        settings = {
            emailUsername: process.env.SUPPORT_EMAIL || 'support@linksnap.app',
            emailConfigured: false,
        };
    }

    // Classify work type by checking options.type or inspecting options.subject
    let workType = options.type || 'support'; 
    if (!options.type && options.subject) {
        const sub = options.subject.toLowerCase();
        if (sub.includes('verification') || sub.includes('otp') || sub.includes('code') || sub.includes('password') || sub.includes('security')) {
            workType = 'auth';
        } else if (sub.includes('test') || sub.includes('alert') || sub.includes('admin') || sub.includes('system')) {
            workType = 'admin';
        }
    }

    // 1. Check if Resend API Key is present (Priority)
    // This fixes Bug 2 (replacing slow individual SMTP handshakes with Resend HTTP API)
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const domain = process.env.DOMAIN || 'linksnap.app';
        
        // Define differentiated from-addresses
        const authEmail = process.env.RESEND_FROM_AUTH || `security@${domain}`;
        const adminEmail = process.env.RESEND_FROM_ADMIN || `admin@${domain}`;
        const supportEmail = process.env.RESEND_FROM_SUPPORT || `support@${domain}`;

        let fromEmail;
        let fromName;

        if (workType === 'auth') {
            fromEmail = authEmail;
            fromName = 'Link Snap Security';
        } else if (workType === 'admin') {
            fromEmail = adminEmail;
            fromName = 'Link Snap Admin';
        } else {
            fromEmail = supportEmail;
            fromName = 'Link Snap Support';
        }

        // Support explicit from overrides if passed by caller
        const finalFrom = options.from || `${fromName} <${fromEmail}>`;

        const { error } = await resend.emails.send({
            from: finalFrom,
            to: options.email,
            subject: options.subject,
            html: options.message,
        });

        if (error) {
            throw new Error(`Resend Error: ${error.message}`);
        }
        return; // Exit early since Resend succeeded
    }

    // 2. Fallback to SMTP logic
    if (!settings.emailConfigured) {
        throw new Error('Email is not configured. Please configure email settings in the admin panel or provide RESEND_API_KEY in .env.');
    }

    // Get decrypted password (using exported helper to avoid lean object error)
    const decryptedPassword = decryptEmailPassword(settings.emailPassword);

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
            transporterConfig = {
                host: settings.smtpHost,
                port: settings.smtpPort || 587,
                secure: settings.smtpSecure || false,
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

    // Setup differentiated from header for SMTP (using display name to avoid authentication failures)
    let fromHeader;
    if (workType === 'auth') {
        fromHeader = `"Link Snap Security" <${settings.emailUsername}>`;
    } else if (workType === 'admin') {
        fromHeader = `"Link Snap Admin" <${settings.emailUsername}>`;
    } else {
        fromHeader = `"Link Snap Support" <${settings.emailUsername}>`;
    }

    const finalFromSMTP = options.from || fromHeader;

    const mailOptions = {
        from: finalFromSMTP,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    await transporter.sendMail(mailOptions);
};

export default sendEmail;
