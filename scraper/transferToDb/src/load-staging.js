const {
    logInfo,
    logVerbose,
    logSuccess,
    logError,
    readJsonFile,
    chunkArray,
    toDbJson,
    toDbArray,
    createProgressBar,
    BATCH_SIZE,
    TRANSACTION_TIMEOUT
} = require('./utils');
const { Prisma } = require('@prisma/client');

/**
 * Load companies from 5_companies.json into staging tables
 */
async function loadCompaniesIntoStaging(prisma, filePath) {
    logInfo(`Loading companies from ${filePath} into staging tables...`);

    // Read the JSON file
    const companiesData = readJsonFile(filePath);

    // Check if we have an array of companies or a wrapper object
    let companies = Array.isArray(companiesData) ? companiesData : companiesData.companies || [];

    if (companies.length === 0) {
        logVerbose('No companies found in the input file');
        return 0;
    }

    logInfo(`Found ${companies.length} companies to import`);
    const progressBar = createProgressBar(companies.length);

    try {
        // Process companies in batches
        const chunks = chunkArray(companies, BATCH_SIZE);

        for (let i = 0; i < chunks.length; i++) {
            const batch = chunks[i];
            logVerbose(`Processing company batch ${i + 1}/${chunks.length}`);

            // Use a transaction for each batch with explicit timeout
            await prisma.$transaction(
                async (tx) => {
                    for (const company of batch) {
                        // Validate company data
                        if (!company.name || !company.slug) {
                            logError(`Skipping company with missing name or slug: ${JSON.stringify(company).substring(0, 100)}...`);
                            continue;
                        }

                        // Insert the main company record
                        await tx.$executeRaw`
            INSERT INTO company_staging (
              name, description, domain, email_domains, staff_count,
              markets, stages, office_locations, investors, investor_slugs,
              logos, slug, is_featured, is_remote_friendly, website,
              parent_slugs, parents, data_source
            ) VALUES (
              ${company.name},
              ${company.description || null},
              ${company.domain || null},
              ${company.emailDomains ? toDbJson(company.emailDomains) : null}::jsonb,
              ${company.staffCount || null},
              ${company.markets ? toDbJson(company.markets) : null}::jsonb,
              ${company.stages ? toDbJson(company.stages) : null}::jsonb,
              ${company.officeLocations ? toDbJson(company.officeLocations) : null}::jsonb,
              ${company.investors ? toDbJson(company.investors) : null}::jsonb,
              ${company.investorSlugs ? toDbJson(company.investorSlugs) : null}::jsonb,
              ${company.logos ? toDbJson(company.logos) : null}::jsonb,
              ${company.slug},
              ${!!company.isFeatured},
              ${!!company.isRemoteFriendly},
              ${company.website ? toDbJson(company.website) : null}::jsonb,
              ${company.parentSlugs ? toDbJson(company.parentSlugs) : null}::jsonb,
              ${company.parents ? toDbJson(company.parents) : null}::jsonb,
              ${company.dataSource || null}
            )
          `;

                        // Insert relationship records for markets
                        if (company.markets && Array.isArray(company.markets) && company.markets.length > 0) {
                            for (const market of company.markets) {
                                if (market) {
                                    await tx.$executeRaw`
                  INSERT INTO market_staging (company_slug, market_name)
                  VALUES (${company.slug}, ${market})
                `;
                                }
                            }
                        }

                        // Insert relationship records for stages
                        if (company.stages && Array.isArray(company.stages) && company.stages.length > 0) {
                            for (const stage of company.stages) {
                                if (stage) {
                                    await tx.$executeRaw`
                  INSERT INTO stage_staging (company_slug, stage_name)
                  VALUES (${company.slug}, ${stage})
                `;
                                }
                            }
                        }

                        // Insert relationship records for office locations
                        if (company.officeLocations && Array.isArray(company.officeLocations) && company.officeLocations.length > 0) {
                            for (const location of company.officeLocations) {
                                if (location) {
                                    await tx.$executeRaw`
                  INSERT INTO office_staging (company_slug, location_name)
                  VALUES (${company.slug}, ${location})
                `;
                                }
                            }
                        }

                        // Insert relationship records for investors
                        if (company.investors && Array.isArray(company.investors) && company.investors.length > 0) {
                            for (let i = 0; i < company.investors.length; i++) {
                                const investorName = company.investors[i];
                                if (!investorName) continue;

                                const investorSlug = company.investorSlugs && i < company.investorSlugs.length
                                    ? company.investorSlugs[i]
                                    : investorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                                await tx.$executeRaw`
                INSERT INTO investor_staging (company_slug, investor_name, investor_slug)
                VALUES (${company.slug}, ${investorName}, ${investorSlug})
              `;
                            }
                        }

                        // Update progress bar
                        progressBar.update();
                    }
                },
                { timeout: TRANSACTION_TIMEOUT }
            );
        }

        progressBar.complete();
        logSuccess(`Successfully loaded ${companies.length} companies into staging tables`);
        return companies.length;
    } catch (error) {
        logError('Failed to load companies into staging tables', error);
        throw error;
    }
}

