const fs = require('fs');
const path = require('path');
const companiesConfig = require('../config/companies');

// Define the base output directory
const outputDir = './output';

// Define the folders to process
const folders = ['a16z', 'sequoia', 'sequoia_IN', 'lightspeed'];

// Array to store all companies
let allCompanies = [];

// Map to track duplicates
const companyDomainMap = new Map();
const duplicatesLog = [];

// Object to store statistics
let stats = {
    totalCompaniesProcessed: 0,
    uniqueCompanies: 0,
    duplicateCompanies: 0,
    companiesPerFolder: {},
    duplicateDetails: []
};

// Function to get the dataSource value for a folder
function getDataSourceForFolder(folderName) {
    // Find the config entry that corresponds to this folder
    const configEntry = Object.entries(companiesConfig).find(([key, config]) =>
        config.outputDir.includes(`/${folderName}`)
    );

    // Return the dataSource if found, otherwise use folderName as fallback
    return configEntry ? configEntry[1].dataSource : folderName;
}

// Function to process each folder
async function processFolder(folderName) {
    try {
        const filePath = path.join(outputDir, folderName, 'all_companies.json');
        const rawData = await fs.promises.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);
        const companies = jsonData.companies || [];

        if (companies.length === 0) {
            console.log(`No companies found in ${folderName}/all_companies.json`);
            return;
        }

        // Get the dataSource value for this folder
        const dataSource = getDataSourceForFolder(folderName);

        // Update statistics
        stats.companiesPerFolder[folderName] = companies.length;
        stats.totalCompaniesProcessed += companies.length;

        // Process each company
        companies.forEach(company => {
            const domain = company.domain || company.companyDomain;

            if (companyDomainMap.has(domain)) {
                // This is a duplicate
                stats.duplicateCompanies++;
                const existingEntry = companyDomainMap.get(domain);
                duplicatesLog.push({
                    domain,
                    name: company.name,
                    foundIn: [existingEntry.sourceFolder, folderName]
                });
            } else {
                // This is a new company - add dataSource here
                companyDomainMap.set(domain, {
                    ...company,
                    sourceFolder: folderName,
                    dataSource: dataSource
                });
            }
        });

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`File not found: ${folderName}/all_companies.json`);
        } else {
            console.error(`Error processing ${folderName}:`, error.message);
        }
    }
}

// Function to write combined file and display statistics
async function writeCombinedFile() {
    try {
        const combinedFilePath = path.join(outputDir, 'all_companies_combined.json');

        // Convert Map to Array for the final output
        const uniqueCompanies = Array.from(companyDomainMap.values());
        stats.uniqueCompanies = uniqueCompanies.length;

        // Create the combined data structure
        const combinedData = {
            metadata: {
                totalCompaniesProcessed: stats.totalCompaniesProcessed,
                uniqueCompanies: stats.uniqueCompanies,
                duplicateCompanies: stats.duplicateCompanies,
                companiesPerFolder: stats.companiesPerFolder,
                lastUpdated: new Date().toISOString(),
                companiesArrayLength: uniqueCompanies.length
            },
            duplicateEntries: duplicatesLog,
            companies: uniqueCompanies
        };

        // Write the combined file
        await fs.promises.writeFile(
            combinedFilePath,
            JSON.stringify(combinedData, null, 2),
            'utf8'
        );

        // Display detailed statistics
        console.log('\n=== Companies Statistics ===');
        console.log(`Total companies processed: ${stats.totalCompaniesProcessed}`);
        console.log(`Unique companies: ${stats.uniqueCompanies}`);
        console.log(`Duplicate entries found: ${stats.duplicateCompanies}`);
        console.log(`Length of companies array: ${uniqueCompanies.length}`);

        console.log('\nCompanies per folder:');
        for (const [folder, count] of Object.entries(stats.companiesPerFolder)) {
            console.log(`  ${folder}: ${count} companies`);
        }

        console.log('\nDuplicate companies found:');
        duplicatesLog.forEach(dup => {
            console.log(`  ${dup.name} (${dup.domain}) found in: ${dup.foundIn.join(', ')}`);
        });

        console.log('\nCombined file created: all_companies_combined.json');

    } catch (error) {
        console.error('Error writing combined file:', error.message);
    }
}

// Main function to process all folders
async function main() {
    console.log('Starting to process folders...');

    // Process each folder
    for (const folder of folders) {
        console.log(`\nProcessing ${folder}...`);
        await processFolder(folder);
    }

    // Write the combined file and display statistics
    await writeCombinedFile();

    console.log('\nProcessing complete!');
}

module.exports = async function () {
    console.log('Starting to process folders...');
    try {

        await main();
        console.log('\nProcessing complete!');
        return true;
    } catch (error) {
        console.error('Fatal error:', error);
        return false;
    }
}