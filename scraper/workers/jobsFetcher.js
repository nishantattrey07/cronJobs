const fs = require('fs');
const axios = require('axios');
const { setTimeout } = require('timers/promises');
const companies = require('../config/companies');
const chalk = require('chalk');

// List of user agents to rotate
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/89.0'
];

let currentUserAgentIndex = 0;

// Function to get next user agent
function getNextUserAgent() {
    const userAgent = userAgents[currentUserAgentIndex];
    currentUserAgentIndex = (currentUserAgentIndex + 1) % userAgents.length;
    return userAgent;
}

// Function to create axios instance
function createAxiosInstance() {
    return axios.create({
        timeout: 10000,
        headers: {
            'User-Agent': getNextUserAgent(),
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
}

// Function to make API request with retry logic
async function makeRequest(companyId, numJobs, companyConfig, retries = 3) {
    const MAX_JOBS_PER_REQUEST = 1000;
    const allJobs = [];
    const numRequests = Math.ceil(numJobs / MAX_JOBS_PER_REQUEST);
    let sequenceToken = null;

    for (let requestIndex = 0; requestIndex < numRequests; requestIndex++) {
        const currentBatchSize = Math.min(MAX_JOBS_PER_REQUEST, numJobs - (requestIndex * MAX_JOBS_PER_REQUEST));

        for (let i = 0; i < retries; i++) {
            try {
                console.log(chalk.blue(`[${companyId}] Request ${requestIndex + 1}/${numRequests} (batch size: ${currentBatchSize})`));

                const axiosInstance = createAxiosInstance();
                const requestBody = {
                    board: { id: companyId.toLowerCase(), isParent: false },
                    query: { promoteFeatured: true },
                    meta: {
                        size: currentBatchSize,
                        ...(sequenceToken && { sequence: sequenceToken })
                    },
                    parentSlug: companyConfig.parentSlug
                };

                const response = await axiosInstance.post(`${companyConfig.jobsApiEndpoint}/search-jobs`, requestBody);

                if (response.data.errors && response.data.errors.length > 0) {
                    console.log(chalk.red(`[${companyId}] API returned errors`));
                    return false;
                }

                if (response.data.jobs) {
                    allJobs.push(...response.data.jobs);
                }

                if (response.data.meta && response.data.meta.sequence) {
                    sequenceToken = response.data.meta.sequence;
                }

                if (requestIndex === numRequests - 1) {
                    // Create company_jobs directory if it doesn't exist
                    const companyJobsDir = `${companyConfig.outputDir}/company_jobs`;
                    if (!fs.existsSync(companyJobsDir)) {
                        fs.mkdirSync(companyJobsDir, { recursive: true });
                    }

                    const fileName = `${companyJobsDir}/${companyId.toLowerCase()}_jobs.json`;
                    fs.writeFileSync(fileName, JSON.stringify({
                        ...response.data,
                        jobs: allJobs
                    }, null, 2));
                    console.log(chalk.green(`[${companyId}] Successfully fetched ${allJobs.length} jobs`));
                    return true;
                }

                await setTimeout(2000);
                break;
            } catch (error) {
                console.log(chalk.red(`[${companyId}] Attempt ${i + 1}/${retries} failed`));
                if (i < retries - 1) {
                    const delay = Math.pow(2, i) * 1000;
                    console.log(chalk.yellow(`[${companyId}] Waiting ${delay.toFixed(0)}ms before retry...`));
                    await setTimeout(delay);
                }
            }
        }
    }
    return false;
}

// Function to save failed company to file
function saveFailedCompany(company, companyConfig) {
    let failedCompanies = [];
    const failedCompaniesFile = `${companyConfig.outputDir}/failed_companies.json`;

    // Read existing failed companies if file exists
    if (fs.existsSync(failedCompaniesFile)) {
        failedCompanies = JSON.parse(fs.readFileSync(failedCompaniesFile, 'utf8'));
    }

    // Add new failed company if not already in the list
    if (!failedCompanies.some(fc => fc.id === company.id)) {
        failedCompanies.push(company);
        fs.writeFileSync(failedCompaniesFile, JSON.stringify(failedCompanies, null, 2));
    }
}

// Function to process failed companies
async function processFailedCompanies(companyConfig) {
    const failedCompaniesFile = `${companyConfig.outputDir}/failed_companies.json`;

    if (!fs.existsSync(failedCompaniesFile)) {
        console.log(chalk.yellow(`No failed companies to process for ${companyConfig.name}.`));
        return true;
    }

    try {
        const failedCompanies = JSON.parse(fs.readFileSync(failedCompaniesFile, 'utf8'));
        const totalFailedCompanies = failedCompanies.length;

        if (totalFailedCompanies === 0) {
            console.log(chalk.yellow(`No failed companies to process for ${companyConfig.name}.`));
            return true;
        }

        console.log(chalk.cyan(`\nProcessing ${totalFailedCompanies} failed companies for ${companyConfig.name}...\n`));

        let successCount = 0;
        let failureCount = 0;
        let remainingCompanies = [];

        for (let i = 0; i < failedCompanies.length; i++) {
            const company = failedCompanies[i];
            const currentProgress = i + 1;

            // Add random delay between requests (2-5 seconds)
            const delay = Math.random() * 3000 + 2000;
            console.log(chalk.yellow(`[${currentProgress}/${totalFailedCompanies}] Waiting ${delay.toFixed(0)}ms before next request...`));
            await setTimeout(delay);

            const success = await makeRequest(company.slug, company.numJobs, companyConfig);
            if (success) {
                successCount++;
                console.log(chalk.green(`[${currentProgress}/${totalFailedCompanies}] ✓ Successfully fetched and saved data for ${company.id}`));
            } else {
                failureCount++;
                console.log(chalk.red(`[${currentProgress}/${totalFailedCompanies}] ✗ Failed to fetch data for ${company.id} after all retries`));
                remainingCompanies.push(company);
            }
        }

        // Update failed companies file with remaining companies
        fs.writeFileSync(failedCompaniesFile, JSON.stringify(remainingCompanies, null, 2));

        // Print summary
        console.log(chalk.cyan(`\nFailed Companies Processing Summary for ${companyConfig.name}:`));
        console.log(chalk.gray('----------------------------------'));
        console.log(chalk.white(`Total failed companies processed: ${totalFailedCompanies}`));
        console.log(chalk.green(`Successful retries: ${successCount}`));
        console.log(chalk.red(`Failed retries: ${failureCount}`));
        console.log(chalk.yellow(`Remaining failed companies: ${remainingCompanies.length}`));
        if (remainingCompanies.length > 0) {
            console.log(chalk.yellow(`Remaining failed companies have been saved to ${failedCompaniesFile}`));
        }
        console.log(chalk.gray('----------------------------------\n'));

        return true;
    } catch (error) {
        console.error(chalk.red(`Error processing failed companies for ${companyConfig.name}:`, error));
        return false;
    }
}

// Function to process companies for a specific source
async function processCompaniesForSource(companyKey, companyConfig) {
    try {
        console.log(chalk.cyan(`\nStarting to process companies for ${companyConfig.name}...`));

        // Ensure the output directory exists
        if (!fs.existsSync(companyConfig.outputDir)) {
            fs.mkdirSync(companyConfig.outputDir, { recursive: true });
        }

        // Read companies from the source-specific directory
        const companyJobs = JSON.parse(fs.readFileSync(`${companyConfig.outputDir}/companiesWithJobs.json`, 'utf8'));
        const totalCompanies = companyJobs.length;

        // Create company_jobs directory if it doesn't exist
        const companyJobsDir = `${companyConfig.outputDir}/company_jobs`;
        if (!fs.existsSync(companyJobsDir)) {
            fs.mkdirSync(companyJobsDir, { recursive: true });
        }

        console.log(chalk.cyan(`\nProcessing ${totalCompanies} companies for ${companyConfig.name}`));
        console.log(chalk.gray('----------------------------------------'));

        const BATCH_SIZE = 5;
        const totalBatches = Math.ceil(companyJobs.length / BATCH_SIZE);
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < companyJobs.length; i += BATCH_SIZE) {
            const batch = companyJobs.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

            console.log(chalk.blue(`\nProcessing Batch ${batchNumber}/${totalBatches} (${batch.length} companies)`));
            console.log(chalk.gray('----------------------------------------'));

            const batchPromises = batch.map(async (company) => {
                const delay = Math.random() * 3000 + 2000;
                console.log(chalk.yellow(`[${company.id}] Waiting ${delay.toFixed(0)}ms before next request...`));
                await setTimeout(delay);

                const success = await makeRequest(company.slug, company.numJobs, companyConfig);
                if (success) {
                    successCount++;
                } else {
                    failureCount++;
                    saveFailedCompany(company, companyConfig);
                }
            });

            await Promise.all(batchPromises);
        }

        // Print summary for this company
        console.log(chalk.cyan(`\n${companyConfig.name} Processing Summary:`));
        console.log(chalk.gray('----------------------------------------'));
        console.log(chalk.white(`Total Companies: ${totalCompanies}`));
        console.log(chalk.green(`Successfully Processed: ${successCount}`));
        console.log(chalk.red(`Failed: ${failureCount}`));
        console.log(chalk.gray('----------------------------------------\n'));

        if (failureCount > 0) {
            console.log(chalk.cyan(`Processing failed companies for ${companyConfig.name}...`));
            await processFailedCompanies(companyConfig);
        }

        return true;
    } catch (error) {
        console.error(chalk.red(`Error processing companies for ${companyConfig.name}:`, error));
        return false;
    }
}

// Main function to process all companies
async function scrapeAllCompanyJobs() {
    try {
        console.log(chalk.cyan('\nStarting to process companies from all sources...'));

        const results = await Promise.all(
            Object.entries(companies).map(([key, config]) =>
                processCompaniesForSource(key, config)
            )
        );

        const successCount = results.filter(result => result).length;
        const totalCount = results.length;

        console.log(chalk.cyan('\nOverall Processing Summary:'));
        console.log(chalk.gray('----------------------------------------'));
        console.log(chalk.white(`Total Sources: ${totalCount}`));
        console.log(chalk.green(`Successfully Processed: ${successCount}`));
        console.log(chalk.red(`Failed: ${totalCount - successCount}`));
        console.log(chalk.gray('----------------------------------------\n'));

        return results.every(result => result);
    } catch (error) {
        console.error(chalk.red('Error in main process:', error));
        return false;
    }
}

module.exports = scrapeAllCompanyJobs;