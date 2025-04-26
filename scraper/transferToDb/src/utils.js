const fs = require('fs');

// Log level (0 = minimal, 1 = normal, 2 = verbose)
const LOG_LEVEL = 2;

/**
 * Logging utilities
 */
function logError(message, error = null) {
    console.error(`❌ ERROR: ${message}`);
    if (error) console.error(error);
}

function logInfo(message) {
    if (LOG_LEVEL >= 1) console.log(`ℹ️ ${message}`);
}

function logVerbose(message) {
    if (LOG_LEVEL >= 2) console.log(`📝 ${message}`);
}

function logSuccess(message) {
    if (LOG_LEVEL >= 1) console.log(`✅ ${message}`);
}

/**
 * Helper to read JSON files
 */
function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logError(`Failed to read JSON file: ${filePath}`, error);
        throw error;
    }
}

/**
 * Helper to generate slugs from strings
 */
function generateSlug(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);
}

/**
 * Helper to chunk arrays for batch processing
 * @param {Array} array - Array to chunk
 * @param {number} chunkSize - Size of each chunk
 * @returns {Array} - Array of chunks
 */
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Helper to safely convert values to database JSON format
 */
function toDbJson(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

/**
 * Helper to safely convert values to database arrays
 */
function toDbArray(value) {
    if (!value || !Array.isArray(value)) return '{}';
    return '{' + value.map(item => `"${item}"`).join(',') + '}';
}

/**
 * Helper to create a progress bar for console output
 */
function createProgressBar(total) {
    const barLength = 30;
    let current = 0;

    return {
        update: (increment = 1) => {
            current += increment;
            const percentage = Math.min(100, Math.floor((current / total) * 100));
            const filledLength = Math.floor((percentage / 100) * barLength);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

            process.stdout.write(`\r[${bar}] ${percentage}% | ${current}/${total}`);

            if (current >= total) {
                process.stdout.write('\n');
            }
        },
        complete: () => {
            if (current < total) {
                current = total;
                const bar = '█'.repeat(barLength);
                process.stdout.write(`\r[${bar}] 100% | ${total}/${total}\n`);
            }
        }
    };
}

/**
 * Configuration constants - INCREASED TRANSACTION TIMEOUT
 */
const BATCH_SIZE = 200;
const TRANSACTION_TIMEOUT = 600000; // Increased from 300000 to 600000 (10 minutes)
const DROP_STAGING_TABLES = true;

module.exports = {
    logError,
    logInfo,
    logVerbose,
    logSuccess,
    readJsonFile,
    generateSlug,
    chunkArray,
    toDbJson,
    toDbArray,
    createProgressBar,
    BATCH_SIZE,
    TRANSACTION_TIMEOUT,
    DROP_STAGING_TABLES
};
