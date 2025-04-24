const { logInfo, logVerbose, logSuccess, logError, TRANSACTION_TIMEOUT } = require('./utils');
const { Prisma } = require('@prisma/client');

/**
 * Transform staging table data to final Prisma schema tables
 */
async function transformStagingToFinal(prisma, options = {}) {
  const { mode = 'insert' } = options;
  logInfo(`Transforming staging data into final schema tables (mode: ${mode})...`);

  try {
    // Use a longer timeout for the transformation process
    await prisma.$transaction(async (tx) => {
      // Need to process in the correct order to respect foreign key constraints

      // Step 1: Process Companies
      await processCompaniesFromStaging(tx, mode);

      // Step 2: Process related entities (markets, stages, offices, investors)
      await processRelatedEntitiesFromStaging(tx);

      // Step 3: Process Jobs
      await processJobsFromStaging(tx, mode);

      // Step 4: Process job relationships (locations, salary ranges)
      await processJobRelationshipsFromStaging(tx);

      // Step 5: Update counters
      await updateCounters(tx);

    }, { timeout: TRANSACTION_TIMEOUT * 2 }); // Extra time for transformation

    logSuccess('Successfully transformed staging data into the final schema');
  } catch (error) {
    logError('Failed to transform staging data', error);
    throw error;
  }
}

/**
 * Process companies from staging to final schema
 */
async function processCompaniesFromStaging(prisma, mode) {
  logVerbose('Processing companies from staging...');

  let result;
  if (mode === 'insert') {
    // For new data, insert into the Company table
    result = await prisma.$executeRaw`
      INSERT INTO "Company" (
        id, name, description, domain, "emailDomains", "staffCount",
        "numJobs", slug, "isFeatured", "isRemoteFriendly", logos, website,
        "parentSlugs", parents, "dataSource"
      )
      SELECT 
        gen_random_uuid(), -- Generate UUID for id
        name, 
        description,
        domain,
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(email_domains) AS x), 
          '{}'::text[]
        ), -- Properly convert JSONB to text array
        staff_count,
        0, -- numJobs starts at 0
        slug,
        is_featured,
        is_remote_friendly,
        logos,
        website,
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(parent_slugs) AS x), 
          '{}'::text[]
        ), -- Properly convert JSONB to text array
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(parents) AS x), 
          '{}'::text[]
        ), -- Properly convert JSONB to text array
        data_source
      FROM company_staging
      ON CONFLICT (slug) DO NOTHING
    `;
  } else if (mode === 'upsert') {
    // For existing data, update on conflict
    result = await prisma.$executeRaw`
      INSERT INTO "Company" (
        id, name, description, domain, "emailDomains", "staffCount",
        "numJobs", slug, "isFeatured", "isRemoteFriendly", logos, website,
        "parentSlugs", parents, "dataSource"
      )
      SELECT 
        gen_random_uuid(), -- Generate UUID for id
        name, 
        description,
        domain,
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(email_domains) AS x), 
          '{}'::text[]
        ), -- Properly convert JSONB to text array
        staff_count,
        COALESCE((SELECT "numJobs" FROM "Company" c WHERE c.slug = company_staging.slug), 0),
        slug,
        is_featured,
        is_remote_friendly,
        logos,
        website,
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(parent_slugs) AS x), 
          '{}'::text[]
        ), -- Properly convert JSONB to text array
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(parents) AS x), 
          '{}'::text[]
        ), -- Properly convert JSONB to text array
        data_source
      FROM company_staging
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        domain = EXCLUDED.domain,
        "emailDomains" = EXCLUDED."emailDomains",
        "staffCount" = EXCLUDED."staffCount",
        "isFeatured" = EXCLUDED."isFeatured",
        "isRemoteFriendly" = EXCLUDED."isRemoteFriendly",
        logos = EXCLUDED.logos,
        website = EXCLUDED.website,
        "parentSlugs" = EXCLUDED."parentSlugs",
        parents = EXCLUDED.parents,
        "dataSource" = EXCLUDED."dataSource"
    `;
  }

  logVerbose(`Processed ${result || 0} companies`);
}

/**
 * Process related entities from staging (markets, stages, offices, investors)
 */
