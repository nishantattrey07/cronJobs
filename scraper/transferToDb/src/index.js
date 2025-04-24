const { PrismaClient } = require('@prisma/client');
const { createStagingTables, dropStagingTables } = require('./staging-tables');
const { loadCompaniesIntoStaging, loadJobsIntoStaging } = require('./load-staging');
const { transformStagingToFinal } = require('./transform-data');
const { logInfo, logError, logSuccess, DROP_STAGING_TABLES } = require('./utils');

/**
 * The main import function specifically tailored for the user's Prisma schema
 * and their specific 5_companies.json and 5_jobs.json data formats
 * 
 * @param {Object} options - Import options
 * @param {string} [options.companiesFile] - Path to 5_companies.json file
 * @param {string} [options.jobsFile] - Path to 5_jobs.json file
 * @param {string} [options.mode='insert'] - Import mode: 'insert' or 'upsert'
 * @param {boolean} [options.dropStagingTables=true] - Whether to drop staging tables after import
 * @param {Object} [options.prismaClient] - Optional existing Prisma client instance
 * @returns {Promise<Object>} - Import statistics
 */
async function importData(options = {}) {
    const {
        companiesFile,
        jobsFile,
        mode = 'insert',
        dropStaging = DROP_STAGING_TABLES,
        prismaClient
    } = options;

    if (!companiesFile && !jobsFile) {
        throw new Error('At least one of companiesFile or jobsFile must be provided');
    }

    const stats = {
        startTime: Date.now(),
        companiesProcessed: 0,
        jobsProcessed: 0,
        errors: []
    };

    // Use provided prisma client or create a new one
    const prisma = prismaClient || new PrismaClient();
    const shouldDisconnect = !prismaClient; // Only disconnect if we created it

    try {
        logInfo(`Starting ${mode} operation using staging tables approach...`);

        // Step 1: Create staging tables
        await createStagingTables(prisma);

        // Step 2: Load data into staging tables
        if (companiesFile) {
            stats.companiesProcessed = await loadCompaniesIntoStaging(prisma, companiesFile);
        }

        if (jobsFile) {
            stats.jobsProcessed = await loadJobsIntoStaging(prisma, jobsFile);
        }

        // Step 3: Transform staging data to final tables
        await transformStagingToFinal(prisma, { mode });

        // Step 4: Clean up (optional)
        if (dropStaging) {
            await dropStagingTables(prisma);
        }

        // Calculate duration and log stats
        stats.endTime = Date.now();
        stats.duration = (stats.endTime - stats.startTime) / 1000;

        logSuccess(`Import completed in ${stats.duration.toFixed(2)} seconds`);
        logSuccess(`Processed ${stats.companiesProcessed} companies and ${stats.jobsProcessed} jobs`);

        return stats;
    } catch (error) {
        logError('Import failed', error);
        stats.errors.push(error.message);
        stats.error = error;
        throw error;
    } finally {
        // Disconnect prisma client if we created it
        if (shouldDisconnect) {
            await prisma.$disconnect();
        }
    }
}

module.exports = {
    importData
};