const fs = require('fs');
const path = require('path');

// --- Configuration ---
const BASE_COMPANIES_FILE = path.join('output','yc_companies.json');
const JOBS_DATA_DIR = path.join('output', 'jobs_data');
const COMPANY_DETAILS_DIR = path.join('output', 'company_details');
const COMBINED_COMPANIES_OUTPUT_FILE = path.join('output', 'yc_companies_combined.json');
const ALL_JOBS_OUTPUT_FILE = path.join('output', 'all_jobs.json');
const YC_BASE_URL = 'https://www.ycombinator.com';

// Read base companies data
console.log(`Reading base company data from: ${BASE_COMPANIES_FILE}`);
let baseCompanies;
try {
    if (!fs.existsSync(BASE_COMPANIES_FILE)) {
        throw new Error(`Base company file not found at ${BASE_COMPANIES_FILE}`);
    }
    const baseFileContent = fs.readFileSync(BASE_COMPANIES_FILE, 'utf-8');
    baseCompanies = JSON.parse(baseFileContent);
    console.log(`Loaded ${baseCompanies.length} base companies.`);
} catch (error) {
    console.error(`Error reading base company file: ${error.message}`);
    process.exit(1);
}

const combinedCompanies = [];
const allJobPostings = [];
let companiesProcessed = 0;
let companiesMissingData = 0;

console.log(`Processing companies from details directory: ${COMPANY_DETAILS_DIR}`);

for (const company of baseCompanies) {
    const slug = company.slug;
    if (!slug) {
        console.warn(`Skipping company (name: ${company.name || 'N/A'}) due to missing slug`);
        companiesMissingData++;
        continue;
    }

    // Get company details data
    const detailsFilePath = path.join(COMPANY_DETAILS_DIR, `${slug}.json`);
    let companyDetails = {};

    if (fs.existsSync(detailsFilePath)) {
        try {
            companyDetails = JSON.parse(fs.readFileSync(detailsFilePath, 'utf-8'));
        } catch (error) {
            console.warn(`[${slug}] Error reading company details: ${error.message}`);
        }
    }

    // Get jobs data 
    const jobDataFilePath = path.join(JOBS_DATA_DIR, `${slug}.json`);
    let jobData = { jobPostings: [], socialLinks: {} };

    if (fs.existsSync(jobDataFilePath)) {
        try {
            jobData = JSON.parse(fs.readFileSync(jobDataFilePath, 'utf-8'));
        } catch (error) {
            console.warn(`[${slug}] Error reading jobs data: ${error.message}`);
        }
    }

    // Merge all data
    const mergedCompanyData = {
        ...company,
        batch: companyDetails.batch || company.batch,
        website: companyDetails.website || company.website,
        founders: companyDetails.founders || [],
        description: companyDetails.description || company.long_description,
        teamSize: companyDetails.teamSize || company.team_size,
        location: companyDetails.location || company.all_locations,
        status: companyDetails.status || company.status,
        jobCount: companyDetails.jobCount || 0,
        social_links: {
            ...companyDetails.social_links,
            ...jobData.socialLinks
        },
        jobPostings: jobData.jobPostings || []
    };

    combinedCompanies.push(mergedCompanyData);

    // Process jobs
    if (jobData.jobPostings && jobData.jobPostings.length > 0) {
        jobData.jobPostings.forEach(job => {
            const finalJobUrl = job.url?.startsWith('/') ? `${YC_BASE_URL}${job.url}` : job.url;
            const finalCompanyUrl = job.companyUrl?.startsWith('/') ? `${YC_BASE_URL}${job.companyUrl}` : job.companyUrl;

            allJobPostings.push({
                ...job,
                url: finalJobUrl,
                companyUrl: finalCompanyUrl,
                companyName: company.name || 'N/A',
                companySlug: slug,
                companyBatch: companyDetails.batch || company.batch,
                companyWebsite: companyDetails.website || company.website,
                companyLocation: companyDetails.location || company.all_locations
            });
        });
    }

    companiesProcessed++;
    if (companiesProcessed % 50 === 0) {
        console.log(`Processed ${companiesProcessed} companies...`);
    }
}

console.log(`\nProcessed ${companiesProcessed} companies total.`);
console.log(`${companiesMissingData} companies were missing data.`);

// Write output files
try {
    console.log(`\nWriting combined company data to: ${COMBINED_COMPANIES_OUTPUT_FILE}`);
    fs.writeFileSync(COMBINED_COMPANIES_OUTPUT_FILE, JSON.stringify(combinedCompanies, null, 2));
    console.log(`Writing ${allJobPostings.length} job postings to: ${ALL_JOBS_OUTPUT_FILE}`);
    fs.writeFileSync(ALL_JOBS_OUTPUT_FILE, JSON.stringify(allJobPostings, null, 2));
    console.log('Files written successfully.');
} catch (error) {
    console.error(`Error writing output files: ${error.message}`);
}

console.log('\nData combination complete.');