/**
 * Load jobs from 5_jobs.json into staging tables
 */
async function loadJobsIntoStaging(prisma, filePath) {
    logInfo(`Loading jobs from ${filePath} into staging tables...`);

    // Read the JSON file
    const jobsData = readJsonFile(filePath);

    // Check if we have an array of jobs or a wrapper object
    let jobs = Array.isArray(jobsData) ? jobsData : jobsData.jobs || [];

    if (jobs.length === 0) {
        logVerbose('No jobs found in the input file');
        return 0;
    }

    logInfo(`Found ${jobs.length} jobs to import`);
    const progressBar = createProgressBar(jobs.length);

    try {
        // Process jobs in batches
        const chunks = chunkArray(jobs, BATCH_SIZE);

        for (let i = 0; i < chunks.length; i++) {
            const batch = chunks[i];
            logVerbose(`Processing job batch ${i + 1}/${chunks.length}`);

            // Use a transaction for each batch
            await prisma.$transaction(
                async (tx) => {
                    // Get job position in overall array (for job_id in staging tables)
                    const batchOffset = i * BATCH_SIZE;

                    for (let j = 0; j < batch.length; j++) {
                        const job = batch[j];
                        const jobPosition = batchOffset + j + 1; // 1-indexed

                        // Validate job data
                        if (!job.title || !job.companySlug) {
                            logError(`Skipping job with missing title or company slug: ${JSON.stringify(job).substring(0, 100)}...`);
                            continue;
                        }

                        // Insert job record
                        await tx.$executeRaw`
            INSERT INTO job_staging (
              title, apply_url, url, company_slug,
              remote, hybrid, time_stamp, manager, consultant, contractor,
              min_years_exp, max_years_exp, skills, required_skills, preferred_skills,
              departments, job_types, job_functions, locations, job_seniorities, regions,
              salary, data_source
            ) VALUES (
              ${job.title},
              ${job.applyUrl || null},
              ${job.url || null},
              ${job.companySlug},
              ${!!job.remote},
              ${!!job.hybrid},
              ${job.timeStamp ? new Date(job.timeStamp) : null},
              ${!!job.manager},
              ${!!job.consultant},
              ${!!job.contractor},
              ${job.minYearsExp || null},
              ${job.maxYearsExp || null},
              ${job.skills ? toDbJson(job.skills) : null}::jsonb,
              ${job.requiredSkills ? toDbJson(job.requiredSkills) : null}::jsonb,
              ${job.preferredSkills ? toDbJson(job.preferredSkills) : null}::jsonb,
              ${job.departments ? toDbJson(job.departments) : null}::jsonb,
              ${job.jobTypes ? toDbJson(job.jobTypes) : null}::jsonb,
              ${job.jobFunctions ? toDbJson(job.jobFunctions) : null}::jsonb,
              ${job.locations ? toDbJson(job.locations) : null}::jsonb,
              ${job.jobSeniorities ? toDbJson(job.jobSeniorities) : null}::jsonb,
              ${job.regions ? toDbJson(job.regions) : null}::jsonb,
              ${job.salary ? toDbJson(job.salary) : null}::jsonb,
              ${job.dataSource || null}
            )
          `;

                        // Insert job locations
                        const locations =
                            (job.normalizedLocations && Array.isArray(job.normalizedLocations)) ? job.normalizedLocations :
                                (job.locations && Array.isArray(job.locations)) ? job.locations : [];

                        for (const loc of locations) {
                            const locationName = typeof loc === 'string' ? loc : loc.label || loc.value || null;
                            if (locationName) {
                                await tx.$executeRaw`
                INSERT INTO job_location_staging (job_id, company_slug, location_name)
                VALUES (${jobPosition}, ${job.companySlug}, ${locationName})
              `;
                            }
                        }

                        // Insert salary info
                        if (job.salary) {
                            const minValue = job.salary.minValue ? parseFloat(job.salary.minValue) : null;
                            const maxValue = job.salary.maxValue ? parseFloat(job.salary.maxValue) : null;
                            const currency = typeof job.salary.currency === 'string' ?
                                job.salary.currency :
                                job.salary.currency?.value || job.salary.currency?.label || null;
                            const period = typeof job.salary.period === 'string' ?
                                job.salary.period :
                                job.salary.period?.value || job.salary.period?.label || null;

                            await tx.$executeRaw`
              INSERT INTO salary_staging (job_id, min_value, max_value, currency, period)
              VALUES (${jobPosition}, ${minValue}, ${maxValue}, ${currency}, ${period})
            `;
                        }

                        // Update progress bar
                        progressBar.update();
                    }
                },
                { timeout: TRANSACTION_TIMEOUT }
            );
        }

        progressBar.complete();
        logSuccess(`Successfully loaded ${jobs.length} jobs into staging tables`);
        return jobs.length;
    } catch (error) {
        logError('Failed to load jobs into staging tables', error);
        throw error;
    }
}

module.exports = {
    loadCompaniesIntoStaging,
    loadJobsIntoStaging
};