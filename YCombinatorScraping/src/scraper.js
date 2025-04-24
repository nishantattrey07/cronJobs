const fs = require('fs'); // Using CommonJS require
const path = require('path'); // To handle file paths
const axios = require('axios'); // Using CommonJS require

// --- Constants based on urls.txt ---
const ALGOLIA_URL = 'https://45bwzj1sgc-dsn.algolia.net/1/indexes/*/queries';
const ALGOLIA_APP_ID = '45BWZJ1SGC';
// Use the exact complex value found for the API key query parameter
const ALGOLIA_API_KEY_PARAM_VALUE = 'MjBjYjRiMzY0NzdhZWY0NjExY2NhZjYxMGIxYjc2MTAwNWFkNTkwNTc4NjgxYjU0YzFhYTY2ZGQ5OGY5NDMxZnJlc3RyaWN0SW5kaWNlcz0lNUIlMjJZQ0NvbXBhbnlfcHJvZHVjdGlvbiUyMiUyQyUyMllDQ29tcGFueV9CeV9MYXVuY2hfRGF0ZV9wcm9kdWN0aW9uJTIyJTVEJnRhZ0ZpbHRlcnM9JTVCJTIyeWNkY19wdWJsaWMlMjIlNUQmYW5hbHl0aWNzVGFncz0lNUIlMjJ5Y2RjJTIyJTVE';
const HITS_PER_PAGE = 1000; // Max hits per request (sufficient for single batch)
const OUTPUT_DIR = 'output'; // Directory to save files
const COMBINED_FILENAME = 'yc_companies.json';
const SAVE_INDIVIDUAL_BATCH_FILES = false; // Set to false to only save the combined file

// ----------------------------------

// Helper function for delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Makes a POST request to the Algolia API.
 * @param {object} bodyPayload - The JSON payload for the POST request body.
 * @returns {Promise<object>} A promise that resolves to the API response data, or null on error.
 */
async function makeAlgoliaRequest(bodyPayload) {
    const queryParams = new URLSearchParams({
        'x-algolia-agent': 'Algolia for JavaScript (3.35.1); Browser; JS Helper (3.16.1)',
        'x-algolia-application-id': ALGOLIA_APP_ID,
        'x-algolia-api-key': ALGOLIA_API_KEY_PARAM_VALUE
    });
    const url = `${ALGOLIA_URL}?${queryParams.toString()}`;

    try {
        const response = await axios.post(url, bodyPayload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            // Increase timeout slightly for potentially larger requests
            timeout: 30000 // 30 seconds
        });
        return response.data;
    } catch (error) {
        console.error(`Error making Algolia request:`, error.message);
        if (error.response) {
            console.error('Error Response Status:', error.response.status);
            console.error('Error Response Data:', JSON.stringify(error.response.data).substring(0, 500)); // Log first 500 chars
        } else if (error.request) {
            console.error('Error Request:', 'No response received.');
        } else {
            console.error('Error Config:', error.config);
        }
        return null; // Return null on error
    }
}

/**
 * Fetches the initial facet data, specifically the list of batches.
 * @returns {Promise<object|null>} A promise that resolves to the batch facets object, or null on error.
 */
async function fetchFacets() {
    console.log('Fetching initial facet data to get batch list...');
    const bodyPayload = {
        "requests": [{
            "indexName": "YCCompany_production",
            // Request facets, only need 1 hit to get facets
            "params": `facets=%5B%22batch%22%5D&hitsPerPage=1&attributesToRetrieve=%5B%5D`
        }]
    };

    const data = await makeAlgoliaRequest(bodyPayload);

    if (data && data.results && data.results.length > 0 && data.results[0].facets && data.results[0].facets.batch) {
        console.log(`Found ${Object.keys(data.results[0].facets.batch).length} batches.`);
        // Filter out "Unspecified" batch if necessary (though fetching it might be harmless)
        // delete data.results[0].facets.batch['Unspecified'];
        return data.results[0].facets.batch;
    } else {
        console.error('Could not retrieve batch facets from the initial request.');
        console.error('Response data:', JSON.stringify(data));
        return null;
    }
}


