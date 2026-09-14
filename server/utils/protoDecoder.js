/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LIGHTWEIGHT ZERO-DEPENDENCY PROTOBUF (PROTO3) DECODER FOR SAFE BROWSING v5
 * ═══════════════════════════════════════════════════════════════════════════════
 * Decodes the binary Protocol Buffer response from Google Safe Browsing v5
 * (google.security.safebrowsing.v5.SearchHashesResponse) without external npm packages.
 *
 * Wire format tags handled:
 * - Varint (wire type 0)
 * - Length-delimited (wire type 2)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ThreatType Enum Mapping for Safe Browsing v5
export const THREAT_TYPES = {
    0: 'THREAT_TYPE_UNSPECIFIED',
    1: 'MALWARE',
    2: 'SOCIAL_ENGINEERING',
    3: 'UNWANTED_SOFTWARE',
    4: 'POTENTIALLY_HARMFUL_APPLICATION',
};

/**
 * Decodes a protobuf varint starting at the given offset.
 * 
 * @param {Buffer|Uint8Array} buf - Protobuf binary buffer
 * @param {number} offset - Starting offset
 * @returns {{ value: number, newOffset: number }}
 */
const readVarint = (buf, offset) => {
    let result = 0;
    let shift = 0;
    let pos = offset;

    while (pos < buf.length) {
        const byte = buf[pos++];
        result |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) {
            return { value: result, newOffset: pos };
        }
        shift += 7;
        if (shift >= 64) {
            throw new Error('Protobuf varint exceeds 64-bit bounds');
        }
    }

    throw new Error('Unexpected end of buffer while reading varint');
};

/**
 * Decodes a FullHashDetail message from a length-delimited buffer slice.
 * 
 * @param {Buffer} buf - FullHashDetail buffer
 * @returns {{ threatType: string }}
 */
const decodeFullHashDetail = (buf) => {
    let offset = 0;
    let threatType = 'THREAT_TYPE_UNSPECIFIED';

    while (offset < buf.length) {
        const { value: tag, newOffset: tagOffset } = readVarint(buf, offset);
        offset = tagOffset;
        const fieldNumber = tag >>> 3;
        const wireType = tag & 0x7;

        if (wireType === 0) { // Varint
            const { value, newOffset: valOffset } = readVarint(buf, offset);
            offset = valOffset;
            if (fieldNumber === 1) { // threat_type
                threatType = THREAT_TYPES[value] || 'THREAT_TYPE_UNSPECIFIED';
            }
        } else if (wireType === 2) { // Length-delimited
            const { value: len, newOffset: lenOffset } = readVarint(buf, offset);
            offset = lenOffset + len;
        } else {
            // Skip other wire types
            break;
        }
    }

    return { threatType };
};

/**
 * Decodes a FullHash message from a length-delimited buffer slice.
 * 
 * @param {Buffer} buf - FullHash buffer
 * @returns {{ hash: Buffer, hashHex: string, threatTypes: string[] }}
 */
const decodeFullHash = (buf) => {
    let offset = 0;
    let hash = null;
    const threatTypes = [];

    while (offset < buf.length) {
        const { value: tag, newOffset: tagOffset } = readVarint(buf, offset);
        offset = tagOffset;
        const fieldNumber = tag >>> 3;
        const wireType = tag & 0x7;

        if (wireType === 2) { // Length-delimited
            const { value: len, newOffset: lenOffset } = readVarint(buf, offset);
            offset = lenOffset;
            const content = buf.subarray(offset, offset + len);
            offset += len;

            if (fieldNumber === 1) {
                // full_hash (32-byte SHA-256)
                hash = Buffer.from(content);
            } else if (fieldNumber === 2) {
                // full_hash_details
                const detail = decodeFullHashDetail(content);
                if (detail.threatType && detail.threatType !== 'THREAT_TYPE_UNSPECIFIED') {
                    threatTypes.push(detail.threatType);
                }
            }
        } else if (wireType === 0) { // Varint
            const { newOffset } = readVarint(buf, offset);
            offset = newOffset;
        } else {
            break;
        }
    }

    return {
        hash,
        hashHex: hash ? hash.toString('hex') : '',
        threatTypes: Array.from(new Set(threatTypes)),
    };
};

/**
 * Decodes a google.protobuf.Duration message from a buffer slice.
 * 
 * @param {Buffer} buf - Duration buffer
 * @returns {number} Cache duration in seconds
 */
const decodeDuration = (buf) => {
    let offset = 0;
    let seconds = 300; // Default 5 minutes

    while (offset < buf.length) {
        const { value: tag, newOffset: tagOffset } = readVarint(buf, offset);
        offset = tagOffset;
        const fieldNumber = tag >>> 3;
        const wireType = tag & 0x7;

        if (wireType === 0) { // Varint
            const { value, newOffset: valOffset } = readVarint(buf, offset);
            offset = valOffset;
            if (fieldNumber === 1) {
                seconds = value;
            }
        } else if (wireType === 2) {
            const { value: len, newOffset: lenOffset } = readVarint(buf, offset);
            offset = lenOffset + len;
        } else {
            break;
        }
    }

    return seconds;
};

/**
 * Decodes a complete SearchHashesResponse binary Protocol Buffer payload.
 * 
 * @param {Buffer|ArrayBuffer|Uint8Array} rawData - Binary response from Google Safe Browsing v5
 * @returns {{
 *   fullHashes: Array<{ hash: Buffer, hashHex: string, threatTypes: string[] }>,
 *   cacheDurationSeconds: number
 * }}
 */
export const decodeSearchHashesResponse = (rawData) => {
    if (!rawData) {
        return { fullHashes: [], cacheDurationSeconds: 300 };
    }

    const buf = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
    let offset = 0;
    const fullHashes = [];
    let cacheDurationSeconds = 300; // Default 5 minutes

    try {
        while (offset < buf.length) {
            const { value: tag, newOffset: tagOffset } = readVarint(buf, offset);
            offset = tagOffset;
            const fieldNumber = tag >>> 3;
            const wireType = tag & 0x7;

            if (wireType === 2) { // Length-delimited
                const { value: len, newOffset: lenOffset } = readVarint(buf, offset);
                offset = lenOffset;
                const content = buf.subarray(offset, offset + len);
                offset += len;

                if (fieldNumber === 1) {
                    // full_hashes (repeated FullHash)
                    const parsed = decodeFullHash(content);
                    if (parsed.hash) {
                        fullHashes.push(parsed);
                    }
                } else if (fieldNumber === 2) {
                    // cache_duration (google.protobuf.Duration)
                    cacheDurationSeconds = decodeDuration(content);
                }
            } else if (wireType === 0) {
                const { newOffset } = readVarint(buf, offset);
                offset = newOffset;
            } else {
                break;
            }
        }
    } catch (err) {
        // Return whatever partial data was decoded or fallback safely
        console.warn(`[SafeBrowsingProto] Warning during protobuf parsing: ${err.message}`);
    }

    return {
        fullHashes,
        cacheDurationSeconds: Math.max(cacheDurationSeconds, 60), // Enforce minimum 60s
    };
};

export default {
    decodeSearchHashesResponse,
    THREAT_TYPES,
};
