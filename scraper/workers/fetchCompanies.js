const fs = require('fs');
const axios = require('axios');
const companies = require('../config/companies');

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

async function fetchCompaniesForSource(companyKey, companyConfig) {
    try {
        console.log(`Fetching companies for ${companyConfig.name}...`);

        // Create output directory if it doesn't exist
        if (!fs.existsSync(companyConfig.outputDir)) {
            fs.mkdirSync(companyConfig.outputDir, { recursive: true });
        }

        const response = await createAxiosInstance().post(`${companyConfig.companyApiEndpoint}/search-companies`, {
            query: {
                parent: companyConfig.parentSlug,
                promoteFeatured: true
            },
            meta: {
                size: companyConfig.maxCompanies
            },
            board: {
                id: companyConfig.parentSlug,
                isParent: true
            }
        });

        // Write the response data to a file
        fs.writeFileSync(
            `${companyConfig.outputDir}/all_companies.json`,
            JSON.stringify(response.data, null, 2)
        );

        console.log(`Successfully fetched companies for ${companyConfig.name}`);
        return true;
    } catch (error) {
        console.error(`Error fetching companies for ${companyConfig.name}:`, error.message);
        return false;
    }
}

async function fetchAllCompanies() {
    try {
        console.log('Starting to fetch companies from all sources...\n');

        // Fetch companies from all sources in parallel
        const results = await Promise.all(
            Object.entries(companies).map(([key, config]) =>
                fetchCompaniesForSource(key, config)
            )
        );

        // Calculate success rate
        const successCount = results.filter(result => result).length;
        const totalCount = results.length;

        console.log('\nFetch Summary:');
        console.log('-------------');
        console.log(`Total sources processed: ${totalCount}`);
        console.log(`Successful fetches: ${successCount}`);
        console.log(`Failed fetches: ${totalCount - successCount}`);

        return results.every(result => result);
    } catch (error) {
        console.error('Error in fetchAllCompanies:', error);
        return false;
    }
}

module.exports = fetchAllCompanies;