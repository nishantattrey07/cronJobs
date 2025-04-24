#!/usr/bin/env node

/**
 * Universal Scraper Controller
 * 
 * This script orchestrates the execution of three scraper projects:
 * 1. scraper/ - VC portfolio company & job scraper (Node.js)
 * 2. fanngJobDbUpload/ - FAANG job scraper (Python)
 * 3. YCombinatorScraping/ - Y Combinator company & job scraper (Node.js)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Configuration
const LOG_FILE = 'scraping_log.txt';
const CONFIG = {
    vcScraper: {
        name: 'VC Portfolio Scraper',
        dir: 'scraper',
        command: 'node',
        args: ['index.js'],
        env: {}
    },
    faangScraper: {
        name: 'FAANG Job Scraper',
        dir: 'fanngJobDbUpload',
        command: 'python3',
        args: ['main.py'],
        env: {}
    },
    ycScraper: {
        name: 'Y Combinator Scraper',
        dir: 'YCombinatorScraping',
        command: 'node',
        args: ['index.js'],
        env: {}
    }
};

// Helper to log messages to console and file
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Initialize log file
function initLogFile() {
    fs.writeFileSync(LOG_FILE, `Universal Scraper Controller - Started at ${new Date().toISOString()}\n`);
    log('Initializing scraping pipeline');
}

/**
 * Execute a command in a child process and return a promise
 * @param {string} command - The command to execute
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - spawn options
 * @returns {Promise} - Resolves with exit code on success, rejects on error
 */
function executeCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        log(`Executing: ${command} ${args.join(' ')}`);

        const childProcess = spawn(command, args, {
            ...options,
            stdio: 'inherit'  // Pipe stdout/stderr to parent process
        });

        childProcess.on('close', (code) => {
            const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

            if (code === 0) {
                log(`✅ Command completed successfully in ${executionTime}s`);
                resolve(code);
            } else {
                const errorMsg = `❌ Command failed with exit code ${code} (${executionTime}s)`;
                log(errorMsg);
                reject(new Error(errorMsg));
            }
        });

        childProcess.on('error', (error) => {
            log(`❌ Failed to start command: ${error.message}`);
            reject(error);
        });
    });
}

/**
 * Run a specific scraper
 * @param {Object} config - Scraper configuration
 * @returns {Promise} - Resolves on success, rejects on error
 */
async function runScraper(config) {
    log(`\n========================================`);
    log(`STARTING: ${config.name}`);
    log(`========================================`);

    try {
        // Navigate to scraper directory
        const originalDir = process.cwd();
        process.chdir(path.join(originalDir, config.dir));
        log(`Working directory: ${process.cwd()}`);

        // Execute the command
        await executeCommand(config.command, config.args, {
            env: { ...process.env, ...config.env }
        });

        // Go back to original directory
        process.chdir(originalDir);

        log(`========================================`);
        log(`COMPLETED: ${config.name}`);
        log(`========================================\n`);

        return true;
    } catch (error) {
        log(`Error running ${config.name}: ${error.message}`);
        // Go back to original directory in case of error
        try {
            process.chdir(originalDir);
        } catch { }
        return false;
    }
}

/**
 * Main function to run all scrapers in sequence
 */
async function runAllScrapers() {
    initLogFile();
    log('🚀 Starting universal scraping pipeline');

    const startTime = Date.now();
    let success = true;

    try {
        // 1. Run VC Portfolio Scraper
        success = await runScraper(CONFIG.vcScraper);

        // 2. Run FAANG Job Scraper (only if previous step was successful)
        if (success) {
            success = await runScraper(CONFIG.faangScraper);
        } else {
            log('⚠️ Skipping FAANG scraper due to previous failure');
        }

        // 3. Run Y Combinator Scraper (only if previous steps were successful)
        if (success) {
            success = await runScraper(CONFIG.ycScraper);
        } else {
            log('⚠️ Skipping Y Combinator scraper due to previous failure');
        }

        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

        if (success) {
            log(`\n✨ PIPELINE COMPLETED SUCCESSFULLY in ${totalTime} minutes`);
        } else {
            log(`\n❌ PIPELINE FAILED after ${totalTime} minutes`);
        }
    } catch (error) {
        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        log(`\n❌ PIPELINE FAILED with error after ${totalTime} minutes`);
        log(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Function to handle interactive mode with user prompt
async function promptForExecution() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n=== Universal Scraper Controller ===');
    console.log('1. Run all scrapers');
    console.log('2. Run only VC Portfolio scraper');
    console.log('3. Run only FAANG Job scraper');
    console.log('4. Run only Y Combinator scraper');
    console.log('q. Quit');

    const answer = await new Promise(resolve => {
        rl.question('\nEnter your choice: ', resolve);
    });
    rl.close();

    switch (answer.trim().toLowerCase()) {
        case '1':
            await runAllScrapers();
            break;
        case '2':
            await runScraper(CONFIG.vcScraper);
            break;
        case '3':
            await runScraper(CONFIG.faangScraper);
            break;
        case '4':
            await runScraper(CONFIG.ycScraper);
            break;
        case 'q':
            console.log('Exiting...');
            break;
        default:
            console.log('Invalid choice. Exiting...');
    }
}

// Check for command line arguments
if (process.argv.includes('--run-all')) {
    runAllScrapers();
} else if (process.argv.includes('--vc')) {
    runScraper(CONFIG.vcScraper);
} else if (process.argv.includes('--faang')) {
    runScraper(CONFIG.faangScraper);
} else if (process.argv.includes('--yc')) {
    runScraper(CONFIG.ycScraper);
} else {
    promptForExecution();
}