import { useState, useEffect } from 'react';
import { getAppVersionAsync, getAppVersion } from '../config/version';

/**
 * React hook that returns the current app version reactively.
 * Initially returns the cached/fallback version, then updates when the async fetch completes.
 * 
 * Usage:
 *   const version = useAppVersion();
 *   return <span>v{version}</span>;
 */
export const useAppVersion = () => {
    const [version, setVersion] = useState(() => getAppVersion());

    useEffect(() => {
        let mounted = true;

        // Fetch the latest version asynchronously
        getAppVersionAsync().then((latestVersion) => {
            if (mounted && latestVersion !== version) {
                setVersion(latestVersion);
            }
        });

        return () => {
            mounted = false;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return version;
};

export default useAppVersion;
