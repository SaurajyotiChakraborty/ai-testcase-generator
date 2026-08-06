const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let cache = {};
let cacheFilePath = '';

/**
 * Generates a SHA-256 hash of a file's contents.
 */
function getFileHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Loads the cache from .aitestcache.json in the target directory.
 */
function loadCache(targetPath) {
    cacheFilePath = path.join(targetPath, '.aitestcache.json');
    if (fs.existsSync(cacheFilePath)) {
        try {
            cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
        } catch (error) {
            console.warn(`Warning: Failed to parse ${cacheFilePath}. Starting fresh.`);
            cache = {};
        }
    } else {
        cache = {};
    }
}

/**
 * Checks if a file has changed since the last successful cache update.
 */
function isFileChanged(filePath) {
    const currentHash = getFileHash(filePath);
    if (!currentHash) return true; // File doesn't exist? Treat as changed.
    return cache[filePath] !== currentHash;
}

/**
 * Updates the hash for a specific file in the in-memory cache.
 */
function updateFileHash(filePath) {
    const currentHash = getFileHash(filePath);
    if (currentHash) {
        cache[filePath] = currentHash;
    }
}

/**
 * Saves the in-memory cache to disk.
 */
function saveCache() {
    if (cacheFilePath) {
        fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), 'utf-8');
    }
}

module.exports = {
    loadCache,
    isFileChanged,
    updateFileHash,
    saveCache
};
