import nodemailer from 'nodemailer';
import Settings from '../models/Settings.js';

const sendEmail = async (options) => {
    // Fetch email settings from database
    const settings = await Settings.findOne();

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
        default:
            transporterConfig = {
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
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
