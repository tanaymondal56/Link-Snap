/**
 * IP Address Utility Functions (Frontend)
 * 
 * Provides unified IPv4-preferring normalization across all UI display points:
 * - Maps IPv6 loopback (::1) -> 127.0.0.1
 * - Unwraps IPv4-mapped IPv6 (::ffff:x.x.x.x -> x.x.x.x)
 * - Extracts IPv4 from dual-stack or comma/slash-separated headers
 * - Decodes 6to4 (2002:...) and NAT64 (64:ff9b::...) embedded IPv4
 * - Filters out internal Kubernetes pod ranges (10.42.* / 10.244.*)
 */

/**
 * Checks if a string is a valid IPv4 address
 * @param {string} ip
 * @returns {boolean}
 */
export const isIPv4 = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.replace(/^::ffff:/i, '').trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
};

/**
 * Checks if a string is a masked IPv4 address (e.g. 192.168.1.xxx)
 * @param {string} ip
 * @returns {boolean}
 */
export const isMaskedIPv4 = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  return /^(\d{1,3}\.){3}(xxx|\d{1,3})$/i.test(trimmed);
};

/**
 * Format IP address preferring IPv4 for all UI display contexts.
 * 
 * @param {string} ip - Raw IP string from server or session
 * @returns {string} Cleaned, IPv4-preferred IP address string
 */
export const formatPreferredIP = (ip) => {
  if (!ip || typeof ip !== 'string') return '';
  const trimmed = ip.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return '';

  // 1. Loopback IPv6 -> IPv4 localhost
  if (trimmed === '::1' || trimmed === '0:0:0:0:0:0:0:1' || trimmed === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  // 2. IPv4-mapped IPv6 (e.g., ::ffff:192.168.1.1)
  if (/^::ffff:(\d{1,3}\.){3}\d{1,3}$/i.test(trimmed)) {
    return trimmed.replace(/^::ffff:/i, '');
  }

  // 3. Already-masked IPv4 (e.g. from sessionHelper maskIP: 192.168.1.xxx)
  if (isMaskedIPv4(trimmed)) {
    return trimmed;
  }

  // 4. Compound / dual-stack delimiter checking (comma, slash, pipe, semicolon, whitespace)
  if (/[,/|;\s]/.test(trimmed)) {
    const candidates = trimmed.split(/[,/|;\s]+/).map((p) => p.trim()).filter(Boolean);
    for (const cand of candidates) {
      if (cand === '::1' || cand === '0:0:0:0:0:0:0:1' || cand === '::ffff:127.0.0.1') {
        return '127.0.0.1';
      }
      if (isIPv4(cand) || isMaskedIPv4(cand)) {
        return cand.replace(/^::ffff:/i, '');
      }
    }
    // If no candidate is IPv4, find first non-internal candidate
    const nonInternal = candidates.find((c) => !c.startsWith('10.42.') && !c.startsWith('10.244.'));
    if (nonInternal) return nonInternal;
    return candidates[0] || trimmed;
  }

  // 5. Direct IPv4 address
  if (isIPv4(trimmed)) {
    return trimmed;
  }

  // 6. 6to4 transition prefix (2002:XXYY:ZZWW::/16)
  if (/^2002:[0-9a-f]{1,4}:[0-9a-f]{1,4}/i.test(trimmed)) {
    try {
      const parts = trimmed.split(':');
      const hex1 = parts[1].padStart(4, '0');
      const hex2 = parts[2].padStart(4, '0');
      const o1 = parseInt(hex1.slice(0, 2), 16);
      const o2 = parseInt(hex1.slice(2, 4), 16);
      const o3 = parseInt(hex2.slice(0, 2), 16);
      const o4 = parseInt(hex2.slice(2, 4), 16);
      const decoded = `${o1}.${o2}.${o3}.${o4}`;
      if (isIPv4(decoded)) return decoded;
    } catch {
      // Fall through on parsing error
    }
  }

  // 7. NAT64 well-known prefix (64:ff9b::a.b.c.d)
  const nat64Dotted = trimmed.match(/^64:ff9b::(?:0:)?((\d{1,3}\.){3}\d{1,3})$/i);
  if (nat64Dotted && isIPv4(nat64Dotted[1])) {
    return nat64Dotted[1];
  }

  // 8. Filter out raw Kubernetes Flannel/Calico pod IPs (10.42.* / 10.244.*)
  if (trimmed.startsWith('10.42.') || trimmed.startsWith('10.244.')) {
    return '127.0.0.1';
  }

  return trimmed;
};

export default {
  isIPv4,
  isMaskedIPv4,
  formatPreferredIP,
};
