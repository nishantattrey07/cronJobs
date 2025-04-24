const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_DIR = path.join('output', 'jobs_data');
const OUTPUT_FILE = path.join('output', 'active_companies.json');

async function filterActiveCompanies() {
    try {
        // Create output directory if it doesn't exist
        const outputDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Read all files from the input directory
        const files = fs.readdirSync(INPUT_DIR);
        console.log(`Found ${files.length} company files to process`);

        // Filter and collect active companies
        const activeCompanies = [];
        let processedCount = 0;
        let activeCount = 0;

        files.forEach(file => {
            if (file.endsWith('.json')) {
                const filePath = path.join(INPUT_DIR, file);
                const companyData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                if (companyData.status === 'Active') {
                    activeCompanies.push({
                        ...companyData,
                        company_slug: file.replace('.json', '') // Add company slug from filename
                    });
                    activeCount++;
                }
                processedCount++;
            }
        });

        // Write active companies to output file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(activeCompanies, null, 2));

        console.log(`\nProcessing complete:`);
        console.log(`- Total companies processed: ${processedCount}`);
        console.log(`- Active companies found: ${activeCount}`);
        console.log(`- Output saved to: ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error processing companies:', error);
    }
}

// Run the script
filterActiveCompanies();
