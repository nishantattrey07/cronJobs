const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

// Configuration
const DB1_PATH = './database.db';  // Update these paths as needed
const DB2_PATH = './database1.db';
const OUTPUT_DIR = './comparison_results';

// Connect to databases
function connectToDb(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

// Fetch all jobs from a database
function fetchAllJobs(db) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM jobs', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Create directory if it doesn't exist
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Write JSON file
async function writeJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Main comparison function
async function compareDBs() {
    try {
        // Create output directories
        await ensureDir(OUTPUT_DIR);
        await ensureDir(path.join(OUTPUT_DIR, 'duplicates'));
        await ensureDir(path.join(OUTPUT_DIR, 'different'));
        await ensureDir(path.join(OUTPUT_DIR, 'different', 'db1'));
        await ensureDir(path.join(OUTPUT_DIR, 'different', 'db2'));

        console.log('Connecting to databases...');
        const [db1, db2] = await Promise.all([
            connectToDb(DB1_PATH),
            connectToDb(DB2_PATH)
        ]);

        console.log('Fetching jobs from both databases...');
        const [jobs1, jobs2] = await Promise.all([
            fetchAllJobs(db1),
            fetchAllJobs(db2)
        ]);

        // Create maps for faster lookup
        const jobs1ById = new Map(jobs1.map(job => [job.id, job]));
        const jobs2ById = new Map(jobs2.map(job => [job.id, job]));
        const jobs1ByUrl = new Map(jobs1.map(job => [job.url, job]));
        const jobs2ByUrl = new Map(jobs2.map(job => [job.url, job]));

        // Find duplicates by ID
        const duplicatesById = jobs1
            .filter(job => jobs2ById.has(job.id))
            .map(job => ({
                db1Job: job,
                db2Job: jobs2ById.get(job.id)
            }));

        // Find duplicates by URL (excluding those already found by ID)
        const duplicatesByUrl = jobs1
            .filter(job =>
                job.url &&
                jobs2ByUrl.has(job.url) &&
                !jobs2ById.has(job.id)
            )
            .map(job => ({
                db1Job: job,
                db2Job: jobs2ByUrl.get(job.url)
            }));

        // Find unique jobs in each database
        const uniqueInDb1 = jobs1.filter(job =>
            !jobs2ById.has(job.id) &&
            (!job.url || !jobs2ByUrl.has(job.url))
        );

        const uniqueInDb2 = jobs2.filter(job =>
            !jobs1ById.has(job.id) &&
            (!job.url || !jobs1ByUrl.has(job.url))
        );

        // Group duplicates by company
        const duplicatesByCompany = {
            byId: {},
            byUrl: {}
        };

        duplicatesById.forEach(({ db1Job }) => {
            const company = db1Job.company || 'Unknown';
            duplicatesByCompany.byId[company] = (duplicatesByCompany.byId[company] || 0) + 1;
        });

        duplicatesByUrl.forEach(({ db1Job }) => {
            const company = db1Job.company || 'Unknown';
            duplicatesByCompany.byUrl[company] = (duplicatesByCompany.byUrl[company] || 0) + 1;
        });

        // Prepare metadata
        const metadata = {
            timestamp: new Date().toISOString(),
            db1Path: DB1_PATH,
            db2Path: DB2_PATH,
            totalStats: {
                db1TotalJobs: jobs1.length,
                db2TotalJobs: jobs2.length,
                duplicatesById: duplicatesById.length,
                duplicatesByUrl: duplicatesByUrl.length,
                uniqueInDb1: uniqueInDb1.length,
                uniqueInDb2: uniqueInDb2.length
            },
            duplicatesByCompany
        };

        // Write all files
        console.log('Writing output files...');

        // Duplicates
        await writeJsonFile(
            path.join(OUTPUT_DIR, 'duplicates', 'metadata.json'),
            metadata
        );
        await writeJsonFile(
            path.join(OUTPUT_DIR, 'duplicates', 'duplicates_by_id.json'),
            duplicatesById
        );
        await writeJsonFile(
            path.join(OUTPUT_DIR, 'duplicates', 'duplicates_by_url.json'),
            duplicatesByUrl
        );

        // Different jobs
        await writeJsonFile(
            path.join(OUTPUT_DIR, 'different', 'db1', 'unique_jobs.json'),
            uniqueInDb1
        );
        await writeJsonFile(
            path.join(OUTPUT_DIR, 'different', 'db2', 'unique_jobs.json'),
            uniqueInDb2
        );

        // Group unique jobs by company
        const uniqueByCompany1 = {};
        const uniqueByCompany2 = {};

        uniqueInDb1.forEach(job => {
            const company = job.company || 'Unknown';
            uniqueByCompany1[company] = (uniqueByCompany1[company] || 0) + 1;
        });

        uniqueInDb2.forEach(job => {
            const company = job.company || 'Unknown';
            uniqueByCompany2[company] = (uniqueByCompany2[company] || 0) + 1;
        });

        await writeJsonFile(
            path.join(OUTPUT_DIR, 'different', 'db1', 'jobs_by_company.json'),
            uniqueByCompany1
        );
        await writeJsonFile(
            path.join(OUTPUT_DIR, 'different', 'db2', 'jobs_by_company.json'),
            uniqueByCompany2
        );

        console.log('Comparison complete! Results written to:', OUTPUT_DIR);
        console.log('\nSummary:');
        console.log(`- DB1 total jobs: ${jobs1.length}`);
        console.log(`- DB2 total jobs: ${jobs2.length}`);
        console.log(`- Duplicates by ID: ${duplicatesById.length}`);
        console.log(`- Additional duplicates by URL: ${duplicatesByUrl.length}`);
        console.log(`- Unique in DB1: ${uniqueInDb1.length}`);
        console.log(`- Unique in DB2: ${uniqueInDb2.length}`);

        // Close database connections
        await Promise.all([
            new Promise(resolve => db1.close(resolve)),
            new Promise(resolve => db2.close(resolve))
        ]);

    } catch (error) {
        console.error('Error during comparison:', error);
        process.exit(1);
    }
}

// Run the comparison
compareDBs();