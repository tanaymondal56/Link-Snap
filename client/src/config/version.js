// App version configuration
// Update this when releasing new versions
export const APP_VERSION = '0.5.1-beta';

// This will be set during build time from the service worker
// For now, we'll store the version in localStorage when the app loads
export const getStoredVersion = () => {
    return localStorage.getItem('app_version') || APP_VERSION;
};

export const setStoredVersion = (version) => {
    localStorage.setItem('app_version', version);
};

// Check if there's a version mismatch (update available)
export const hasVersionMismatch = () => {
    const storedVersion = getStoredVersion();
    return storedVersion !== APP_VERSION;
};

// Flag to show changelog after update
export const shouldShowChangelog = () => {
    return localStorage.getItem('show_changelog_after_update') === 'true';
};

export const setShowChangelogAfterUpdate = (value) => {
    if (value) {
        localStorage.setItem('show_changelog_after_update', 'true');
    } else {
        localStorage.removeItem('show_changelog_after_update');
    }
};

// Check if user has seen the current version's changelog
export const hasSeenCurrentChangelog = () => {
    const seenVersion = localStorage.getItem('changelog_seen_version');
    return seenVersion === APP_VERSION;
};

export const markChangelogAsSeen = () => {
    localStorage.setItem('changelog_seen_version', APP_VERSION);
};

// Check if there's a new version the user hasn't seen changelog for
export const hasUnseenChangelog = () => {
    return !hasSeenCurrentChangelog();
};
