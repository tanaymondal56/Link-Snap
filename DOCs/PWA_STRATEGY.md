# Link Snap - Progressive Web App (PWA) Strategy

To make Link Snap work as a native-like application across all devices (iOS, Android, Windows, macOS, Linux), we will convert it into a **Progressive Web App (PWA)**.

## 1. What is a PWA?

A PWA is a web application that uses modern web capabilities to deliver an app-like experience to users.

- **Installable**: Can be added to the home screen or desktop.
- **Offline Support**: Works even with flaky or no internet connection.
- **Cross-Platform**: One codebase runs everywhere.

## 2. Implementation Steps

### Step 1: Install Dependencies

We need `vite-plugin-pwa` to handle the service worker generation and manifest injection automatically.

```bash
cd client
npm install vite-plugin-pwa -D
```

### Step 2: Configure Vite

Update `vite.config.js` to include the PWA plugin with the following configuration:

- **Register Type**: `autoUpdate` (App updates automatically when a new version is deployed).
- **Manifest**: Defines how the app looks when installed.
- **Workbox**: Configures caching strategies for offline support.

### Step 3: The Web App Manifest (`manifest.json`)

This file tells the browser about your web application and how it should behave when 'installed' on the user's mobile device or desktop.

**Key Properties:**

- `name`: "Link Snap"
- `short_name`: "LinkSnap"
- `start_url`: "/"
- `display`: "standalone" (Removes browser address bar)
- `background_color`: "#ffffff"
- `theme_color`: "#8b5cf6" (Matches our brand)
- `icons`: Array of icons for different sizes (192x192, 512x512).

### Step 4: iOS Specifics

Apple devices require specific `<meta>` tags in `index.html` because they don't fully rely on the manifest for everything yet.

- `apple-mobile-web-app-capable`: "yes"
- `apple-mobile-web-app-status-bar-style`: "black-translucent"
- `apple-touch-icon`: Path to the icon.

### Step 5: Asset Generation

We need to generate icon files and place them in `client/public/`:

- `pwa-192x192.png`
- `pwa-512x512.png`
- `apple-touch-icon.png`
- `maskable-icon.png` (For Android adaptive icons)

## 3. Browser Support & Experience

| Platform                    | Experience                                                                             |
| :-------------------------- | :------------------------------------------------------------------------------------- |
| **Windows / macOS / Linux** | Installable via Chrome/Edge address bar. Opens in its own window.                      |
| **Android**                 | "Add to Home Screen" prompt. Installs as a native APK (WebAPK). Appears in app drawer. |
| **iOS (iPhone/iPad)**       | "Share" -> "Add to Home Screen". Opens standalone without Safari UI.                   |

## 4. Offline Strategy

- **Cache First**: Fonts, Images, CSS, JS.
- **Network First**: API calls (`/api/*`).
- **Fallback**: If offline, show a custom "You are offline" page or a cached version of the dashboard.

## 5. Next Actions

1.  Run the installation command.
2.  Add the PWA configuration to `vite.config.js`.
3.  Add meta tags to `index.html`.
4.  Generate and upload the icon files.