/**
 * Fetches all company data for a specific batch.
 * @param {string} batchName - The name of the batch (e.g., "W22").
 * @returns {Promise<Array>} A promise that resolves to an array of company hits for the batch, or empty array on error.
 */
async function fetchCompaniesForBatch(batchName) {
    console.log(`Fetching companies for batch: ${batchName}...`);
    const bodyPayload = {
        "requests": [{
            "indexName": "YCCompany_production",
            // Filter by batch, get all fields, ensure hitsPerPage is high enough
            "params": `facetFilters=%5B%5B%22batch%3A${encodeURIComponent(batchName)}%22%5D%5D&hitsPerPage=${HITS_PER_PAGE}&page=0`
            // Note: We don't need to specify all facets again when filtering
        }]
    };

    const data = await makeAlgoliaRequest(bodyPayload);

    if (data && data.results && data.results.length > 0 && Array.isArray(data.results[0].hits)) {
        const hits = data.results[0].hits;
        console.log(` -> Fetched ${hits.length} companies for batch ${batchName}.`);
        return hits;
    } else {
        console.warn(`No hits array found or unexpected structure for batch ${batchName}.`);
        return [];
    }
}

/**
 * Fetches all companies by iterating through batches and combines the results.
 */
async function fetchAllCompaniesByBatch() {
    let allCompanies = [];
    const batchFacets = await fetchFacets();

    if (!batchFacets) {
        console.error("Cannot proceed without batch list. Exiting.");
        return;
    }

    const batchNames = Object.keys(batchFacets); //.filter(b => b !== 'Unspecified'); // Optional: filter out unspecified

    console.log(`\nStarting to fetch companies for ${batchNames.length} batches...`);

    for (const batchName of batchNames) {
        const companiesInBatch = await fetchCompaniesForBatch(batchName);

        if (companiesInBatch && companiesInBatch.length > 0) {
            // Append to the combined list
            allCompanies = allCompanies.concat(companiesInBatch);

            // --- Save individual batch file (Optional) ---
            if (SAVE_INDIVIDUAL_BATCH_FILES) {
                const batchFileName = path.join(OUTPUT_DIR, `batch_${batchName.replace(/[^a-z0-9]/gi, '_')}.json`); // Sanitize filename
                try {
                    fs.writeFileSync(batchFileName, JSON.stringify(companiesInBatch, null, 2));
                    console.log(`   -> Saved batch data to ${batchFileName}`);
                } catch (writeError) {
                    console.error(`   -> Error writing batch file ${batchFileName}:`, writeError);
                }
            }
            // --- End Optional Section ---

        } else {
            console.warn(` -> No companies found or error fetching batch ${batchName}. Skipping.`);
        }

        // Add a small delay between batch requests to be polite to the API
        await sleep(300); // 300ms delay
    }

    console.log(`\nSuccessfully fetched a total of ${allCompanies.length} companies across all batches.`);

    // --- Save Combined File ---
    const combinedFilePath = path.join(OUTPUT_DIR, COMBINED_FILENAME);
    try {
        fs.writeFileSync(combinedFilePath, JSON.stringify(allCompanies, null, 2));
        console.log(`\nSuccessfully saved all combined company data to ${combinedFilePath}`);
    } catch (writeError) {
        console.error('\nError writing combined company data to file:', writeError);
    }

    // Display first 5 companies as a sample from the combined list
    if (allCompanies.length > 0) {
        console.log("\n--- Sample Data (First 5 Companies from Combined List) ---");
        allCompanies.slice(0, 5).forEach((company, index) => {
            console.log(`${index + 1}. Name: ${company.name} (Batch: ${company.batch})`);
            console.log(`   One Liner: ${company.one_liner}`);
            console.log(`   Website: ${company.website}`);
            console.log('   ---');
        });
    }
}

// --- Run the scraper ---
fetchAllCompaniesByBatch();