const fs = require('fs');
const path = require('path');

function readCompaniesFromDirectory(dirPath) {
    const companies = [];
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        if (file.endsWith('.json')) {
            try {
                const filePath = path.join(dirPath, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                companies.push(data);
            } catch (err) {
                console.error(`Error reading file ${file}:`, err.message);
            }
        }
    });

    return companies;
}

function findEmptyFounders(inputPath) {
    let companiesData = [];

    try {
        // Check if input is a directory or file
        const stats = fs.statSync(inputPath);

        if (stats.isDirectory()) {
            companiesData = readCompaniesFromDirectory(inputPath);
            console.log(`Read ${companiesData.length} companies from directory`);
        } else {
            companiesData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
            console.log(`Read ${Array.isArray(companiesData) ? companiesData.length : 1} companies from file`);
        }

        // Handle case where input is single company JSON
        if (!Array.isArray(companiesData)) {
            companiesData = [companiesData];
        }

        // Filter companies with empty/missing founders
        const emptyFoundersCompanies = companiesData.filter(company => {
            return !company.founders ||
                !Array.isArray(company.founders) ||
                company.founders.length === 0;
        }).map(company => ({
            name: company.name,
            slug: company.slug,
            batch: company.batch,
            status: company.status
        }));

        // Generate output filename
        const outputFile = 'empty_founders_companies.json';

        // Save results
        fs.writeFileSync(
            outputFile,
            JSON.stringify(emptyFoundersCompanies, null, 2),
            'utf8'
        );

        console.log('\nResults:');
        console.log(`Total companies processed: ${companiesData.length}`);
        console.log(`Companies with empty founders: ${emptyFoundersCompanies.length}`);
        console.log(`Data saved to ${outputFile}`);

    } catch (err) {
        console.error('Error processing companies:', err.message);
    }
}

// Get input path from command line or use default
const inputPath = process.argv[2] || 'output/company_details';

if (!fs.existsSync(inputPath)) {
    console.error('Input path does not exist:', inputPath);
    process.exit(1);
}

findEmptyFounders(inputPath);
