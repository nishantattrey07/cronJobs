const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = 'output';
const LOG_FILE = path.join(OUTPUT_DIR, 'execution_log.txt');

// Script execution order
const SCRIPTS = [
    { name: './src/scraper.js', description: 'Fetch initial company data from YC' },
    { name: './src/companyDetailsScraper.js', description: 'Scrape detailed company information' },
    { name: './src/scrape_jobs.js', description: 'Scrape job listings for each company' },
    { name: './src/combined_data.js', description: 'Combine all scraped data into a unified format' },
    { name: './src/formatter.js', description: 'Format and clean the data for final output' }
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to log messages to console and file
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    console.log(logMessage);

    // Append to log file
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Execute a script and return a promise
function executeScript(scriptName, description) {
    return new Promise((resolve, reject) => {
        log(`\n========================================`);
        log(`STARTING: ${scriptName} - ${description}`);
        log(`========================================`);

        const startTime = Date.now();

        // Execute the script as a child process
        const child = spawn('node', [scriptName], {
            stdio: 'inherit' // Pipe stdout/stderr to parent process
        });

        child.on('close', (code) => {
            const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

            if (code === 0) {
                log(`✅ COMPLETED: ${scriptName} (${executionTime}s)`);
                resolve();
            } else {
                const errorMsg = `❌ FAILED: ${scriptName} with exit code ${code} (${executionTime}s)`;
                log(errorMsg);
                reject(new Error(errorMsg));
            }
        });

        child.on('error', (error) => {
            log(`❌ ERROR: Failed to start ${scriptName}: ${error.message}`);
            reject(error);
        });
    });
}

// Main function to run all scripts sequentially
async function runAllScripts() {
    log('🚀 Starting YC data pipeline execution');
    log(`📝 Execution log will be saved to: ${LOG_FILE}`);

    const startTime = Date.now();

    try {
        // Run each script sequentially
        for (const script of SCRIPTS) {
            await executeScript(script.name, script.description);
        }

        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        log(`\n✨ PIPELINE COMPLETED SUCCESSFULLY in ${totalTime} minutes`);
    } catch (error) {
        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        log(`\n❌ PIPELINE FAILED after ${totalTime} minutes`);
        log(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the pipeline
runAllScripts();