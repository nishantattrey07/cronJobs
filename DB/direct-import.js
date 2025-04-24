const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path'); // Add this line to import the path module



// Initialize Prisma client with minimal logging
const prisma = new PrismaClient({
    log: ['error'],
});

// Path to your SQLite database file
const SQLITE_DB_PATH = path.resolve(__dirname, '../fanngJobDbUpload/database.db');
let db = null;


// Data source identifier
const DATA_SOURCE = 'SQLITE_IMPORT';

// List of FAANG companies with their simplified names
const FAANG_COMPANIES = [
    'Amazon',
    'Apple',
    'Google',
    'Meta',
    'Microsoft',
    'Netflix'
];

// Create a map of lowercase company names to proper names for case-insensitive matching
const COMPANY_NAME_MAP = new Map();
FAANG_COMPANIES.forEach(name => {
    COMPANY_NAME_MAP.set(name.toLowerCase(), name);
});

// URL patterns for company matching
const COMPANY_URL_PATTERNS = {
    'amazon.jobs': 'Amazon',
    'jobs.careers.microsoft.com': 'Microsoft',
    'careers.microsoft.com': 'Microsoft',
    'jobs.netflix.com': 'Netflix',
    'google.com': 'Google',
    'careers.google.com': 'Google',
    'apple.com/jobs': 'Apple',
    'careers.apple.com': 'Apple',
    'meta.com/careers': 'Meta',
    'metacareers.com': 'Meta',
    'facebook.com/careers': 'Meta',  // Added Facebook URL for Meta
    'instagram.com/careers': 'Meta'   // Added Instagram URL for Meta
};

// Function to detect company from URL
function detectCompanyFromUrl(url) {
    if (!url) return null;

    // Normalize the URL to lowercase for matching only
    const normalizedUrl = url.toLowerCase();

    // Check each pattern
    for (const [pattern, company] of Object.entries(COMPANY_URL_PATTERNS)) {
        if (normalizedUrl.includes(pattern.toLowerCase())) {
            return company;
        }
    }

    return null;
}