async function processRelatedEntitiesFromStaging(prisma) {
  logVerbose('Processing related entities from staging...');

  // Process Markets
  await prisma.$executeRaw`
    -- First create all unique markets
    INSERT INTO "Market" (id, name)
    SELECT gen_random_uuid(), market_name 
    FROM (SELECT DISTINCT market_name FROM market_staging) AS distinct_markets
    ON CONFLICT (name) DO NOTHING
  `;

  // Link companies to markets
  await prisma.$executeRaw`
    -- Then create the relationships
    INSERT INTO "CompanyMarket" ("companyId", "marketId")
    SELECT 
      c.id,
      m.id
    FROM market_staging ms
    JOIN "Market" m ON ms.market_name = m.name
    JOIN "Company" c ON ms.company_slug = c.slug
    ON CONFLICT ("companyId", "marketId") DO NOTHING
  `;

  // Process Stages
  await prisma.$executeRaw`
    INSERT INTO "Stage" (id, name)
    SELECT gen_random_uuid(), stage_name 
    FROM (SELECT DISTINCT stage_name FROM stage_staging) AS distinct_stages
    ON CONFLICT (name) DO NOTHING
  `;

  await prisma.$executeRaw`
    INSERT INTO "CompanyStage" ("companyId", "stageId")
    SELECT 
      c.id,
      s.id
    FROM stage_staging ss
    JOIN "Stage" s ON ss.stage_name = s.name
    JOIN "Company" c ON ss.company_slug = c.slug
    ON CONFLICT ("companyId", "stageId") DO NOTHING
  `;

  // Process Offices
  await prisma.$executeRaw`
    INSERT INTO "Office" (id, location)
    SELECT gen_random_uuid(), location_name 
    FROM (
      SELECT DISTINCT location_name FROM office_staging
      UNION
      SELECT DISTINCT location_name FROM job_location_staging
    ) as unique_locations
    ON CONFLICT (location) DO NOTHING
  `;

  await prisma.$executeRaw`
    INSERT INTO "CompanyOffice" ("companyId", "officeId")
    SELECT 
      c.id,
      o.id
    FROM office_staging os
    JOIN "Office" o ON os.location_name = o.location
    JOIN "Company" c ON os.company_slug = c.slug
    ON CONFLICT ("companyId", "officeId") DO NOTHING
  `;

  // Process Investors
  await prisma.$executeRaw`
    INSERT INTO "Investor" (id, name, slug)
    SELECT gen_random_uuid(), investor_name, investor_slug
    FROM (SELECT DISTINCT investor_name, investor_slug FROM investor_staging) as unique_investors
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name
  `;

  await prisma.$executeRaw`
    INSERT INTO "CompanyInvestor" ("companyId", "investorId")
    SELECT 
      c.id,
      i.id
    FROM investor_staging ins
    JOIN "Investor" i ON ins.investor_slug = i.slug
    JOIN "Company" c ON ins.company_slug = c.slug
    ON CONFLICT ("companyId", "investorId") DO NOTHING
  `;

  logVerbose('Processed all related entities and relationships');
}

/**
 * Process jobs from staging to final schema
 */
async function processJobsFromStaging(prisma, mode) {
  logVerbose('Processing jobs from staging...');

  // For jobs, we need to link to companies by slug
  if (mode === 'insert') {
    // For new data, only insert jobs where we can find the company
    const result = await prisma.$executeRaw`
      INSERT INTO "Job" (
        id, title, "applyUrl", url, "companyId", remote, hybrid, 
        "timeStamp", manager, consultant, contractor, 
        "minYearsExp", "maxYearsExp", skills, "requiredSkills", 
        "preferredSkills", departments, "jobTypes", 
        "jobFunctions", "jobSeniorities", regions, "dataSource"
      )
      SELECT 
        gen_random_uuid(),
        js.title,
        js.apply_url,
        js.url,
        c.id, -- companyId comes from the Company table
        js.remote,
        js.hybrid,
        js.time_stamp,
        js.manager,
        js.consultant,
        js.contractor,
        js.min_years_exp,
        js.max_years_exp,
        js.skills,
        js.required_skills,
        js.preferred_skills,
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(js.departments) AS x), 
          '{}'::text[]
        ), -- Convert JSONB to text array
        js.job_types,
        js.job_functions,
        js.job_seniorities,
        js.regions,
        js.data_source
      FROM job_staging js
      JOIN "Company" c ON js.company_slug = c.slug
    `;
    logVerbose(`Processed ${result || 0} jobs`);
  } else if (mode === 'upsert') {
    // For update mode, we need a way to identify existing jobs
    // This is challenging without a natural key, but we can use title + company as an approximation
    // First, create new jobs
    logVerbose('Inserting new jobs...');
    const insertResult = await prisma.$executeRaw`
      WITH existing_jobs AS (
        SELECT j.title, c.slug as company_slug
        FROM "Job" j
        JOIN "Company" c ON j."companyId" = c.id
      )
      INSERT INTO "Job" (
        id, title, "applyUrl", url, "companyId", remote, hybrid, 
        "timeStamp", manager, consultant, contractor, 
        "minYearsExp", "maxYearsExp", skills, "requiredSkills", 
        "preferredSkills", departments, "jobTypes", 
        "jobFunctions", "jobSeniorities", regions, "dataSource"
      )
      SELECT 
        gen_random_uuid(),
        js.title,
        js.apply_url,
        js.url,
        c.id, -- companyId comes from the Company table
        js.remote,
        js.hybrid,
        js.time_stamp,
        js.manager,
        js.consultant,
        js.contractor,
        js.min_years_exp,
        js.max_years_exp,
        js.skills,
        js.required_skills,
        js.preferred_skills,
        COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(js.departments) AS x), 
          '{}'::text[]
        ), -- Convert JSONB to text array
        js.job_types,
        js.job_functions,
        js.job_seniorities,
        js.regions,
        js.data_source
      FROM job_staging js
      JOIN "Company" c ON js.company_slug = c.slug
      LEFT JOIN existing_jobs ej ON js.title = ej.title AND js.company_slug = ej.company_slug
      WHERE ej.company_slug IS NULL
    `;

    // Then update existing jobs
    logVerbose('Updating existing jobs...');
    const updateResult = await prisma.$executeRaw`
      WITH job_mapping AS (
        SELECT j.id, js.title, js.company_slug
        FROM job_staging js
        JOIN "Company" c ON js.company_slug = c.slug
        JOIN "Job" j ON js.title = j.title AND j."companyId" = c.id
      )
      UPDATE "Job" j
      SET
        "applyUrl" = js.apply_url,
        url = js.url,
        remote = js.remote,
        hybrid = js.hybrid,
        "timeStamp" = js.time_stamp,
        manager = js.manager,
        consultant = js.consultant,
        contractor = js.contractor,
        "minYearsExp" = js.min_years_exp,
        "maxYearsExp" = js.max_years_exp,
        skills = js.skills,
        "requiredSkills" = js.required_skills,
        "preferredSkills" = js.preferred_skills,
        departments = COALESCE(
          (SELECT array_agg(x) FROM jsonb_array_elements_text(js.departments) AS x), 
          '{}'::text[]
        ), -- Convert JSONB to text array
        "jobTypes" = js.job_types,
        "jobFunctions" = js.job_functions,
        "jobSeniorities" = js.job_seniorities,
        regions = js.regions,
        "dataSource" = js.data_source
      FROM job_staging js
      JOIN job_mapping jm ON js.title = jm.title AND js.company_slug = jm.company_slug
      WHERE j.id = jm.id
    `;

    logVerbose(`Inserted ${insertResult || 0} new jobs and updated ${updateResult || 0} existing jobs`);
  }
}

