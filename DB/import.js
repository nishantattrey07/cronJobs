#!/usr/bin/env node
const { importData } = require('../scraper/transferToDb/src/index');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Check command line arguments
const directMode = process.argv.includes('-d');

// Function to create interactive CLI with arrow key navigation
function createCLI(question, options) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Save current position to rewrite options
        let currentPosition = 0;

        // Helper to render options with cursor
        const renderOptions = () => {
            // Clear previous output (move cursor up by options.length lines)
            readline.moveCursor(process.stdout, 0, -options.length);
            readline.clearScreenDown(process.stdout);

            // Print question and options
            console.log(question);
            options.forEach((option, i) => {
                const prefix = i === currentPosition ? '> ' : '  ';
                console.log(`${prefix}${option}`);
            });
        };

        // Initial render
        console.log(question);
        options.forEach((option, i) => {
            const prefix = i === currentPosition ? '> ' : '  ';
            console.log(`${prefix}${option}`);
        });

        // Handle keypresses
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('keypress', (str, key) => {
            if (key.name === 'up' && currentPosition > 0) {
                currentPosition--;
                renderOptions();
            } else if (key.name === 'down' && currentPosition < options.length - 1) {
                currentPosition++;
                renderOptions();
            } else if (key.name === 'return') {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                rl.close();
                resolve(currentPosition);
            } else if (key.name === 'c' && key.ctrl) {
                // Handle Ctrl+C to exit
                process.exit();
            }
        });

        // Enable keypress events
        readline.emitKeypressEvents(process.stdin);
    });
}

// Validate file paths before running import
function validateFilePaths(companiesFile, jobsFile) {
    const errors = [];
    if (!fs.existsSync(companiesFile)) {
        errors.push(`Companies file not found: ${companiesFile}`);
    }
    if (!fs.existsSync(jobsFile)) {
        errors.push(`Jobs file not found: ${jobsFile}`);
    }
    return errors;
}

async function runImport() {
    try {
        console.log('🚀 Starting data import wizard...');

        let companiesFile, jobsFile;

        if (directMode) {
            // If -d flag is present, directly use combined files mode
            console.log('\n📊 Using combined files mode (direct)');
            companiesFile = path.resolve(__dirname, '../scraper/output/all_companies_combined.json');
            jobsFile = path.resolve(__dirname, '../scraper/output/all_jobs_combined.json');
        } else {
            // Setup for capturing keypress events
            if (typeof process.stdin.setRawMode !== 'function') {
                console.error('❌ This script requires an interactive terminal');
                process.exit(1);
            }

            // First choice: Combined or Distributed files
            const fileOption = await createCLI(
                'Please select the file distribution type:',
                ['Combined files', 'Distributed files']
            );

            if (fileOption === 0) {
                // User selected Combined files
                console.log('\n📊 Using combined files mode');
                companiesFile = path.resolve(__dirname, '../scraper/output/all_companies_combined.json');
                jobsFile = path.resolve(__dirname, '../scraper/output/all_jobs_combined.json');
            } else {
                // User selected Distributed files
                console.log('\n📊 Using distributed files mode');

                // Second choice: Distribution A or B
                const distributionOption = await createCLI(
                    'Please select the distribution type:',
                    ['Distribution A', 'Distribution B']
                );

                if (distributionOption === 0) {
                    console.log('\n📊 Using Distribution A');
                    companiesFile = path.resolve(__dirname, '../scraper/output/split_data/companies_A.json');
                    jobsFile = path.resolve(__dirname, '../scraper/output/split_data/jobs_A.json');
                } else {
                    console.log('\n📊 Using Distribution B');
                    companiesFile = path.resolve(__dirname, '../scraper/output/split_data/companies_B.json');
                    jobsFile = path.resolve(__dirname, '../scraper/output/split_data/jobs_B.json');
                }
            }
        }

        console.log(`📂 Expected companies file location: ${companiesFile}`);
        console.log(`📂 Expected jobs file location: ${jobsFile}`);

        // Validate file paths
        const errors = validateFilePaths(companiesFile, jobsFile);
        if (errors.length > 0) {
            console.error('\n❌ File validation failed:');
            errors.forEach(error => console.error(` - ${error}`));
            console.log('\n📋 Make sure to place your files in the following locations:');
            console.log(' - For combined files: ../scraper/output/all_companies_combined.json and ../scraper/output/all_jobs_combined.json');
            console.log(' - For distributed files A: ../scraper/output/split_data/companies_A.json and ./output/split_data/jobs_A.json');
            console.log(' - For distributed files B: ../scraper/output/split_data/companies_B.json and ./output/split_data/jobs_B.json');
            process.exit(1);
        }

        console.log('\n⏱️ This approach is optimized for performance and should complete in minutes instead of hours');

        // Run the import - Use 'insert' for new data or 'upsert' to update existing data
        const stats = await importData({
            companiesFile,
            jobsFile,
            mode: 'insert' // Change to 'upsert' to update existing records
        });

        console.log('\n✨ Import complete!');
        console.log(`⏱️ Total duration: ${stats.duration.toFixed(2)} seconds`);
        console.log(`📊 Stats: ${stats.companiesProcessed} companies and ${stats.jobsProcessed} jobs processed`);
        console.log(`📈 Performance: ${Math.round(stats.jobsProcessed / (stats.duration / 60))} jobs per minute`);

    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

// Run the import
runImport();