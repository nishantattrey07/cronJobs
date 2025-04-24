const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// --- Configuration ---
const INPUT_FILE = path.join('output','yc_companies.json');
const OUTPUT_DIR = path.join('output', 'jobs_data');
const BASE_URL = 'https://www.ycombinator.com/companies';
const REQUEST_DELAY_MS = 500; // Delay between requests/batches in milliseconds
const BATCH_SIZE = 50; // Number of companies to process concurrently
const ERROR_LOG_FILE = path.join('output', 'error_companies.json');
const SKIPPED_LOG_FILE = path.join('output', 'skipped_companies.json');
// ---

// Helper function for delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
}

/**
 * Fetches HTML for a company's jobs page.
 * @param {string} slug - The company slug.
 * @returns {Promise<string|null>} HTML content or null on error.
 */
async function fetchJobsPageHTML(slug) {
    const url = `${BASE_URL}/${slug}/jobs`;
    console.log(`Fetching jobs page: ${url}`);
    try {
        const response = await axios.get(url, {
            timeout: 30000, // 30 second timeout
            headers: { // Add headers to mimic a browser visit
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
        });
        if (response.status === 200) {
            return response.data;
        } else {
            console.error(`[${slug}] Received non-200 status: ${response.status}`);
            return null;
        }
    } catch (error) {
        // Handle 404s gracefully (company might not have a jobs page or slug changed)
        if (error.response && error.response.status === 404) {
            console.warn(`[${slug}] Jobs page not found (404). Skipping.`);
        } else {
            console.error(`[${slug}] Error fetching jobs page ${url}:`, error.message);
            // Log less verbose error details for generic fetches
            if (error.response) {
                console.error(`[${slug}] Error Status: ${error.response.status}`);
            }
        }
        return null;
    }
}

/**
 * Extracts job postings and status from the jobs page HTML,
 * primarily relying on the embedded JSON data.
 * @param {string} html - The HTML content of the jobs page.
 * @param {string} slug - The company slug (for logging).
 * @returns {object|null} Object containing jobs and status, or null if extraction fails or yields no data.
 */
function extractDataFromHTML(html, slug) {
    try {
        const $ = cheerio.load(html);
        let jobPostings = [];
        let companyStatus = 'Unknown';

        // Extract company status based on text only
        const statusDiv = $('.ycdc-card-new.space-y-1\\.5').find('.flex.flex-row.justify-between').filter(function () {
            return $(this).find('span').first().text().trim() === 'Status:';
        });

        if (statusDiv.length > 0) {
            const statusText = statusDiv.find('span').last().text().trim();
            if (statusText) {
                // Get clean status text without any extra spaces
                companyStatus = statusText.replace(/\s+/g, ' ').trim();
                console.log(`[${slug}] Found status: ${companyStatus}`);
            }
        }

        // Extract data from the data-page JSON
        const dataPageElement = $('div[data-page]');
        if (dataPageElement.length > 0) {
            const dataPageJsonString = dataPageElement.attr('data-page');
            if (dataPageJsonString) {
                const pageData = JSON.parse(dataPageJsonString);
                const props = pageData.props || {};

                // Extract job postings
                if (Array.isArray(props.jobPostings)) {
                    jobPostings = props.jobPostings;
                    console.log(`[${slug}] Extracted ${jobPostings.length} job postings from JSON.`);
                }
            }
        }

        return {
            jobPostings,
            status: companyStatus,
            metadata: {
                lastScraped: new Date().toISOString(),
                scrapedUrl: `${BASE_URL}/${slug}/jobs`
            }
        };
    } catch (error) {
        console.error(`[${slug}] Error during extraction:`, error);
        return {
            jobPostings: [],
            status: 'Unknown',
            error: error.message
        };
    }
}

/**
 * Processes a single company: fetches jobs page, extracts data, saves to file.
 * @param {object} company - The company object (must have name and slug).
 * @returns {Promise<{status: string, slug: string, name: string, reason?: string}>} Status of processing for this company.
 */
async function processCompany(company) {
    const companyName = company.name || '(no name)';
    const companySlug = company.slug || 'unknown';

    if (!company.slug) {
        console.warn(`Skipping company ${companyName} due to missing slug.`);
        return {
            status: 'skipped',
            slug: companySlug,
            name: companyName,
            reason: 'Missing slug'
        };
    }

    try {
        const html = await fetchJobsPageHTML(company.slug);

        if (html) {
            const extractedData = extractDataFromHTML(html, company.slug);
            const outputFilename = path.join(OUTPUT_DIR, `${company.slug}.json`);
            try {
                fs.writeFileSync(outputFilename, JSON.stringify(extractedData, null, 2));
                return { status: 'success', slug: companySlug, name: companyName };
            } catch (writeError) {
                console.error(`[${company.slug}] Error writing file ${outputFilename}:`, writeError);
                return {
                    status: 'error',
                    slug: companySlug,
                    name: companyName,
                    reason: `File write error: ${writeError.message}`
                };
            }
        } else {
            // Handle case where fetchJobsPageHTML returned null
            return {
                status: 'skipped',
                slug: companySlug,
                name: companyName,
                reason: 'Failed to fetch HTML content'
            };
        }
    } catch (error) {
        // Handle any unexpected errors
        console.error(`[${company.slug}] Unexpected error:`, error);
        return {
            status: 'error',
            slug: companySlug,
            name: companyName,
            reason: `Unexpected error: ${error.message}`
        };
    }
}

/**
 * Main function to process all companies.
 */
async function processCompanies() {
    console.log(`Reading company list from ${INPUT_FILE}...`);
    let companies;
    try {
        const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
        companies = JSON.parse(fileContent);
        console.log(`Loaded ${companies.length} companies.`);
    } catch (error) {
        console.error(`Failed to read or parse input file ${INPUT_FILE}:`, error);
        return; // Stop if input file is missing or invalid
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let errorCompanies = [];
    let skippedCompanies = [];

    // Process companies in batches
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
        const batch = companies.slice(i, i + BATCH_SIZE);
        console.log(`\n--- Processing Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(companies.length / BATCH_SIZE)} (Companies ${i + 1} to ${Math.min(i + BATCH_SIZE, companies.length)}) ---`);

        const batchPromises = batch.map(company => processCompany(company));

        try {
            const results = await Promise.all(batchPromises);

            // Update counts based on results
            results.forEach(result => {
                if (result.status === 'success') {
                    successCount++;
                } else if (result.status === 'error') {
                    errorCount++;
                    errorCompanies.push({
                        slug: result.slug,
                        name: result.name,
                        reason: result.reason || 'Unknown error',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    skippedCount++;
                    skippedCompanies.push({
                        slug: result.slug,
                        name: result.name,
                        reason: result.reason || 'Unknown skip reason',
                        timestamp: new Date().toISOString()
                    });
                }
            });

            console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} finished. Current totals - Success: ${successCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

        } catch (batchError) {
            console.error(`Error processing batch starting at index ${i}:`, batchError);
            errorCount += batch.length;
            // Add batch errors to error companies list
            batch.forEach(company => {
                errorCompanies.push({
                    slug: company.slug || 'unknown',
                    name: company.name || 'unknown',
                    reason: `Batch processing error: ${batchError.message}`,
                    timestamp: new Date().toISOString()
                });
            });
        }

        // Wait before starting the next batch
        if (i + BATCH_SIZE < companies.length) {
            console.log(`--- Delaying ${REQUEST_DELAY_MS}ms before next batch ---`);
            await sleep(REQUEST_DELAY_MS);
        }
    }

    // Ensure output directory exists for error and skipped files
    const outputDir = path.dirname(ERROR_LOG_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write error companies to file
    if (errorCompanies.length > 0) {
        try {
            fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(errorCompanies, null, 2));
            console.log(`\nDetails for ${errorCompanies.length} error companies saved to ${ERROR_LOG_FILE}`);
        } catch (writeError) {
            console.error(`\nError writing error companies file:`, writeError);
        }
    }

    // Write skipped companies to file
    if (skippedCompanies.length > 0) {
        try {
            fs.writeFileSync(SKIPPED_LOG_FILE, JSON.stringify(skippedCompanies, null, 2));
            console.log(`\nDetails for ${skippedCompanies.length} skipped companies saved to ${SKIPPED_LOG_FILE}`);
        } catch (writeError) {
            console.error(`\nError writing skipped companies file:`, writeError);
        }
    }

    console.log(`\n--- Processing Complete ---`);
    console.log(`Successfully processed and saved: ${successCount}`);
    console.log(`Skipped (404/no slug/no data): ${skippedCount}`);
    console.log(`Errors (fetch/extract/write): ${errorCount}`);
}

// --- Run the scraper ---
processCompanies();