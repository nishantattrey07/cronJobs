const fetchCompanies = require('./workers/fetchCompanies');
const filterCompaniesDetails = require('./workers/filterCompaniesDetails');
const scrapeCompanyJobs = require('./workers/jobsFetcher.js');
const extractAllJobs = require('./workers/allJobs.js');
const extractAllCompanies = require('./workers/companies.js');
const distributeFiles = require('./workers/distribute.js');

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const skipDistribution = args.includes('-d'); // runs whole script + distribution
    const distributionOnly = args.includes('-od');  // Distribution only flag

    let success;

    // If distributionOnly flag is set, only run the distribution step
    if (distributionOnly) {
        console.log('Running in distribution-only mode...');
        console.log('Distribution of combined jobs and companies json into two parts started');
        success = await distributeFiles();
        if (success) {
            console.log('Distribution Completed');
        } else {
            console.log("Distribution failed");
        }
        return;
    }

    // Regular flow for other cases
    console.log('Fetching companies data...');
    success = await fetchCompanies();
    if (success) {
        console.log('Successfully fetched and saved companies data to output/all_companies.json');
    } else {
        console.log('Failed to fetch companies data');
    }

    console.log('Filtering companies details...');
    success = await filterCompaniesDetails();
    if (success) {
        console.log('Successfully filtered companies details');
    } else {
        console.log('Failed to filter companies data');
    }

    console.log('Scrapping Companies Jobs');
    success = await scrapeCompanyJobs();
    if (success) {
        console.log('Scraping completed successfully');
    } else {
        console.log('Scraping failed');
    }

    console.log('Extracting Companies and combining in single file');
    success = await extractAllCompanies();
    if (success) {
        console.log('Companies Extracted and saved in single file');
    } else {
        console.log("Companies and extraction to single file failed");
    }

    console.log('Extracting Jobs and combining in single file');
    success = await extractAllJobs();
    if (success) {
        console.log('Jobs Extracted and saved in new folder');
    } else {
        console.log("Extraction of Jobs and Saving to single file failed");
    }

    
    if (skipDistribution) {
        console.log('Distribution of combined jobs and companies json into two parts started');
        success = await distributeFiles();
        if (success) {
            console.log('Distribution Completed');
        } else {
            console.log("Distribution failed");
        }
    } else {
        console.log('To run distribution without starting over use -od flag');
    }
}

main();