/**
 * Process job relationships from staging (job locations, salary ranges)
 */
async function processJobRelationshipsFromStaging(prisma) {
  logVerbose('Processing job relationships from staging...');

  // First identify processed jobs by their company slug and title
  await prisma.$executeRaw`
    CREATE TEMP TABLE IF NOT EXISTS job_mapping AS
    SELECT j.id as job_id, js.company_slug, js.title, jls.job_id as staging_job_id
    FROM job_staging js
    JOIN "Company" c ON js.company_slug = c.slug
    JOIN "Job" j ON js.title = j.title AND j."companyId" = c.id
    LEFT JOIN job_location_staging jls ON js.company_slug = jls.company_slug AND js.title = (
      SELECT js2.title FROM job_staging js2 
      JOIN job_location_staging jls2 ON jls2.job_id = jls.job_id
      WHERE js2.company_slug = jls.company_slug
      LIMIT 1
    )
  `;

  // For upsert mode, clear existing relationships first
  await prisma.$executeRaw`
    DELETE FROM "JobOffice"
    WHERE "jobId" IN (SELECT job_id FROM job_mapping)
  `;

  // Process job locations
  await prisma.$executeRaw`
    INSERT INTO "JobOffice" ("jobId", "officeId")
    SELECT 
      jm.job_id,
      o.id
    FROM job_location_staging jls
    JOIN job_mapping jm ON jls.job_id = jm.staging_job_id
    JOIN "Office" o ON jls.location_name = o.location
    ON CONFLICT ("jobId", "officeId") DO NOTHING
  `;

  // Process salary ranges - use a subquery with DISTINCT ON to handle duplicates
  await prisma.$executeRaw`
    INSERT INTO "SalaryRange" (id, "jobId", "minValue", "maxValue", currency, period)
    SELECT 
      gen_random_uuid(),
      unique_salaries.job_id,
      unique_salaries.min_value,
      unique_salaries.max_value,
      unique_salaries.currency,
      unique_salaries.period
    FROM (
      SELECT DISTINCT ON (jm.job_id)
        jm.job_id,
        ss.min_value,
        ss.max_value,
        ss.currency,
        ss.period
      FROM salary_staging ss
      JOIN job_mapping jm ON ss.job_id = jm.staging_job_id
      -- Take the first one for each job_id (you could add ORDER BY to control which one)
      ORDER BY jm.job_id, ss.min_value DESC
    ) AS unique_salaries
    ON CONFLICT ("jobId") DO UPDATE SET
      "minValue" = EXCLUDED."minValue",
      "maxValue" = EXCLUDED."maxValue",
      currency = EXCLUDED.currency,
      period = EXCLUDED.period
  `;

  // Clean up
  await prisma.$executeRaw`DROP TABLE IF EXISTS job_mapping`;

  logVerbose('Processed all job relationships');
}

/**
 * Update counters in the database
 */
async function updateCounters(prisma) {
  logVerbose('Updating counters...');

  // Update company job counts
  await prisma.$executeRaw`
    UPDATE "Company" c
    SET "numJobs" = (
      SELECT COUNT(*) FROM "Job" j WHERE j."companyId" = c.id
    )
  `;

  logVerbose('Updated all counters');
}

module.exports = {
  transformStagingToFinal
};