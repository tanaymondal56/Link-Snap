/**
 * Link Snap Email Templates
 * Beautiful, responsive email templates for all app notifications
 */

// Brand colors and styles
const brandColors = {
    primary: '#8b5cf6',      // Purple
    primaryDark: '#7c3aed',
    secondary: '#ec4899',    // Pink
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    dark: '#1f2937',
    light: '#f3f4f6',
    white: '#ffffff',
    gray: '#6b7280',
    grayLight: '#9ca3af',
};

// Simple HTML escaper
const escapeHtml = (unsafe) => {
    return (unsafe || '')
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// Get app URL - uses CLIENT_URL env var (required in production)
// In development, falls back to localhost:3000 (Vite proxy) or localhost:5000 (direct API)
const getAppUrl = () => {
    if (process.env.CLIENT_URL) {
        return process.env.CLIENT_URL;
    }
    // Development fallback - port 3000 is Vite dev server with proxy
    // Port 5000 is when running production build locally
    if (process.env.NODE_ENV === 'production') {
        // In production without CLIENT_URL, warn and use relative path
        console.warn('WARNING: CLIENT_URL not set in production. Email links may not work correctly.');
        return '';  // Will produce relative URLs
    }
    return 'http://localhost:3000';
};

// Base template wrapper
const baseTemplate = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Link Snap</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f3f4f6; }
    
    /* iOS blue links */
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    
    /* Gmail blue links */
    u + #body a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }
    
    /* Samsung blue links */
    #MessageViewBody a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }
    
    /* Button hover */
    .button:hover { opacity: 0.9; }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 0 16px !important; }
      .content { padding: 24px 20px !important; }
      .button { width: 100% !important; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body id="body" style="margin: 0 !important; padding: 0 !important; background-color: #f3f4f6;">
  <!-- Preheader text (hidden preview text) -->
  <div style="display: none; font-size: 1px; color: #f3f4f6; line-height: 1px; font-family: Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>
  
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; width: 100%;">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 0 0 32px 0;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!-- Logo Icon -->
                    <div style="background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%); width: 56px; height: 56px; border-radius: 14px; display: inline-block; text-align: center; line-height: 56px;">
                      <span style="color: white; font-size: 28px; font-weight: bold;">🔗</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <span style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 24px; font-weight: 700; color: ${brandColors.dark};">
                      Link<span style="background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Snap</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content Card -->
          <tr>
            <td>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${brandColors.white}; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                <tr>
                  <td class="content" style="padding: 40px 48px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 0;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <a href="${getAppUrl()}" style="color: ${brandColors.gray}; font-family: Arial, sans-serif; font-size: 14px; text-decoration: none;">
                      ${getAppUrl().replace(/^https?:\/\//, '')}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: ${brandColors.grayLight};">
                      © ${new Date().getFullYear()} Link Snap. All rights reserved.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: ${brandColors.grayLight};">
                      You received this email because you have an account with Link Snap.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Primary button component
const primaryButton = (text, url) => `
<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td align="center" style="padding: 24px 0;">
      <a href="${url}" class="button" style="display: inline-block; background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%); color: ${brandColors.white}; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px 0 rgba(139, 92, 246, 0.4);">
        ${text}
      </a>
    </td>
  </tr>
</table>
`;

// Secondary button
const secondaryButton = (text, url) => `
<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td align="center" style="padding: 16px 0;">
      <a href="${url}" style="display: inline-block; background: ${brandColors.light}; color: ${brandColors.dark}; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
        ${text}
      </a>
    </td>
  </tr>
</table>
`;

// Alert/Status box
const statusBox = (type, icon, title, message) => {
    const colors = {
        success: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
        warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
        danger: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    };
    const c = colors[type] || colors.info;

    return `
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
    <tr>
      <td style="background-color: ${c.bg}; border-left: 4px solid ${c.border}; border-radius: 8px; padding: 16px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-family: Arial, sans-serif;">
              <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: ${c.text};">
                ${icon} ${title}
              </p>
              <p style="margin: 0; font-size: 14px; color: ${c.text};">
                ${message}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
};

// Divider
const divider = () => `
<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td style="padding: 24px 0;">
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
    </td>
  </tr>
</table>
`;

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Welcome Email - Sent after successful registration (no verification required)
 */
export const welcomeEmail = (user) => {
    const firstName = escapeHtml(user.firstName) || 'there';
    const content = `
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="background: linear-gradient(135deg, ${brandColors.success} 0%, #16a34a 100%); width: 72px; height: 72px; border-radius: 50%; display: inline-block; text-align: center; line-height: 72px;">
            <span style="font-size: 36px;">🎉</span>
          </div>
        </td>
      </tr>
    </table>
    
    <!-- Heading -->
    <h1 style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; font-weight: 700; color: ${brandColors.dark}; text-align: center;">
      Welcome to Link Snap!
    </h1>
    
    <!-- Subheading -->
    <p style="margin: 0 0 32px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Hi ${firstName}, your account has been created successfully.
    </p>
    
    ${divider()}
    
    <!-- Features -->
    <h2 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 18px; font-weight: 600; color: ${brandColors.dark};">
      Here's what you can do:
    </h2>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding: 12px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: top; padding-right: 12px;">
                <span style="font-size: 20px;">🔗</span>
              </td>
              <td style="font-family: Arial, sans-serif;">
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: ${brandColors.dark};">Shorten Links</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: ${brandColors.gray};">Create short, memorable links in seconds</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: top; padding-right: 12px;">
                <span style="font-size: 20px;">📊</span>
              </td>
              <td style="font-family: Arial, sans-serif;">
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: ${brandColors.dark};">Track Analytics</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: ${brandColors.gray};">Monitor clicks, locations, devices & more</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: top; padding-right: 12px;">
                <span style="font-size: 20px;">📱</span>
              </td>
              <td style="font-family: Arial, sans-serif;">
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: ${brandColors.dark};">Generate QR Codes</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: ${brandColors.gray};">Create scannable codes for your links</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    ${primaryButton('Go to Dashboard', `${getAppUrl()}/dashboard`)}
    
    <p style="margin: 24px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.gray}; text-align: center;">
      Need help getting started? Check out our 
      <a href="${getAppUrl()}" style="color: ${brandColors.primary}; text-decoration: none;">documentation</a>.
    </p>
  `;

    return {
        subject: 'Welcome to Link Snap! 🎉',
        html: baseTemplate(content, `Welcome to Link Snap, ${firstName}! Start shortening links and tracking analytics today.`)
    };
};

/**
 * Email Verification - Sent when verification is required
 */
export const verificationEmail = (user, verificationToken, otp) => {
    const firstName = escapeHtml(user.firstName) || 'there';
    const verifyUrl = `${getAppUrl()}/verify-email/${verificationToken}`;

    const content = `
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%); width: 72px; height: 72px; border-radius: 50%; display: inline-block; text-align: center; line-height: 72px;">
            <span style="font-size: 36px;">✉️</span>
          </div>
        </td>
      </tr>
    </table>
    
    <!-- Heading -->
    <h1 style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; font-weight: 700; color: ${brandColors.dark}; text-align: center;">
      Verify Your Email
    </h1>
    
    <!-- Message -->
    <p style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 32px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Thanks for signing up! Please verify your email address to get started.
    </p>
    
    ${primaryButton('Verify Email Address', verifyUrl)}
    
    ${statusBox('info', '⏰', 'Link expires in 24 hours', 'For security, this verification link will expire in 24 hours.')}
    
    ${divider()}
    
    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: ${brandColors.grayLight}; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin: 8px 0 0 0; font-family: monospace; font-size: 12px; color: ${brandColors.primary}; text-align: center; word-break: break-all;">
      ${verifyUrl}
    </p>
    
    <p style="margin: 24px 0 0 0; font-family: Arial, sans-serif; font-size: 13px; color: ${brandColors.grayLight}; text-align: center;">
      If you didn't create an account, you can safely ignore this email.
    </p>
  `;

    return {
        subject: 'Verify your Link Snap account',
        html: baseTemplate(content, `Hi ${firstName}, please verify your email to complete your Link Snap registration.`)
    };
};

/**
 * Account Suspension Email
 */
export const suspensionEmail = (user, reason, bannedUntil) => {
    const firstName = escapeHtml(user.firstName) || 'there';
    const untilText = bannedUntil
        ? `until <strong>${new Date(bannedUntil).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>`
        : '<strong>indefinitely</strong>';

    const content = `
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="background: linear-gradient(135deg, ${brandColors.danger} 0%, #dc2626 100%); width: 72px; height: 72px; border-radius: 50%; display: inline-block; text-align: center; line-height: 72px;">
            <span style="font-size: 36px;">⚠️</span>
          </div>
        </td>
      </tr>
    </table>
    
    <!-- Heading -->
    <h1 style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; font-weight: 700; color: ${brandColors.danger}; text-align: center;">
      Account Suspended
    </h1>
    
    <!-- Message -->
    <p style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Hi ${firstName}, your Link Snap account has been suspended ${untilText}.
    </p>
    
    ${reason ? statusBox('danger', '📋', 'Reason for suspension', escapeHtml(reason)) : ''}
    
    ${divider()}
    
    <!-- What this means -->
    <h2 style="margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; color: ${brandColors.dark};">
      What this means:
    </h2>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.gray};">
          ❌ &nbsp;You cannot log into your account
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.gray};">
          ❌ &nbsp;You cannot create or manage links
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.gray};">
          ✅ &nbsp;Your existing links will continue to redirect
        </td>
      </tr>
    </table>
    
    ${divider()}
    
    <!-- Appeal -->
    <h2 style="margin: 0 0 12px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; color: ${brandColors.dark};">
      Think this is a mistake?
    </h2>
    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.gray}; line-height: 1.6;">
      You can submit an appeal when you try to log in. We'll review your case and get back to you.
    </p>
    
    <p style="margin: 24px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.grayLight}; text-align: center;">
      Questions? Contact us at 
      <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@example.com'}" style="color: ${brandColors.primary}; text-decoration: none;">
        ${process.env.SUPPORT_EMAIL || 'support@example.com'}
      </a>
    </p>
  `;

    return {
        subject: '⚠️ Your Link Snap account has been suspended',
        html: baseTemplate(content, `Hi ${firstName}, your Link Snap account has been suspended. Please check the email for details.`)
    };
};

/**
 * Account Reactivation Email
 */
export const reactivationEmail = (user) => {
    const firstName = escapeHtml(user.firstName) || 'there';

    const content = `
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="background: linear-gradient(135deg, ${brandColors.success} 0%, #16a34a 100%); width: 72px; height: 72px; border-radius: 50%; display: inline-block; text-align: center; line-height: 72px;">
            <span style="font-size: 36px;">✅</span>
          </div>
        </td>
      </tr>
    </table>
    
    <!-- Heading -->
    <h1 style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; font-weight: 700; color: ${brandColors.success}; text-align: center;">
      Account Reactivated!
    </h1>
    
    <!-- Message -->
    <p style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Hi ${firstName},
    </p>
    <p style="margin: 0 0 32px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Great news! Your Link Snap account has been reactivated and you now have full access again.
    </p>
    
    ${statusBox('success', '🎉', 'Welcome back!', 'Your account is now fully restored. All your links and analytics are intact.')}
    
    ${primaryButton('Log In Now', `${getAppUrl()}/login`)}
    
    <p style="margin: 24px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Thank you for your patience. If you have any questions, feel free to reach out.
    </p>
  `;

    return {
        subject: '✅ Your Link Snap account has been reactivated',
        html: baseTemplate(content, `Hi ${firstName}, great news! Your Link Snap account has been reactivated.`)
    };
};

/**
 * Appeal Decision Email
 */
export const appealDecisionEmail = (user, status, adminResponse, unbanned) => {
    const firstName = escapeHtml(user.firstName) || 'there';
    const isApproved = status === 'approved';

    const content = `
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="background: linear-gradient(135deg, ${isApproved ? brandColors.success : brandColors.danger} 0%, ${isApproved ? '#16a34a' : '#dc2626'} 100%); width: 72px; height: 72px; border-radius: 50%; display: inline-block; text-align: center; line-height: 72px;">
            <span style="font-size: 36px;">${isApproved ? '✅' : '❌'}</span>
          </div>
        </td>
      </tr>
    </table>
    
    <!-- Heading -->
    <h1 style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; font-weight: 700; color: ${isApproved ? brandColors.success : brandColors.danger}; text-align: center;">
      Appeal ${isApproved ? 'Approved' : 'Rejected'}
    </h1>
    
    <!-- Message -->
    <p style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      Hi ${firstName}, your appeal has been reviewed by our team.
    </p>
    
    ${adminResponse ? statusBox(isApproved ? 'success' : 'info', '💬', 'Admin Response', adminResponse) : ''}
    
    ${isApproved && unbanned ? `
      ${statusBox('success', '🎉', 'Account Restored', 'Your account has been reactivated and you can now log in.')}
      ${primaryButton('Log In Now', `${getAppUrl()}/login`)}
    ` : isApproved && !unbanned ? `
      ${statusBox('info', '⏳', 'Pending Action', 'Your appeal was approved but your account restoration is pending further review.')}
    ` : `
      ${statusBox('warning', '📝', 'What\'s Next?', 'If you believe this decision is incorrect, you may submit a new appeal after 7 days.')}
    `}
    
    <p style="margin: 24px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: ${brandColors.grayLight}; text-align: center;">
      If you have questions, contact us at 
      <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@example.com'}" style="color: ${brandColors.primary}; text-decoration: none;">
        ${process.env.SUPPORT_EMAIL || 'support@example.com'}
      </a>
    </p>
  `;

    return {
        subject: `${isApproved ? '✅' : '❌'} Your Link Snap appeal has been ${status}`,
        html: baseTemplate(content, `Hi ${firstName}, your appeal has been ${status}.`)
    };
};

/**
 * Test Email Configuration
 */
export const testEmail = () => {
    const content = `
    <!-- Icon -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="background: linear-gradient(135deg, ${brandColors.success} 0%, #16a34a 100%); width: 72px; height: 72px; border-radius: 50%; display: inline-block; text-align: center; line-height: 72px;">
            <span style="font-size: 36px;">✅</span>
          </div>
        </td>
      </tr>
    </table>
    
    <!-- Heading -->
    <h1 style="margin: 0 0 16px 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; font-weight: 700; color: ${brandColors.success}; text-align: center;">
      Email Configuration Works!
    </h1>
    
    <!-- Message -->
    <p style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 16px; color: ${brandColors.gray}; text-align: center; line-height: 1.6;">
      If you're seeing this email, your email configuration is set up correctly.
    </p>
    
    ${statusBox('success', '🎉', 'All Systems Go!', 'Your Link Snap email notifications are ready to send.')}
    
    ${primaryButton('Go to Admin Panel', `${getAppUrl()}/admin`)}
    
    <p style="margin: 24px 0 0 0; font-family: Arial, sans-serif; font-size: 13px; color: ${brandColors.grayLight}; text-align: center;">
      This is a test email sent from the Link Snap admin panel.
    </p>
  `;

    return {
        subject: '✅ Link Snap - Email Configuration Test',
        html: baseTemplate(content, 'Your Link Snap email configuration is working correctly!')
    };
};

export default {
    welcomeEmail,
    verificationEmail,
    suspensionEmail,
    reactivationEmail,
    appealDecisionEmail,
    testEmail,
};
