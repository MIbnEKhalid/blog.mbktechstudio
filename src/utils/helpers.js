/**
 * Generates a URL-friendly slug from text.
 * @param {string} text 
 * @returns {string}
 */
export function generateSlug(text = '') {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Parses diverse input formats (JSON string, array, comma-separated string) into a clean array.
 * @param {any} input 
 * @returns {Array<string>}
 */
export function parseArray(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) return parsed;
    } catch {}
    return String(input)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}