async function fastImportFangJobs() {
    console.log('Starting fast FangJobs import process (using createMany)...');
    const startTime = Date.now();
    const skippedRecords = []; // Array to store skipped records

    try {
        // Connect to SQLite database once
        if (!db) {
            db = await new Promise((resolve, reject) => {
                const dbConn = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
                    if (err) {
                        console.error('Error opening SQLite database:', err.message);
                        reject(err);
                    } else {
                        console.log('Connected to SQLite database');
                        resolve(dbConn);
                    }
                });
            });
        }

        // Get total count for progress tracking
        const totalCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM jobs', (err, row) => {
                if (err) reject(err);
                resolve(row ? row.count : 0);
            });
        });

        if (totalCount === 0) {
            console.log('No jobs found in SQLite database.');
            return;
        }

        console.log(`Found ${totalCount} jobs to import from SQLite database`);

        // Step 1: Create Company records for FAANG companies if they don't exist
        console.log('Ensuring company records exist...');
        const companyMap = new Map(); // Map company name to company ID

        for (const companyName of FAANG_COMPANIES) {
            let company = await prisma.company.findFirst({
                where: { name: companyName }
            });

            if (!company) {
                console.log(`Creating company record for ${companyName}`);
                company = await prisma.company.create({
                    data: {
                        id: uuidv4(),
                        name: companyName,
                        slug: companyName.toLowerCase(),
                        description: `${companyName} job listings`,
                        emailDomains: [],
                        parentSlugs: [],
                        parents: []
                    }
                });
            }
            companyMap.set(companyName.toLowerCase(), company.id);
        }

        // Step 2: Fetch all jobs from SQLite and prepare data
        console.log('Fetching and preparing all job data from SQLite...');

        const allJobData = [];
        const allLocationData = new Map(); // Map location string to location object
        const allJobOfficeRelations = [];
        const allCompanyOfficeRelations = new Map();

        const BATCH_SIZE = 5000;
        let processedCount = 0;
        let skipped = 0;

        for (let offset = 0; offset < totalCount; offset += BATCH_SIZE) {
            console.log(`Fetching SQLite jobs ${offset} to ${Math.min(offset + BATCH_SIZE, totalCount)}...`);
            const jobs = await fetchJobsFromSQLite(db, offset, BATCH_SIZE);

            for (const job of jobs) {
                let normalizedCompany = job.company ? job.company.toLowerCase() : null;
                let companyName = null;
                let matchSource = null;

                // First try direct company name match
                if (normalizedCompany && companyMap.has(normalizedCompany)) {
                    companyName = COMPANY_NAME_MAP.get(normalizedCompany);
                    matchSource = 'company_name';
                }
                // If no direct match, try URL matching
                else if (job.url) {
                    const urlCompany = detectCompanyFromUrl(job.url);
                    if (urlCompany && companyMap.has(urlCompany.toLowerCase())) {
                        companyName = urlCompany;
                        normalizedCompany = urlCompany.toLowerCase();
                        matchSource = 'url_pattern';
                    }
                }

                // If still no match, skip the record
                if (!companyName) {
                    skippedRecords.push({
                        reason: !job.company ? 'No company name' : 'Company not in FAANG list and URL not matching',
                        companyName: job.company,
                        normalizedCompany: normalizedCompany,
                        jobTitle: job.title,
                        location: job.location,
                        date: job.date,
                        url: job.url,
                        urlChecked: job.url ? true : false
                    });
                    skipped++;
                    continue;
                }

                const companyId = companyMap.get(normalizedCompany);
                const jobId = uuidv4();

                const skillsJson = job.desc ? { description: job.desc } : null;

                allJobData.push({
                    id: jobId,
                    title: job.title,
                    url: job.url || null,
                    companyId: companyId,
                    timeStamp: job.date || new Date(),
                    skills: skillsJson,
                    dataSource: DATA_SOURCE,
                    dataCompleteness: 'COMPLETE'  // Added default completeness status
                });

                // Handle location
                if (job.location && job.location.trim()) {
                    const normalizedLocation = job.location.trim();
                    if (!allLocationData.has(normalizedLocation)) {
                        allLocationData.set(normalizedLocation, {
                            location: normalizedLocation
                        });
                    }
                    const officeData = allLocationData.get(normalizedLocation);

                    allJobOfficeRelations.push({
                        jobId: jobId,
                        location: normalizedLocation
                    });

                    const companyOfficeKey = `${companyId}:${normalizedLocation}`;
                    if (!allCompanyOfficeRelations.has(companyOfficeKey)) {
                        allCompanyOfficeRelations.set(companyOfficeKey, {
                            companyId: companyId,
                            location: normalizedLocation
                        });
                    }
                }
            }
            processedCount += jobs.length;
            console.log(`Prepared ${processedCount}/${totalCount} jobs`);
        }

        // Write skipped records to JSON file with details about URL matching
        const skippedRecordsFile = 'skipped_records.json';
        await fs.writeFile(
            skippedRecordsFile,
            JSON.stringify({
                totalSkipped: skipped,
                records: skippedRecords,
                skipReasonCounts: skippedRecords.reduce((acc, record) => {
                    acc[record.reason] = (acc[record.reason] || 0) + 1;
                    return acc;
                }, {}),
                companyFrequency: skippedRecords.reduce((acc, record) => {
                    if (record.companyName) {
                        acc[record.companyName] = (acc[record.companyName] || 0) + 1;
                    }
                    return acc;
                }, {}),
                urlStats: {
                    totalUrlsChecked: skippedRecords.filter(r => r.urlChecked).length,
                    totalWithoutUrls: skippedRecords.filter(r => !r.url).length
                }
            }, null, 2)
        );
        console.log(`Finished preparing data. Total jobs to insert: ${allJobData.length}, Skipped: ${skipped}`);
        console.log(`Skipped records details written to ${skippedRecordsFile}`);

        // Step 3: Create Offices and maintain ID mapping
        console.log(`\nInserting ${allLocationData.size} Offices...`);
        const officeMap = new Map(); // Map location string to actual DB ID
        const officeDataToInsert = Array.from(allLocationData.values());

        for (const officeData of officeDataToInsert) {
            try {
                const office = await prisma.office.upsert({
                    where: { location: officeData.location },
                    update: {},
                    create: {
                        location: officeData.location
                    }
                });
                officeMap.set(officeData.location, office.id);
                console.log(`Created/Updated office: ${office.location}`);
            } catch (e) {
                console.error(`Error upserting office ${officeData.location}:`, e);
            }
        }

        // Step 4: Bulk insert Jobs
        console.log(`\nInserting ${allJobData.length} Jobs...`);
        if (allJobData.length > 0) {
            const JOB_CHUNK_SIZE = 1000;
            let jobsInserted = 0;
            for (let i = 0; i < allJobData.length; i += JOB_CHUNK_SIZE) {
                const chunk = allJobData.slice(i, i + JOB_CHUNK_SIZE);
                console.log(`Inserting job chunk ${Math.floor(i / JOB_CHUNK_SIZE) + 1}...`);
                try {
                    const jobResult = await prisma.job.createMany({
                        data: chunk,
                        skipDuplicates: true,
                    });
                    jobsInserted += jobResult.count;
                } catch (e) {
                    console.error(`Error inserting job chunk starting at index ${i}:`, e);
                }
            }
            console.log(`Inserted ${jobsInserted} Jobs.`);
        }

        // Step 5: Insert CompanyOffice relations with correct office IDs
        console.log(`\nInserting CompanyOffice relations...`);
        for (const [_, relation] of allCompanyOfficeRelations) {
            const officeId = officeMap.get(relation.location);
            if (!officeId) continue;

            try {
                await prisma.companyOffice.upsert({
                    where: {
                        companyId_officeId: {
                            companyId: relation.companyId,
                            officeId: officeId
                        }
                    },
                    update: {},
                    create: {
                        companyId: relation.companyId,
                        officeId: officeId
                    }
                });
            } catch (e) {
                if (!e.message.includes('Unique constraint')) {
                    console.error("Error creating CompanyOffice relation:", e);
                }
            }
        }

        // Step 6: Insert JobOffice relations with correct office IDs
        console.log(`\nInserting JobOffice relations...`);
        const updatedJobOfficeRelations = allJobOfficeRelations
            .map(relation => {
                const officeId = officeMap.get(relation.location);
                if (!officeId) return null;
                return {
                    jobId: relation.jobId,
                    officeId: officeId
                };
            })
            .filter(relation => relation !== null);

        const RELATION_CHUNK_SIZE = 1000;
        let relationsInserted = 0;

        for (let i = 0; i < updatedJobOfficeRelations.length; i += RELATION_CHUNK_SIZE) {
            const chunk = updatedJobOfficeRelations.slice(i, i + RELATION_CHUNK_SIZE);
            try {
                const result = await prisma.jobOffice.createMany({
                    data: chunk,
                    skipDuplicates: true,
                });
                relationsInserted += result.count;
                console.log(`Inserted ${result.count} JobOffice relations from chunk ${Math.floor(i / RELATION_CHUNK_SIZE) + 1}`);
            } catch (e) {
                console.error(`Error inserting JobOffice relations chunk ${Math.floor(i / RELATION_CHUNK_SIZE) + 1}:`, e);
            }
        }

        // Final Summary
        const totalTime = (Date.now() - startTime) / 1000;
        console.log('\nImport summary:');
        console.log(`- Total SQLite records processed: ${processedCount}`);
        console.log(`- Jobs prepared for insert: ${allJobData.length}`);
        console.log(`- Skipped SQLite records: ${skipped}`);
        console.log(`- Total time: ${formatTime(totalTime)}`);
        console.log(`- Average speed: ${Math.round(processedCount / totalTime)} records/second`);
        console.log('Import process completed!');

    } catch (error) {
        console.error('Error during import:', error);
    } finally {
        if (db) {
            db.close((err) => {
                if (err) console.error('Error closing SQLite database:', err.message);
                else console.log('Closed SQLite database connection');
            });
        }
        await prisma.$disconnect();
    }
}

function formatTime(seconds) {
    seconds = Math.round(seconds);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}

function fetchJobsFromSQLite(db, offset, limit) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT rowid as rowId, * FROM jobs LIMIT ${limit} OFFSET ${offset}`, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            const jobs = rows.map(row => ({
                title: row.title || 'Untitled Job',
                desc: row.desc || null,
                date: row.date ? new Date(row.date) : null,
                location: row.location ? row.location.trim() : null,
                url: row.url || null,
                company: row.company || null
            })).filter(job => job.title && (!job.location || job.location.trim()));

            resolve(jobs);
        });
    });
}

// Run the import
fastImportFangJobs()
    .then(() => console.log('Fast import script execution completed'))
    .catch(error => console.error('Import script failed:', error));