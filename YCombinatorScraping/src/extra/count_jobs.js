const fs = require('fs');

// Path to your formatted JSON data file
const INPUT_FILE_PATH = './yc_companies_formatted.json';

function countTotalJobs() {
    console.log(`Counting jobs in ${INPUT_FILE_PATH}...`);

    try {
        // Read the file synchronously
        const rawData = fs.readFileSync(INPUT_FILE_PATH, 'utf8');

        // Parse the JSON data
        const companiesData = JSON.parse(rawData);

        let totalJobCount = 0;

        // Iterate over each company
        if (Array.isArray(companiesData)) {
            companiesData.forEach((company, index) => {
                // Check if the company object has a 'jobs' array
                if (company && company.jobs && Array.isArray(company.jobs)) {
                    totalJobCount += company.jobs.length;
                } else {
                    // Optional: Log if a company is missing a jobs array or it's not an array
                    // console.log(`Company at index ${index} (slug: ${company?.slug || 'N/A'}) has no jobs array or invalid format.`);
                }
            });
        } else {
            console.error('Error: Input file does not contain a valid JSON array.');
            process.exit(1);
        }

        // Print the final count
        console.log(`--------------------------------`);
        console.log(`Total number of jobs found: ${totalJobCount}`);
        console.log(`--------------------------------`);

    } catch (error) {
        console.error(`Error processing the file: ${error.message}`);
        if (error instanceof SyntaxError) {
            console.error('This might be due to invalid JSON format in the file.');
        }
        process.exit(1);
    }
}

// Run the function
countTotalJobs(); 