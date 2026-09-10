/**
 * IP Address Utility Functions (Backend)
 * 
 * Provides unified IPv4-preferring normalization across all server layers:
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
 * Checks if an IP is an internal Kubernetes/container socket address
 * @param {string} ip
 * @returns {boolean}
 */
export const isInternalClusterIP = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  const normalized = ip.replace(/^::ffff:/i, '').trim();
  return normalized.startsWith('10.42.') ||
    normalized.startsWith('10.244.') ||
    normalized.startsWith('127.') ||
    normalized === '::1';
};

/**
 * Checks if an IP is a Cloudflare Worker/Pages outbound egress range
 * @param {string} ip
 * @returns {boolean}
 */
export const isCloudflareEgressIP = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  const normalized = ip.replace(/^::ffff:/i, '').trim();
  return normalized.startsWith('2a06:98c0:');
};

/**
 * Normalize and extract preferred IPv4 address from any IP candidate or compound string.
 * 
 * @param {string} ip - Raw IP string
 * @returns {string} Preferred IPv4 address or normalized fallback
 */
export const formatPreferredIP = (ip) => {
  if (!ip || typeof ip !== 'string') return '';
  const trimmed = ip.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return '';

  // 1. Loopback IPv6 -> standard IPv4 loopback
  if (trimmed === '::1' || trimmed === '0:0:0:0:0:0:0:1' || trimmed === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  // 2. IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (/^::ffff:(\d{1,3}\.){3}\d{1,3}$/i.test(trimmed)) {
    return trimmed.replace(/^::ffff:/i, '');
  }

  // 3. Delimited / compound list (comma, slash, pipe, semicolon, whitespace)
  if (/[,/|;\s]/.test(trimmed)) {
    const candidates = trimmed.split(/[,/|;\s]+/).map((p) => p.trim()).filter(Boolean);
    for (const cand of candidates) {
      if (cand === '::1' || cand === '0:0:0:0:0:0:0:1' || cand === '::ffff:127.0.0.1') {
        return '127.0.0.1';
      }
      if (isIPv4(cand)) {
        return cand.replace(/^::ffff:/i, '');
      }
    }
    const nonInternal = candidates.find((c) => !isInternalClusterIP(c) && !isCloudflareEgressIP(c));
    if (nonInternal) return nonInternal;
    return candidates[0] || trimmed;
  }

  // 4. Standard IPv4
  if (isIPv4(trimmed)) {
    return trimmed;
  }

  // 5. 6to4 transition prefix (2002:XXYY:ZZWW::/16)
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
      // Fall through on error
    }
  }

  // 6. NAT64 well-known prefix (64:ff9b::a.b.c.d)
  const nat64Dotted = trimmed.match(/^64:ff9b::(?:0:)?((\d{1,3}\.){3}\d{1,3})$/i);
  if (nat64Dotted && isIPv4(nat64Dotted[1])) {
    return nat64Dotted[1];
  }

  // 7. Prevent internal cluster socket IPs from leaking as real user IPs
  if (trimmed.startsWith('10.42.') || trimmed.startsWith('10.244.')) {
    return '127.0.0.1';
  }

  return trimmed;
};

export default {
  isIPv4,
  isInternalClusterIP,
  isCloudflareEgressIP,
  formatPreferredIP,
};
