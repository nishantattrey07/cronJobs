const fs = require('fs');

// Configuration
const INPUT_FILE_PATH = './output/yc_jobs_formatted.json';
const OUTPUT_FILE_PATH = './yc_jobs_30.json';
const COMPANIES_TO_EXTRACT = 30;

function extractCompanies() {
    console.log(`Reading companies from ${INPUT_FILE_PATH}...`);

    try {
        // Read and parse the input file
        const rawData = fs.readFileSync(INPUT_FILE_PATH, 'utf8');
        const companiesData = JSON.parse(rawData);

        if (!Array.isArray(companiesData)) {
            throw new Error('Input file does not contain a valid JSON array');
        }

        // Get total number of companies
        const totalCompanies = companiesData.length;
        console.log(`Total companies in source file: ${totalCompanies}`);

        // Ensure we don't try to extract more companies than available
        const numCompaniesToExtract = Math.min(COMPANIES_TO_EXTRACT, totalCompanies);

        // Randomly select companies
        const selectedCompanies = [];
        const usedIndices = new Set();

        while (selectedCompanies.length < numCompaniesToExtract) {
            const randomIndex = Math.floor(Math.random() * totalCompanies);
            
            // Skip if we've already used this index
            if (usedIndices.has(randomIndex)) continue;
            
            usedIndices.add(randomIndex);
            selectedCompanies.push(companiesData[randomIndex]);
        }

        // Calculate some statistics about the extracted data
        let totalJobs = 0;
        let companiesWithJobs = 0;
        let remoteCompanies = 0;

        selectedCompanies.forEach(company => {
            if (company.jobs && Array.isArray(company.jobs)) {
                totalJobs += company.jobs.length;
                if (company.jobs.length > 0) companiesWithJobs++;
            }
            if (company.isRemoteFriendly) remoteCompanies++;
        });

        // Write the selected companies to the output file
        fs.writeFileSync(
            OUTPUT_FILE_PATH,
            JSON.stringify(selectedCompanies, null, 2),
            'utf8'
        );

        // Print statistics
        console.log('\nExtraction completed successfully!');
        console.log('----------------------------------------');
        console.log(`Companies extracted: ${selectedCompanies.length}`);
        console.log(`Total jobs in extracted companies: ${totalJobs}`);
        console.log(`Companies with jobs: ${companiesWithJobs}`);
        console.log(`Remote-friendly companies: ${remoteCompanies}`);
        console.log(`Output saved to: ${OUTPUT_FILE_PATH}`);
        console.log('----------------------------------------');

    } catch (error) {
        console.error(`Error during extraction: ${error.message}`);
        if (error instanceof SyntaxError) {
            console.error('This might be due to invalid JSON format in the input file.');
        }
        process.exit(1);
    }
}

// Run the extraction
extractCompanies(); 