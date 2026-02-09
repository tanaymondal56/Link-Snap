# Security Policy

## Supported Versions
| Version | Supported          |
| ------- | ------------------ |
| 0.6.x   | :white_check_mark: |
| 0.5.x   | :white_check_mark: |
| < 0.5.0 | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability in Link-Snap, please follow these steps:

1.  **Do NOT open a public issue.** This gives bad actors a chance to exploit the vulnerability before we can fix it.
2.  **Email the maintainer** directly (or use a private GitHub vulnerability report).
3.  Include a detailed description of the vulnerability and steps to reproduce it.

We aim to acknowledge reports within 48 hours and will provide regular updates on our progress.

## Known Security Features (Not Vulnerabilities)

Please note the following are **intentional features** of the system architecture:

*   **`/.d/` Endpoints**: These are part of the Stealth Admin system for device authentication. They are designed to be obscure.
*   **Master Admin Role**: The system contains a hardcoded privilege hierarchy where Master Admin overrides standard Admin locks. This is by design for system recovery.
*   **Hybrid Auth**: Access tokens are intentionality short-lived (15m) and stored in memory, while Refresh tokens are HttpOnly.

## Security Best Practices

*   Always use strong, unique passwords for Admin accounts.
*   Enable **Biometric Authentication** on trusted devices for maximum security.
*   Keep your `JWT_SECRETS` in `.env` secure and rotate them if compromised.
