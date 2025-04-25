#!/usr/bin/env node

/**
 * Optimized DB Import Runner with Memory Management
 * 
 * This script runs the universal import with:
 * 1. Forced garbage collection between steps
 * 2. Memory usage monitoring
 * 3. Automatic restart on failure
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Track memory usage
let memoryUsage = [];
const LOG_FILE = 'import_run_log.txt';

// Helper to log with timestamp
function log(message) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] ${message}`;
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Initialize log file
fs.writeFileSync(LOG_FILE, `=== Import Run Started at ${new Date().toISOString()} ===\n`);

// Log memory usage periodically
function monitorMemory() {
    const mem = process.memoryUsage();
    const memoryData = {
        timestamp: new Date().toISOString(),
        rss: Math.round(mem.rss / 1024 / 1024), // RSS in MB
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024), // Heap total in MB
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // Heap used in MB
        external: Math.round(mem.external / 1024 / 1024) // External in MB
    };

    memoryUsage.push(memoryData);

    log(`Memory: RSS ${memoryData.rss}MB | Heap ${memoryData.heapUsed}MB/${memoryData.heapTotal}MB`);

    if (memoryData.heapUsed > 1024) {
        log('WARNING: High memory usage detected!');
    }

    // Save memory usage to file
    fs.writeFileSync('memory_usage.json', JSON.stringify(memoryUsage, null, 2));
}

// Execute universal-import
function runImport(options = {}) {
    return new Promise((resolve, reject) => {
        const {
            step = 'all',
            retryCount = 0,
            maxRetries = 3
        } = options;

        log(`Starting import step: ${step} (attempt ${retryCount + 1}/${maxRetries + 1})`);

        // Setup command arguments
        let args = ['--expose-gc', 'universal-import.js'];

        if (step === 'all') {
            args.push('--run-all');
        } else if (step === 'main') {
            args.push('--main');
        } else if (step === 'faang') {
            args.push('--faang');
        } else if (step === 'yc') {
            args.push('--yc');
        }

        // Run with Node with garbage collection exposed
        const child = spawn('node', args, {
            stdio: 'inherit',
            env: {
                ...process.env,
                // Use a smaller batch size for all operations to reduce memory usage
                BATCH_SIZE: '100',
                NODE_OPTIONS: '--max-old-space-size=4096'
            }
        });

        // Setup memory monitoring interval
        const memoryMonitor = setInterval(monitorMemory, 30000); // Every 30 seconds

        child.on('close', (code) => {
            clearInterval(memoryMonitor); // Stop memory monitoring

            if (code === 0) {
                log(`Import step ${step} completed successfully`);
                resolve(true);
            } else {
                log(`Import step ${step} failed with code ${code}`);

                if (retryCount < maxRetries) {
                    log(`Will retry after cleanup (attempt ${retryCount + 2}/${maxRetries + 1})...`);

                    // Force garbage collection
                    if (global.gc) {
                        log('Running forced garbage collection...');
                        global.gc();
                    }

                    // Wait a bit before retrying
                    setTimeout(() => {
                        runImport({
                            step,
                            retryCount: retryCount + 1,
                            maxRetries
                        }).then(resolve).catch(reject);
                    }, 10000); // Wait 10 seconds before retry
                } else {
                    log(`Maximum retries (${maxRetries}) reached for step ${step}. Giving up.`);
                    reject(new Error(`Import step ${step} failed after ${maxRetries + 1} attempts`));
                }
            }
        });

        child.on('error', (error) => {
            clearInterval(memoryMonitor);
            log(`Error starting import process: ${error.message}`);
            reject(error);
        });
    });
}

// Run the different import steps in sequence
async function runSequentialImport() {
    const startTime = Date.now();

    log('Starting optimized import process...');
    log('Step 1: Clear memory resources');

    // Force garbage collection if available
    if (global.gc) {
        log('Running initial garbage collection...');
        global.gc();
    }

    try {
        // Run each step separately to better manage memory between steps
        log('Step 2: Running main data import...');
        await runImport({ step: 'main' });

        // Pause and clean up between steps
        if (global.gc) global.gc();
        log('Main import completed. Pausing before next step...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        log('Step 3: Running FAANG data import...');
        await runImport({ step: 'faang' });

        // Pause and clean up between steps
        if (global.gc) global.gc();
        log('FAANG import completed. Pausing before next step...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        log('Step 4: Running YC data import...');
        await runImport({ step: 'yc' });

        // Calculate total runtime
        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        log(`Import process completed successfully in ${totalTime} minutes`);

        // Write final memory stats
        if (global.gc) global.gc();
        monitorMemory();

    } catch (error) {
        const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        log(`Import process failed after ${totalTime} minutes: ${error.message}`);
        process.exit(1);
    }
}

// Start the import process
runSequentialImport();