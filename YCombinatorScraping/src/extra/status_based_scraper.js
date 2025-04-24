const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Configuration
const INPUT_DIR = path.join('output', 'jobs_data');
const OUTPUT_BASE = path.join('output', 'status_sorted');
const ERROR_LOG = path.join(OUTPUT_BASE, 'error_companies.json');
const SKIPPED_LOG = path.join(OUTPUT_BASE, 'skipped_companies.json');

// Create output directories
const statusDirs = ['active', 'acquired', 'inactive', 'unknown'];
statusDirs.forEach(dir => {
    const dirPath = path.join(OUTPUT_BASE, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

function processCompanies() {
    const errorCompanies = [];
    const skippedCompanies = [];
    const statusCounts = {
        active: 0,
        acquired: 0,
        inactive: 0,
        unknown: 0,
    };

    // Read all files from input directory
    const files = fs.readdirSync(INPUT_DIR);
    console.log(`Found ${files.length} companies to process`);

    files.forEach(file => {
        if (!file.endsWith('.json')) return;

        const filePath = path.join(INPUT_DIR, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const status = (data.status || 'Unknown').toLowerCase().trim();
            const companySlug = file.replace('.json', '');

            // Fixed status determination logic
            let outputDir;
            if (status === 'active') {
                outputDir = 'active';
                statusCounts.active++;
            } else if (status === 'acquired') {
                outputDir = 'acquired';
                statusCounts.acquired++;
            } else if (status === 'inactive') {
                outputDir = 'inactive';
                statusCounts.inactive++;
            } else {
                outputDir = 'unknown';
                statusCounts.unknown++;
                skippedCompanies.push({
                    slug: companySlug,
                    reason: `Unknown status: ${status}`,
                    data: data
                });
            }

            // Copy file to appropriate status directory
            const outputPath = path.join(OUTPUT_BASE, outputDir, file);
            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

        } catch (error) {
            console.error(`Error processing ${file}:`, error.message);
            errorCompanies.push({
                slug: file.replace('.json', ''),
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Save error and skipped logs
    fs.writeFileSync(ERROR_LOG, JSON.stringify(errorCompanies, null, 2));
    fs.writeFileSync(SKIPPED_LOG, JSON.stringify(skippedCompanies, null, 2));

    // Print summary
    console.log('\nProcessing complete!');
    console.log('Status counts:');
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`${status}: ${count} companies`);
    });
    console.log(`\nErrors: ${errorCompanies.length}`);
    console.log(`Skipped: ${skippedCompanies.length}`);
}

// Run the processor
processCompanies();
