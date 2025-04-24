const fs = require('fs');
const companies = require('../config/companies');

function calculateStats(jsonData) {
    const totalJobs = jsonData.reduce((sum, company) => sum + company.numJobs, 0);
    const totalCompanies = jsonData.length;
    const companiesWithJobsCount = jsonData.filter(company => company.numJobs > 0).length;

    return {
        totalJobs,
        totalCompanies,
        companiesWithJobsCount,
        companiesWithoutJobsCount: totalCompanies - companiesWithJobsCount,
        averageJobsPerCompany: (totalJobs / totalCompanies).toFixed(2)
    };
}

function getTopCompanies(jsonData, limit = 10) {
    return [...jsonData]
        .sort((a, b) => b.numJobs - a.numJobs)
        .slice(0, limit);
}

function generateStatsText(stats, topCompanies, companyName) {
    let statsText = `Job Statistics for ${companyName}\n`;
    statsText += '================\n\n';

    statsText += `Total number of companies: ${stats.totalCompanies}\n`;
    statsText += `Companies with at least one job posting: ${stats.companiesWithJobsCount}\n`;
    statsText += `Companies with no job postings: ${stats.companiesWithoutJobsCount}\n`;
    statsText += `Total number of job positions across all companies: ${stats.totalJobs}\n`;
    statsText += `Average jobs per company: ${stats.averageJobsPerCompany}\n\n`;

    statsText += 'Top 10 Companies by Number of Jobs\n';
    statsText += '================================\n';

    topCompanies.forEach((company, index) => {
        statsText += `${index + 1}. ${company.id}: ${company.numJobs} jobs\n`;
    });

    return statsText;
}

async function filterCompaniesForSource(companyKey, companyConfig) {
    try {
        console.log(`Processing companies for ${companyConfig.name}...`);

        // Read the JSON file
        const jsonData = JSON.parse(fs.readFileSync(`${companyConfig.outputDir}/all_companies.json`, 'utf8'));

        // Extract just the IDs
        const companyIds = jsonData.companies.map(company => company.slug);

        // Extract IDs and numJobs
        const companyJobs = jsonData.companies.map(company => ({
            id: company.id,
            numJobs: company.numJobs,
            slug: company.slug
        }));

        // Calculate statistics
        const stats = calculateStats(jsonData.companies);
        const topCompanies = getTopCompanies(jsonData.companies);

        // Generate and save stats text
        const statsText = generateStatsText(stats, topCompanies, companyConfig.name);
        fs.writeFileSync(`${companyConfig.outputDir}/companyStats.txt`, statsText);

        // Separate companies with and without jobs
        const companiesWithJobs = companyJobs.filter(company => company.numJobs > 0);
        const companiesWithoutJobs = companyJobs.filter(company => company.numJobs === 0);

        // Write all output files
        fs.writeFileSync(`${companyConfig.outputDir}/companiesIds.json`, JSON.stringify(companyIds, null, 2));
        fs.writeFileSync(`${companyConfig.outputDir}/companiesFilteredDetails.json`, JSON.stringify(companyJobs, null, 2));
        fs.writeFileSync(`${companyConfig.outputDir}/companiesWithJobs.json`, JSON.stringify(companiesWithJobs, null, 2));
        fs.writeFileSync(`${companyConfig.outputDir}/companiesWithoutJobs.json`, JSON.stringify(companiesWithoutJobs, null, 2));

        console.log(`Successfully processed companies for ${companyConfig.name}`);
        return true;
    } catch (error) {
        console.error(`Error processing companies for ${companyConfig.name}:`, error);
        return false;
    }
}

async function filterAllCompaniesDetails() {
    try {
        console.log('Starting to process companies from all sources...\n');

        // Process companies from all sources in parallel
        const results = await Promise.all(
            Object.entries(companies).map(([key, config]) =>
                filterCompaniesForSource(key, config)
            )
        );

        // Calculate success rate
        const successCount = results.filter(result => result).length;
        const totalCount = results.length;

        console.log('\nProcessing Summary:');
        console.log('------------------');
        console.log(`Total sources processed: ${totalCount}`);
        console.log(`Successful processing: ${successCount}`);
        console.log(`Failed processing: ${totalCount - successCount}`);

        return results.every(result => result);
    } catch (error) {
        console.error('Error in filterAllCompaniesDetails:', error);
        return false;
    }
}

module.exports = filterAllCompaniesDetails; 