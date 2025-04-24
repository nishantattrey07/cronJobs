const { logInfo, logSuccess, logError } = require('./utils');
const { Prisma } = require('@prisma/client');

/**
 * Creates staging tables optimized for the user's specific Prisma schema
 */
async function createStagingTables(prisma) {
  logInfo('Creating staging tables matching your schema...');

  try {
    // Company staging table - matches the format in 5_companies.json
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS company_staging (
        name TEXT NOT NULL,
        description TEXT,
        domain TEXT,
        email_domains JSONB,
        staff_count INTEGER,
        markets JSONB,
        stages JSONB,
        office_locations JSONB,
        investors JSONB,
        investor_slugs JSONB,
        logos JSONB,
        slug TEXT NOT NULL,
        is_featured BOOLEAN,
        is_remote_friendly BOOLEAN,
        website JSONB,
        parent_slugs JSONB,
        parents JSONB,
        data_source TEXT
      )
    `;

    // Job staging table - matches the format in 5_jobs.json
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS job_staging (
        title TEXT NOT NULL,
        apply_url TEXT,
        url TEXT,
        company_slug TEXT NOT NULL,
        remote BOOLEAN,
        hybrid BOOLEAN,
        time_stamp TIMESTAMP,
        manager BOOLEAN,
        consultant BOOLEAN,
        contractor BOOLEAN,
        min_years_exp INTEGER,
        max_years_exp INTEGER,
        skills JSONB,
        required_skills JSONB,
        preferred_skills JSONB,
        departments JSONB,
        job_types JSONB,
        job_functions JSONB,
        locations JSONB,
        job_seniorities JSONB,
        regions JSONB,
        salary JSONB,
        data_source TEXT
      )
    `;

    // Relationship staging tables - for flattening JSON arrays into rows
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS market_staging (company_slug TEXT, market_name TEXT)`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS stage_staging (company_slug TEXT, stage_name TEXT)`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS office_staging (company_slug TEXT, location_name TEXT)`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS investor_staging (company_slug TEXT, investor_name TEXT, investor_slug TEXT)`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS job_location_staging (job_id SERIAL, company_slug TEXT, location_name TEXT)`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS salary_staging (job_id SERIAL, min_value FLOAT, max_value FLOAT, currency TEXT, period TEXT)`;

    // Create an index on company_slug for better join performance
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_company_staging_slug ON company_staging (slug)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_job_staging_company_slug ON job_staging (company_slug)`;

    // Clear any existing data from staging tables
    await clearStagingTables(prisma);

    logSuccess('Staging tables created successfully');
  } catch (error) {
    logError('Failed to create staging tables', error);
    throw error;
  }
}

/**
 * Clears all data from staging tables without dropping them
 */
async function clearStagingTables(prisma) {
  logInfo('Clearing existing data from staging tables...');

  try {
    // First check if tables exist before truncating
    const tables = [
      'company_staging', 'job_staging', 'market_staging', 'stage_staging',
      'office_staging', 'investor_staging', 'job_location_staging', 'salary_staging'
    ];

    for (const table of tables) {
      // Check if table exists
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${table}
        ) as exists
      `;

      // If table exists, truncate it
      if (result[0].exists) {
        // Use Prisma.sql for dynamic interpolation instead of $raw
        await prisma.$executeRaw`TRUNCATE TABLE ${Prisma.sql([`"${table}"`])}`;
      }
    }

    logSuccess('Staging tables cleared successfully');
  } catch (error) {
    logError('Failed to clear staging tables', error);
    // Not a critical error, so we log and continue
  }
}

async function dropStagingTables(prisma) {
  logInfo('Dropping staging tables...');

  try {
    await prisma.$executeRaw`DROP TABLE IF EXISTS company_staging`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS job_staging`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS market_staging`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS stage_staging`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS office_staging`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS investor_staging`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS job_location_staging`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS salary_staging`;

    logSuccess('Staging tables dropped successfully');
  } catch (error) {
    logError('Failed to drop staging tables', error);
    // Not a critical error, so we log and continue
  }
}

module.exports = {
  createStagingTables,
  clearStagingTables,
  dropStagingTables
};