#!/usr/bin/env node

/**
 * Universal Database Import Controller
 * 
 * This script orchestrates the execution of three database import processes:
 * 1. import.js - Imports data from the general scraper
 * 2. direct-import.js - Imports FAANG job data from SQLite
 * 3. import-yc-data.js - Imports Y Combinator company & job data
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Configuration
const LOG_FILE = 'import_log.txt';
const DB_DIR = path.resolve(__dirname, 'DB'); // Ensure we're pointing to the DB directory

const CONFIG = {
    mainImport: {
        name: 'Main Data Import',
        script: path.join(DB_DIR, 'import.js'),
        args: ['-d'], // Use direct mode to avoid interactive prompts
        env: {}
    },
    faangImport: {
        name: 'FAANG Job Import',
        script: path.join(DB_DIR, 'direct-import.js'),
        args: [],
        env: {}
    },
    ycImport: {
        name: 'Y Combinator Data Import',
        script: path.join(DB_DIR, 'import-yc-data.js'),
        args: [],
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
    fs.writeFileSync(LOG_FILE, `Universal Database Import Controller - Started at ${new Date().toISOString()}\n`);
    log('Initializing import pipeline');
}

/**
 * Execute a script in a child process and return a promise
 * @param {string} script - The script to execute
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - spawn options
 * @returns {Promise} - Resolves with exit code on success, rejects on error
 */
function executeScript(script, args, options) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        log(`Executing: node ${script} ${args.join(' ')}`);

        const childProcess = spawn('node', [script, ...args], {
            ...options,
            stdio: 'inherit'  // Pipe stdout/stderr to parent process
        });

        childProcess.on('close', (code) => {
            const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

            if (code === 0) {
                log(`✅ Script completed successfully in ${executionTime}s`);
                resolve(code);
            } else {
                const errorMsg = `❌ Script failed with exit code ${code} (${executionTime}s)`;
                log(errorMsg);
                reject(new Error(errorMsg));
            }
        });

        childProcess.on('error', (error) => {
            log(`❌ Failed to start script: ${error.message}`);
            reject(error);
        });
    });
}

/**
 * Run a specific import script
 * @param {Object} config - Import script configuration
 * @returns {Promise} - Resolves on success, rejects on error
 */
async function runImport(config) {
    log(`\n========================================`);
    log(`STARTING: ${config.name}`);
    log(`========================================`);

    try {
        // Check if script exists
        if (!fs.existsSync(config.script)) {
            throw new Error(`Script not found: ${config.script}`);
        }

        // Execute the script
        await executeScript(config.script, config.args, {
            env: { ...process.env, ...config.env }
        });

        log(`========================================`);
        log(`COMPLETED: ${config.name}`);
        log(`========================================\n`);

        return true;
    } catch (error) {
        log(`Error running ${config.name}: ${error.message}`);
        return false;
    }
}

/**
 * Main function to run all import scripts in sequence
 */
async function runAllImports() {
    initLogFile();
    log('🚀 Starting universal import pipeline');
    log(`DB Directory: ${DB_DIR}`);

    const startTime = Date.now();
    let success = true;

    try {
        // 1. Run Main Data Import
        success = await runImport(CONFIG.mainImport);

        // 2. Run FAANG Job Import (only if previous step was successful)
        if (success) {
            success = await runImport(CONFIG.faangImport);
        } else {
            log('⚠️ Skipping FAANG import due to previous failure');
        }

        // 3. Run Y Combinator Data Import (only if previous steps were successful)
        if (success) {
            success = await runImport(CONFIG.ycImport);
        } else {
            log('⚠️ Skipping Y Combinator import due to previous failure');
        }

        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

        if (success) {
            log(`\n✨ IMPORT PIPELINE COMPLETED SUCCESSFULLY in ${totalTime} minutes`);
        } else {
            log(`\n❌ IMPORT PIPELINE FAILED after ${totalTime} minutes`);
        }
    } catch (error) {
        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        log(`\n❌ IMPORT PIPELINE FAILED with error after ${totalTime} minutes`);
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

    console.log('\n=== Universal Database Import Controller ===');
    console.log('1. Run all import scripts');
    console.log('2. Run only Main Data import');
    console.log('3. Run only FAANG Job import');
    console.log('4. Run only Y Combinator data import');
    console.log('q. Quit');

    const answer = await new Promise(resolve => {
        rl.question('\nEnter your choice: ', resolve);
    });
    rl.close();

    switch (answer.trim().toLowerCase()) {
        case '1':
            await runAllImports();
            break;
        case '2':
            await runImport(CONFIG.mainImport);
            break;
        case '3':
            await runImport(CONFIG.faangImport);
            break;
        case '4':
            await runImport(CONFIG.ycImport);
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
    runAllImports();
} else if (process.argv.includes('--main')) {
    runImport(CONFIG.mainImport);
} else if (process.argv.includes('--faang')) {
    runImport(CONFIG.faangImport);
} else if (process.argv.includes('--yc')) {
    runImport(CONFIG.ycImport);
} else {
    promptForExecution();
}