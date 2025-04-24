const fs = require('fs');
const path = require('path');

// Define directories
const outputDir = './output';
const splitOutputDir = path.join(outputDir, 'split_data');

// Create split_data directory if it doesn't exist
if (!fs.existsSync(splitOutputDir)) {
    fs.mkdirSync(splitOutputDir);
}

// Statistics object
const stats = {
    companies: {
        total: 0,
        fileA: 0,
        fileB: 0
    },
    jobs: {
        total: 0,
        fileA: 0,
        fileB: 0,
        withoutCompany: 0,
        companiesWithNoJobs: 0
    },
    companyDistribution: {},
    jobsPerCompany: {},
    processingTime: 0
};

// Function to load and parse a JSON file
function loadJsonFile(filePath) {
    console.log(`Loading file: ${filePath}`);
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`Error loading file ${filePath}:`, error.message);
        process.exit(1);
    }
}

// Main function
async function splitData() {
    console.log('Starting to split data...');
    const startTime = Date.now();

    // Step 1: Load companies and jobs data
    console.log('Loading companies and jobs data...');
    const companiesData = loadJsonFile(path.join(outputDir, 'all_companies_combined.json'));
    const jobsData = loadJsonFile(path.join(outputDir, 'all_jobs_combined.json'));

    // Extract companies and jobs arrays
    const companies = companiesData.companies || [];
    const jobs = jobsData.jobs || [];

    stats.companies.total = companies.length;
    stats.jobs.total = jobs.length;

    console.log(`Loaded ${stats.companies.total} companies and ${stats.jobs.total} jobs`);

    // Step 2: Create a map of company domains to track which file they go into
    const companyDomainMap = new Map();

    // Step 3: Split companies into two equal parts
    const halfPoint = Math.ceil(companies.length / 2);
    const companiesA = companies.slice(0, halfPoint);
    const companiesB = companies.slice(halfPoint);

    stats.companies.fileA = companiesA.length;
    stats.companies.fileB = companiesB.length;

    // Step 4: Create domain maps for quick lookup
    console.log('Creating company domain maps...');
    companiesA.forEach(company => {
        const domain = company.domain || company.companyDomain;
        companyDomainMap.set(domain, 'A');
        stats.companyDistribution[domain] = 'A';
    });

    companiesB.forEach(company => {
        const domain = company.domain || company.companyDomain;
        companyDomainMap.set(domain, 'B');
        stats.companyDistribution[domain] = 'B';
    });

    // Step 5: Split jobs based on company domain
    console.log('Splitting jobs based on company domains...');
    const jobsA = [];
    const jobsB = [];
    const jobsWithoutCompany = [];

    jobs.forEach(job => {
        const domain = job.companyDomain;

        // Count jobs per company
        stats.jobsPerCompany[domain] = (stats.jobsPerCompany[domain] || 0) + 1;

        if (companyDomainMap.get(domain) === 'A') {
            jobsA.push(job);
        } else if (companyDomainMap.get(domain) === 'B') {
            jobsB.push(job);
        } else {
            jobsWithoutCompany.push(job);
        }
    });

    stats.jobs.fileA = jobsA.length;
    stats.jobs.fileB = jobsB.length;
    stats.jobs.withoutCompany = jobsWithoutCompany.length;

    // Step 6: Write the split files
    console.log('Writing split files...');

    // Write companies files
    fs.writeFileSync(
        path.join(splitOutputDir, 'companies_A.json'),
        JSON.stringify({ companies: companiesA }, null, 2)
    );

    fs.writeFileSync(
        path.join(splitOutputDir, 'companies_B.json'),
        JSON.stringify({ companies: companiesB }, null, 2)
    );

    // Write jobs files
    fs.writeFileSync(
        path.join(splitOutputDir, 'jobs_A.json'),
        JSON.stringify({ jobs: jobsA }, null, 2)
    );

    fs.writeFileSync(
        path.join(splitOutputDir, 'jobs_B.json'),
        JSON.stringify({ jobs: jobsB }, null, 2)
    );

    // Write jobs without matching companies to a separate file
    fs.writeFileSync(
        path.join(splitOutputDir, 'jobs_without_company.json'),
        JSON.stringify({
            jobs: jobsWithoutCompany,
            count: jobsWithoutCompany.length,
            companyDomains: [...new Set(jobsWithoutCompany.map(job => job.companyDomain))]
        }, null, 2)
    );

    // Calculate companies with no jobs
    const companiesWithJobs = new Set(jobs.map(job => job.companyDomain));
    const companiesWithNoJobs = companies.filter(company =>
        !companiesWithJobs.has(company.domain || company.companyDomain)
    );
    stats.jobs.companiesWithNoJobs = companiesWithNoJobs.length;

    // Calculate processing time
    stats.processingTime = (Date.now() - startTime) / 1000;

    // Step 7: Write statistics
    console.log('Writing statistics...');
    const statsData = {
        summary: {
            totalCompanies: stats.companies.total,
            totalJobs: stats.jobs.total,
            companiesFileA: stats.companies.fileA,
            companiesFileB: stats.companies.fileB,
            jobsFileA: stats.jobs.fileA,
            jobsFileB: stats.jobs.fileB,
            jobsWithoutMatchingCompany: stats.jobs.withoutCompany,
            companiesWithNoJobs: stats.jobs.companiesWithNoJobs,
            processingTimeSeconds: stats.processingTime
        },
        companiesWithNoJobs: companiesWithNoJobs.map(company => ({
            name: company.name,
            domain: company.domain || company.companyDomain
        })),
        jobsPerCompanyStats: {
            totalCompaniesWithJobs: Object.keys(stats.jobsPerCompany).length,
            maxJobsInOneCompany: Math.max(...Object.values(stats.jobsPerCompany)),
            minJobsInOneCompany: Math.min(...Object.values(stats.jobsPerCompany)),
            averageJobsPerCompany: (stats.jobs.total / Object.keys(stats.jobsPerCompany).length).toFixed(2)
        },
        topCompaniesWithMostJobs: Object.entries(stats.jobsPerCompany)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([domain, count]) => ({ domain, jobCount: count })),
        jobsWithoutCompanyDomains: [...new Set(jobsWithoutCompany.map(job => job.companyDomain))]
    };

    fs.writeFileSync(
        path.join(splitOutputDir, 'split_stats.json'),
        JSON.stringify(statsData, null, 2)
    );

    // Step 8: Display summary
    console.log('\n=== Data Split Summary ===');
    console.log(`Total companies: ${stats.companies.total}`);
    console.log(`Companies in file A: ${stats.companies.fileA}`);
    console.log(`Companies in file B: ${stats.companies.fileB}`);
    console.log(`Total jobs: ${stats.jobs.total}`);
    console.log(`Jobs in file A: ${stats.jobs.fileA}`);
    console.log(`Jobs in file B: ${stats.jobs.fileB}`);
    console.log(`Jobs without matching company: ${stats.jobs.withoutCompany}`);
    console.log(`Companies with no jobs: ${stats.jobs.companiesWithNoJobs}`);
    console.log(`Processing time: ${stats.processingTime.toFixed(2)} seconds`);
    console.log('\nFiles created in:', splitOutputDir);
    console.log('1. companies_A.json');
    console.log('2. companies_B.json');
    console.log('3. jobs_A.json');
    console.log('4. jobs_B.json');
    console.log('5. jobs_without_company.json');
    console.log('6. split_stats.json');
}

// Run the script
// splitData().catch(error => {
//     console.error('Fatal error:', error);
//     process.exit(1);
// });

module.exports = async function runDistribution() {
    console.log('Starting to split data...');
    try {
    
        await splitData();
        console.log('Distribution Completed');
        return true;
    } catch (error) {
        console.error('Fatal error:', error);
        return false;
    }
}