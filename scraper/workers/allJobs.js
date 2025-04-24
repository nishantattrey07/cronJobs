const fs = require('fs');
const path = require('path');
const companiesConfig = require('../config/companies'); // Added this import

// Define directories
const outputDir = './output';
const jobsOutputDir = path.join(outputDir, 'combined_jobs');

// Define the folders to process
const folders = ['a16z', 'lightspeed', 'sequoia', 'sequoia_IN'];

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Create combined_jobs directory if it doesn't exist
if (!fs.existsSync(jobsOutputDir)) {
    fs.mkdirSync(jobsOutputDir);
}

// Maps to track jobs
const folderJobsMaps = new Map(); // Store jobs for each folder
const uniqueJobsMap = new Map();   // Store unique jobs across all folders

// Statistics object
const stats = {
    totalJobsProcessed: 0,
    uniqueJobs: 0,
    duplicateJobs: 0,
    jobsPerFolder: {},
    jobsPerCompany: {},
    duplicateDetails: [],
    errors: []
};

// Function to create unique job key
const createJobKey = (job) => {
    return `${job.companyDomain}_${job.title}`.toLowerCase();
};

// Function to get the dataSource value for a folder
function getDataSourceForFolder(folderName) {
    // Find the config entry that corresponds to this folder
    const configEntry = Object.entries(companiesConfig).find(([key, config]) =>
        config.outputDir.includes(`/${folderName}`)
    );

    // Return the dataSource if found, otherwise use folderName as fallback
    return configEntry ? configEntry[1].dataSource : folderName;
}

// Function to process jobs from a company file
const processCompanyJobs = (folderName, filePath) => {
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);
        const jobs = jsonData.jobs || [];

        // Update folder stats
        stats.jobsPerFolder[folderName] = (stats.jobsPerFolder[folderName] || 0) + jobs.length;
        stats.totalJobsProcessed += jobs.length;

        // Add jobs to folder-specific map
        if (!folderJobsMaps.has(folderName)) {
            folderJobsMaps.set(folderName, []);
        }
        folderJobsMaps.get(folderName).push(...jobs);

        // Get the dataSource for this folder
        const dataSource = getDataSourceForFolder(folderName);

        // Process each job for universal file
        jobs.forEach(job => {
            const jobKey = createJobKey(job);

            if (uniqueJobsMap.has(jobKey)) {
                stats.duplicateJobs++;
                stats.duplicateDetails.push({
                    companyDomain: job.companyDomain,
                    title: job.title,
                    foundIn: [folderName, uniqueJobsMap.get(jobKey).sourceFolder]
                });
            } else {
                uniqueJobsMap.set(jobKey, {
                    ...job,
                    sourceFolder: folderName,
                    dataSource: dataSource // Added dataSource here
                });
                stats.jobsPerCompany[job.companyDomain] = (stats.jobsPerCompany[job.companyDomain] || 0) + 1;
            }
        });

    } catch (error) {
        stats.errors.push({
            file: filePath,
            error: error.message
        });
    }
};

// Function to process a folder
const processFolder = (folderName) => {
    const companyJobsDir = path.join(outputDir, folderName, 'company_jobs');

    if (!fs.existsSync(companyJobsDir)) {
        console.log(`Warning: company_jobs directory not found in ${folderName}`);
        stats.errors.push({
            folder: folderName,
            error: 'company_jobs directory not found'
        });
        return;
    }

    const files = fs.readdirSync(companyJobsDir);
    files.forEach(file => {
        if (file.endsWith('_jobs.json')) {
            const filePath = path.join(companyJobsDir, file);
            processCompanyJobs(folderName, filePath);
        }
    });
};

// Function to write folder-specific jobs file
const writeFolderJobsFile = (folderName) => {
    const jobs = folderJobsMaps.get(folderName) || [];
    const outputPath = path.join(jobsOutputDir, `${folderName}_all_jobs.json`);

    // Write only the jobs array
    fs.writeFileSync(outputPath, JSON.stringify({ jobs }, null, 2));
    console.log(`Created ${folderName}_all_jobs.json with ${jobs.length} jobs`);
};

// Function to write universal jobs file
const writeUniversalJobsFile = () => {
    const uniqueJobs = Array.from(uniqueJobsMap.values());
    stats.uniqueJobs = uniqueJobs.length;

    // Write only jobs array to universal file
    const jobsPath = path.join(outputDir, 'all_jobs_combined.json');
    fs.writeFileSync(jobsPath, JSON.stringify({ jobs: uniqueJobs }, null, 2));

    // Write stats to separate file
    const statsData = {
        metadata: {
            totalJobsProcessed: stats.totalJobsProcessed,
            uniqueJobs: stats.uniqueJobs,
            duplicateJobs: stats.duplicateJobs,
            jobsPerFolder: stats.jobsPerFolder,
            jobsPerCompany: stats.jobsPerCompany,
            lastUpdated: new Date().toISOString()
        },
        errors: stats.errors,
        duplicateDetails: stats.duplicateDetails
    };

    const statsPath = path.join(jobsOutputDir, 'jobs_statistics.json');
    fs.writeFileSync(statsPath, JSON.stringify(statsData, null, 2));
};

// Main function
async function main() {
    console.log('Starting to process job files...');

    // Process each folder
    for (const folder of folders) {
        console.log(`\nProcessing ${folder}...`);
        processFolder(folder);
        writeFolderJobsFile(folder);
    }

    // Write universal jobs file and stats
    writeUniversalJobsFile();

    // Display statistics
    console.log('\n=== Job Processing Statistics ===');
    console.log(`Total jobs processed: ${stats.totalJobsProcessed}`);
    console.log(`Unique jobs: ${stats.uniqueJobs}`);
    console.log(`Duplicate jobs found: ${stats.duplicateJobs}`);

    console.log('\nJobs per folder:');
    Object.entries(stats.jobsPerFolder).forEach(([folder, count]) => {
        console.log(`  ${folder}: ${count} jobs`);
    });

    if (stats.errors.length > 0) {
        console.log('\nErrors encountered:');
        stats.errors.forEach(error => {
            console.log(`  ${error.file || error.folder}: ${error.error}`);
        });
    }

    console.log('\nProcessing complete!');
}

module.exports = async function () {
    console.log('Starting to process job files...');
    try {

        await main();
        console.log('\nProcessing complete!');
        return true;
    } catch (error) {
        console.error('Fatal error:', error);
        return false;
    }
}