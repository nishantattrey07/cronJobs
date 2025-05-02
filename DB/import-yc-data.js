#!/usr/bin/env node
/**
 * YC Data Import Script
 * 
 * This script imports YC companies and jobs data from JSON files into the database.
 * It's optimized for performance with batch processing, progress tracking, and proper deduplication.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration Constants
const BATCH_SIZE = 50; // Batch size for main entities
const RELATIONSHIP_BATCH_SIZE = 500; // Batch size for relationship operations
const TRANSACTION_TIMEOUT = 60000; // 1 minute
const DATA_SOURCE = 'YC';

// Initialize Prisma client with error logging
const prisma = new PrismaClient({
    log: ['error'],
});

/**
 * Helper function to create a progress bar in the console
 */
function createProgressBar(total, label = '') {
    const barLength = 30;
    let current = 0;
    let startTime = Date.now();

    return {
        update: (increment = 1) => {
            current += increment;
            const percentage = Math.min(100, Math.floor((current / total) * 100));
            const filledLength = Math.floor((percentage / 100) * barLength);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

            // Calculate ETA
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const itemsPerSecond = current / elapsedSeconds;
            const remainingItems = total - current;
            const etaSeconds = remainingItems / itemsPerSecond;

            // Format ETA
            const etaMinutes = Math.floor(etaSeconds / 60);
            const etaRemainingSeconds = Math.floor(etaSeconds % 60);
            const etaFormatted = etaMinutes > 0
                ? `${etaMinutes}m ${etaRemainingSeconds}s`
                : `${etaRemainingSeconds}s`;

            if (label) {
                process.stdout.write(`\r${label}: [${bar}] ${percentage}% | ${current}/${total} | ETA: ${etaFormatted} | ${itemsPerSecond.toFixed(2)}/sec`);
            } else {
                process.stdout.write(`\r[${bar}] ${percentage}% | ${current}/${total} | ETA: ${etaFormatted} | ${itemsPerSecond.toFixed(2)}/sec`);
            }

            if (current >= total) {
                process.stdout.write('\n');
            }
        },
        complete: () => {
            if (current < total) {
                current = total;
                const bar = '█'.repeat(barLength);
                if (label) {
                    process.stdout.write(`\r${label}: [${bar}] 100% | ${total}/${total}\n`);
                } else {
                    process.stdout.write(`\r[${bar}] 100% | ${total}/${total}\n`);
                }
            }

            // Calculate total time
            const totalTime = (Date.now() - startTime) / 1000;
            const minutes = Math.floor(totalTime / 60);
            const seconds = Math.floor(totalTime % 60);
            console.log(`✅ Completed in ${minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}`);
            console.log(`🚀 Average speed: ${Math.round(total / totalTime)} items/second`);
        }
    };
}

/**
 * Helper to read and parse JSON files
 */
function readJsonFile(filePath) {
    try {
        console.log(`📂 Reading file: ${filePath}`);
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Failed to read JSON file: ${filePath}`, error);
        throw error;
    }
}

/**
 * Helper to chunk arrays for batch processing
 */
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Validate file paths before running import
 */
function validateFilePaths(companiesFile, jobsFile) {
    const errors = [];
    if (!fs.existsSync(companiesFile)) {
        errors.push(`Companies file not found: ${companiesFile}`);
    }
    if (!fs.existsSync(jobsFile)) {
        errors.push(`Jobs file not found: ${jobsFile}`);
    }
    return errors;
}

/**
 * Process company-market relationships with optimized approach
 */
async function processCompanyMarketRelationships(relations, companySlugToIdMap) {
    console.log(`\n🔄 Processing ${relations.length} company-market relationships...`);

    // Step 1: Deduplicate in memory
    const uniqueRelations = new Map();
    let validRelationsCount = 0;

    for (const rel of relations) {
        const companyId = companySlugToIdMap.get(rel.companySlug);
        if (!companyId) continue;

        const key = `${companyId}_${rel.marketName}`;
        uniqueRelations.set(key, {
            companySlug: rel.companySlug,
            marketName: rel.marketName,
            companyId
        });
        validRelationsCount++;
    }

    const dedupedRelations = Array.from(uniqueRelations.values());
    console.log(`🧹 Removed ${validRelationsCount - dedupedRelations.length} duplicate relationships`);
    console.log(`🔄 Creating ${dedupedRelations.length} unique company-market relationships...`);

    // Step 2: Preload all markets for faster lookups
    console.log(`  🔍 Preloading markets for faster processing...`);
    const allMarkets = await prisma.market.findMany();
    const marketNameToIdMap = new Map();
    for (const market of allMarkets) {
        marketNameToIdMap.set(market.name, market.id);
    }

    // Step 3: Process in batches with createMany
    const progressBar = createProgressBar(dedupedRelations.length, "Market Relations");
    const chunks = chunkArray(dedupedRelations, RELATIONSHIP_BATCH_SIZE);

    for (const chunk of chunks) {
        // Prepare batch data
        const batchData = [];

        for (const rel of chunk) {
            const marketId = marketNameToIdMap.get(rel.marketName);
            if (marketId) {
                batchData.push({
                    companyId: rel.companyId,
                    marketId: marketId
                });
            }
        }

        if (batchData.length > 0) {
            try {
                // Use createMany with skipDuplicates
                await prisma.companyMarket.createMany({
                    data: batchData,
                    skipDuplicates: true
                });
            } catch (error) {
                console.error(`Error batch creating market relationships:`, error);
            }
        }

        // Update progress bar for the whole chunk
        progressBar.update(chunk.length);
    }

    progressBar.complete();
    return dedupedRelations.length;
}

/**
 * Process company-stage relationships with optimized approach
 */
async function processCompanyStageRelationships(relations, companySlugToIdMap) {
    console.log(`\n🔄 Processing ${relations.length} company-stage relationships...`);

    // Step 1: Deduplicate in memory
    const uniqueRelations = new Map();
    let validRelationsCount = 0;

    for (const rel of relations) {
        const companyId = companySlugToIdMap.get(rel.companySlug);
        if (!companyId) continue;

        const key = `${companyId}_${rel.stageName}`;
        uniqueRelations.set(key, {
            companySlug: rel.companySlug,
            stageName: rel.stageName,
            companyId
        });
        validRelationsCount++;
    }

    const dedupedRelations = Array.from(uniqueRelations.values());
    console.log(`🧹 Removed ${validRelationsCount - dedupedRelations.length} duplicate relationships`);
    console.log(`🔄 Creating ${dedupedRelations.length} unique company-stage relationships...`);

    // Step 2: Preload all stages for faster lookups
    console.log(`  🔍 Preloading stages for faster processing...`);
    const allStages = await prisma.stage.findMany();
    const stageNameToIdMap = new Map();
    for (const stage of allStages) {
        stageNameToIdMap.set(stage.name, stage.id);
    }

    // Step 3: Process in batches with createMany
    const progressBar = createProgressBar(dedupedRelations.length, "Stage Relations");
    const chunks = chunkArray(dedupedRelations, RELATIONSHIP_BATCH_SIZE);

    for (const chunk of chunks) {
        // Prepare batch data
        const batchData = [];

        for (const rel of chunk) {
            const stageId = stageNameToIdMap.get(rel.stageName);
            if (stageId) {
                batchData.push({
                    companyId: rel.companyId,
                    stageId: stageId
                });
            }
        }

        if (batchData.length > 0) {
            try {
                // Use createMany with skipDuplicates
                await prisma.companyStage.createMany({
                    data: batchData,
                    skipDuplicates: true
                });
            } catch (error) {
                console.error(`Error batch creating stage relationships:`, error);
            }
        }

        // Update progress bar for the whole chunk
        progressBar.update(chunk.length);
    }

    progressBar.complete();
    return dedupedRelations.length;
}

/**
 * Process company-office relationships with optimized approach
 */
async function processCompanyOfficeRelationships(relations, companySlugToIdMap) {
    console.log(`\n🔄 Processing ${relations.length} company-office relationships...`);

    // Step 1: Deduplicate in memory
    const uniqueRelations = new Map();
    let validRelationsCount = 0;

    for (const rel of relations) {
        const companyId = companySlugToIdMap.get(rel.companySlug);
        if (!companyId) continue;

        const key = `${companyId}_${rel.officeLocation}`;
        uniqueRelations.set(key, {
            companySlug: rel.companySlug,
            officeLocation: rel.officeLocation,
            companyId
        });
        validRelationsCount++;
    }

    const dedupedRelations = Array.from(uniqueRelations.values());
    console.log(`🧹 Removed ${validRelationsCount - dedupedRelations.length} duplicate relationships`);
    console.log(`🔄 Creating ${dedupedRelations.length} unique company-office relationships...`);

    // Step 2: Preload all offices for faster lookups
    console.log(`  🔍 Preloading offices for faster processing...`);
    const allOffices = await prisma.office.findMany();
    const officeLocationToIdMap = new Map();
    for (const office of allOffices) {
        officeLocationToIdMap.set(office.location, office.id);
    }

    // Step 3: Process in batches with createMany
    const progressBar = createProgressBar(dedupedRelations.length, "Office Relations");
    const chunks = chunkArray(dedupedRelations, RELATIONSHIP_BATCH_SIZE);

    for (const chunk of chunks) {
        // Prepare batch data
        const batchData = [];

        for (const rel of chunk) {
            const officeId = officeLocationToIdMap.get(rel.officeLocation);
            if (officeId) {
                batchData.push({
                    companyId: rel.companyId,
                    officeId: officeId
                });
            }
        }

        if (batchData.length > 0) {
            try {
                // Use createMany with skipDuplicates
                await prisma.companyOffice.createMany({
                    data: batchData,
                    skipDuplicates: true
                });
            } catch (error) {
                console.error(`Error batch creating office relationships:`, error);
            }
        }

        // Update progress bar for the whole chunk
        progressBar.update(chunk.length);
    }

    progressBar.complete();
    return dedupedRelations.length;
}

/**
 * Process company-investor relationships with optimized approach
 */
async function processCompanyInvestorRelationships(relations, companySlugToIdMap) {
    console.log(`\n🔄 Processing ${relations.length} company-investor relationships...`);

    if (relations.length === 0) {
        console.log(`No investor relationships to process.`);
        return 0;
    }

    // Step 1: Deduplicate in memory
    const uniqueRelations = new Map();
    let validRelationsCount = 0;

    for (const rel of relations) {
        const companyId = companySlugToIdMap.get(rel.companySlug);
        if (!companyId) continue;

        const key = `${companyId}_${rel.investorSlug}`;
        uniqueRelations.set(key, {
            companySlug: rel.companySlug,
            investorSlug: rel.investorSlug,
            companyId
        });
        validRelationsCount++;
    }

    const dedupedRelations = Array.from(uniqueRelations.values());
    console.log(`🧹 Removed ${validRelationsCount - dedupedRelations.length} duplicate relationships`);
    console.log(`🔄 Creating ${dedupedRelations.length} unique company-investor relationships...`);

    // Step 2: Preload all investors for faster lookups
    console.log(`  🔍 Preloading investors for faster processing...`);
    const allInvestors = await prisma.investor.findMany();
    const investorSlugToIdMap = new Map();
    for (const investor of allInvestors) {
        investorSlugToIdMap.set(investor.slug, investor.id);
    }

    // Step 3: Process in batches with createMany
    const progressBar = createProgressBar(dedupedRelations.length, "Investor Relations");
    const chunks = chunkArray(dedupedRelations, RELATIONSHIP_BATCH_SIZE);

    for (const chunk of chunks) {
        // Prepare batch data
        const batchData = [];

        for (const rel of chunk) {
            const investorId = investorSlugToIdMap.get(rel.investorSlug);
            if (investorId) {
                batchData.push({
                    companyId: rel.companyId,
                    investorId: investorId
                });
            }
        }

        if (batchData.length > 0) {
            try {
                // Use createMany with skipDuplicates
                await prisma.companyInvestor.createMany({
                    data: batchData,
                    skipDuplicates: true
                });
            } catch (error) {
                console.error(`Error batch creating investor relationships:`, error);
            }
        }

        // Update progress bar for the whole chunk
        progressBar.update(chunk.length);
    }

    progressBar.complete();
    return dedupedRelations.length;
}

/**
 * Process company-founder relationships with optimized approach
 */
async function processCompanyFounderRelationships(relations, companySlugToIdMap) {
    console.log(`\n🔄 Processing ${relations.length} company-founder relationships...`);

    // Step 1: Deduplicate in memory
    const uniqueRelations = new Map();
    let validRelationsCount = 0;

    for (const rel of relations) {
        const companyId = companySlugToIdMap.get(rel.companySlug);
        if (!companyId) continue;

        const key = `${companyId}_${rel.founderId}`;
        uniqueRelations.set(key, {
            companySlug: rel.companySlug,
            founderId: rel.founderId,
            companyId
        });
        validRelationsCount++;
    }

    const dedupedRelations = Array.from(uniqueRelations.values());
    console.log(`🧹 Removed ${validRelationsCount - dedupedRelations.length} duplicate relationships`);
    console.log(`🔄 Creating ${dedupedRelations.length} unique company-founder relationships...`);

    // Step 2: Preload all founders for faster lookups
    console.log(`  🔍 Preloading founders for faster processing...`);
    const allFounders = await prisma.founder.findMany();
    const founderIdToIdMap = new Map();
    for (const founder of allFounders) {
        founderIdToIdMap.set(founder.id, founder.id);
    }

    // Step 3: Process in batches with createMany
    const progressBar = createProgressBar(dedupedRelations.length, "Founder Relations");
    const chunks = chunkArray(dedupedRelations, RELATIONSHIP_BATCH_SIZE);

    for (const chunk of chunks) {
        // Prepare batch data
        const batchData = [];

        for (const rel of chunk) {
            const founderId = founderIdToIdMap.get(rel.founderId);
            if (founderId) {
                batchData.push({
                    companyId: rel.companyId,
                    founderId: founderId
                });
            }
        }

        if (batchData.length > 0) {
            try {
                // Use createMany with skipDuplicates
                await prisma.companyFounder.createMany({
                    data: batchData,
                    skipDuplicates: true
                });
            } catch (error) {
                console.error(`Error batch creating founder relationships:`, error);
            }
        }

        // Update progress bar for the whole chunk
        progressBar.update(chunk.length);
    }

    progressBar.complete();
    return dedupedRelations.length;
}

/**
 * Process job-office relationships with optimized approach
 */
async function processJobOfficeRelationships(relations) {
    console.log(`\n🔄 Processing ${relations.length} job-office relationships...`);

    // Step 1: Deduplicate in memory
    const uniqueRelations = new Map();
    let validRelationsCount = 0;

    for (const rel of relations) {
        if (!rel.jobId) continue;

        const key = `${rel.jobId}_${rel.officeLocation}`;
        uniqueRelations.set(key, {
            jobId: rel.jobId,
            officeLocation: rel.officeLocation
        });
        validRelationsCount++;
    }

    const dedupedRelations = Array.from(uniqueRelations.values());
    console.log(`🧹 Removed ${validRelationsCount - dedupedRelations.length} duplicate relationships`);
    console.log(`🔄 Creating ${dedupedRelations.length} unique job-office relationships...`);

    // Step 2: Preload all offices for faster lookups
    console.log(`  🔍 Preloading offices for faster processing...`);
    const allOffices = await prisma.office.findMany();
    const officeLocationToIdMap = new Map();
    for (const office of allOffices) {
        officeLocationToIdMap.set(office.location, office.id);
    }

    // Step 3: Process in batches with createMany
    const progressBar = createProgressBar(dedupedRelations.length, "Job-Office Relations");
    const chunks = chunkArray(dedupedRelations, RELATIONSHIP_BATCH_SIZE);

    for (const chunk of chunks) {
        // Prepare batch data
        const batchData = [];

        for (const rel of chunk) {
            const officeId = officeLocationToIdMap.get(rel.officeLocation);
            if (officeId) {
                batchData.push({
                    jobId: rel.jobId,
                    officeId: officeId
                });
            }
        }

        if (batchData.length > 0) {
            try {
                // Use createMany with skipDuplicates
                await prisma.jobOffice.createMany({
                    data: batchData,
                    skipDuplicates: true
                });
            } catch (error) {
                console.error(`Error batch creating job-office relationships:`, error);
            }
        }

        // Update progress bar for the whole chunk
        progressBar.update(chunk.length);
    }

    progressBar.complete();
    return dedupedRelations.length;
}

/**
 * Process companies data
 */
async function processCompanies(companies) {
    console.log(`\n🏢 Processing ${companies.length} companies...`);

    const progressBar = createProgressBar(companies.length, "Companies");
    const chunks = chunkArray(companies, BATCH_SIZE);

    // Track unique entities for relationship tables
    const marketsMap = new Map();
    const stagesMap = new Map();
    const officesMap = new Map();
    const investorsMap = new Map();
    const foundersMap = new Map();

    // For tracking created companies and their IDs
    const companySlugToIdMap = new Map();

    // Track relationships to be created
    const companyMarketRelations = [];
    const companyStageRelations = [];
    const companyOfficeRelations = [];
    const companyInvestorRelations = [];
    const companyFounderRelations = [];

    let companiesProcessed = 0;

    for (let i = 0; i < chunks.length; i++) {
        const batch = chunks[i];

        await prisma.$transaction(async (tx) => {
            // Create companies and collect entities for relationship tables
            for (const company of batch) {
                // Skip companies without a name or slug
                if (!company.name || !company.slug) {
                    console.error(`⚠️ Skipping company with missing name or slug: ${JSON.stringify(company).substring(0, 100)}...`);
                    progressBar.update();
                    continue;
                }

                try {
                    // Create the company
                    const createdCompany = await tx.company.upsert({
                        where: { slug: company.slug },
                        update: {
                            name: company.name,
                            description: company.description,
                            domain: company.domain,
                            emailDomains: Array.isArray(company.emailDomains) ? company.emailDomains : [],
                            staffCount: company.staffCount || 0,
                            isFeatured: !!company.isFeatured,
                            isRemoteFriendly: !!company.isRemoteFriendly,
                            logos: company.logos || null,
                            website: company.website || null,
                            parentSlugs: Array.isArray(company.parentSlugs) ? company.parentSlugs : [],
                            parents: Array.isArray(company.parents) ? company.parents : [],
                            dataSource: DATA_SOURCE,
                            batchInfo: company.batchInfo,
                            foundedAt: company.foundedAt ? new Date(company.foundedAt) : null,
                            oneLiner: company.oneLiner,
                            status: company.status
                        },
                        create: {
                            name: company.name,
                            description: company.description,
                            domain: company.domain,
                            emailDomains: Array.isArray(company.emailDomains) ? company.emailDomains : [],
                            staffCount: company.staffCount || 0,
                            slug: company.slug,
                            isFeatured: !!company.isFeatured,
                            isRemoteFriendly: !!company.isRemoteFriendly,
                            logos: company.logos || null,
                            website: company.website || null,
                            parentSlugs: Array.isArray(company.parentSlugs) ? company.parentSlugs : [],
                            parents: Array.isArray(company.parents) ? company.parents : [],
                            dataSource: DATA_SOURCE,
                            batchInfo: company.batchInfo,
                            foundedAt: company.foundedAt ? new Date(company.foundedAt) : null,
                            oneLiner: company.oneLiner,
                            status: company.status
                        }
                    });

                    // Store the company ID for later use
                    companySlugToIdMap.set(company.slug, createdCompany.id);

                    // Collect markets
                    if (company.markets && Array.isArray(company.markets)) {
                        for (const market of company.markets) {
                            if (market && market.name) {
                                marketsMap.set(market.name, market);
                                // Store the relationship to create later
                                companyMarketRelations.push({
                                    companySlug: company.slug,
                                    marketName: market.name
                                });
                            }
                        }
                    }

                    // Collect stage
                    if (company.stage && company.stage.name) {
                        stagesMap.set(company.stage.name, company.stage);
                        // Store the relationship to create later
                        companyStageRelations.push({
                            companySlug: company.slug,
                            stageName: company.stage.name
                        });
                    }

                    // Collect offices
                    if (company.offices && Array.isArray(company.offices)) {
                        for (const office of company.offices) {
                            if (office && office.location) {
                                officesMap.set(office.location, office);
                                // Store the relationship to create later
                                companyOfficeRelations.push({
                                    companySlug: company.slug,
                                    officeLocation: office.location
                                });
                            }
                        }
                    }

                    // Collect investors
                    if (company.investors && Array.isArray(company.investors)) {
                        for (const investor of company.investors) {
                            if (investor && investor.name) {
                                const slug = investor.slug || investor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                investorsMap.set(slug, {
                                    name: investor.name,
                                    slug: slug
                                });
                                // Store the relationship to create later
                                companyInvestorRelations.push({
                                    companySlug: company.slug,
                                    investorSlug: slug
                                });
                            }
                        }
                    }

                    // Collect founders
                    if (company.founders && Array.isArray(company.founders)) {
                        for (const founder of company.founders) {
                            if (founder && founder.id && founder.name) {
                                foundersMap.set(founder.id, founder);
                                // Store the relationship to create later
                                companyFounderRelations.push({
                                    companySlug: company.slug,
                                    founderId: founder.id
                                });
                            }
                        }
                    }

                    companiesProcessed++;
                } catch (error) {
                    console.error(`❌ Error processing company ${company.slug}:`, error);
                }

                progressBar.update();
            }
        }, { timeout: TRANSACTION_TIMEOUT });
    }

    progressBar.complete();

    // Process unique entities in separate transactions - using createMany for better performance

    // 1. Markets
    console.log(`\n📊 Creating ${marketsMap.size} markets...`);
    const marketsProgressBar = createProgressBar(marketsMap.size, "Markets");
    const markets = Array.from(marketsMap.values());

    if (markets.length > 0) {
        try {
            // Create markets in bulk
            const marketRecords = markets.map(market => ({
                name: market.name
            }));

            await prisma.market.createMany({
                data: marketRecords,
                skipDuplicates: true
            });

            marketsProgressBar.update(markets.length);
        } catch (error) {
            console.error(`❌ Error creating markets:`, error);
            // Fall back to individual creation if bulk fails
            for (const market of markets) {
                try {
                    await prisma.market.upsert({
                        where: { name: market.name },
                        update: {},
                        create: { name: market.name }
                    });
                } catch (err) {
                    console.error(`❌ Error creating market ${market.name}:`, err);
                }
                marketsProgressBar.update();
            }
        }
    }
    marketsProgressBar.complete();

    // 2. Stages
    console.log(`\n📈 Creating ${stagesMap.size} stages...`);
    const stagesProgressBar = createProgressBar(stagesMap.size, "Stages");
    const stages = Array.from(stagesMap.values());

    if (stages.length > 0) {
        try {
            // Create stages in bulk
            const stageRecords = stages.map(stage => ({
                name: stage.name
            }));

            await prisma.stage.createMany({
                data: stageRecords,
                skipDuplicates: true
            });

            stagesProgressBar.update(stages.length);
        } catch (error) {
            console.error(`❌ Error creating stages:`, error);
            // Fall back to individual creation if bulk fails
            for (const stage of stages) {
                try {
                    await prisma.stage.upsert({
                        where: { name: stage.name },
                        update: {},
                        create: { name: stage.name }
                    });
                } catch (err) {
                    console.error(`❌ Error creating stage ${stage.name}:`, err);
                }
                stagesProgressBar.update();
            }
        }
    }
    stagesProgressBar.complete();

    // 3. Offices
    console.log(`\n🏢 Creating ${officesMap.size} offices...`);
    const officesProgressBar = createProgressBar(officesMap.size, "Offices");
    const offices = Array.from(officesMap.values());

    if (offices.length > 0) {
        try {
            // Create offices in bulk
            const officeRecords = offices.map(office => ({
                location: office.location
            }));

            await prisma.office.createMany({
                data: officeRecords,
                skipDuplicates: true
            });

            officesProgressBar.update(offices.length);
        } catch (error) {
            console.error(`❌ Error creating offices:`, error);
            // Fall back to individual creation if bulk fails
            for (const office of offices) {
                try {
                    await prisma.office.upsert({
                        where: { location: office.location },
                        update: {},
                        create: { location: office.location }
                    });
                } catch (err) {
                    console.error(`❌ Error creating office ${office.location}:`, err);
                }
                officesProgressBar.update();
            }
        }
    }
    officesProgressBar.complete();

    // 4. Investors
    console.log(`\n💰 Creating ${investorsMap.size} investors...`);
    const investorsProgressBar = createProgressBar(investorsMap.size, "Investors");
    const investors = Array.from(investorsMap.values());

    if (investors.length > 0) {
        try {
            // Create investors in bulk
            const investorRecords = investors.map(investor => ({
                name: investor.name,
                slug: investor.slug
            }));

            await prisma.investor.createMany({
                data: investorRecords,
                skipDuplicates: true
            });

            investorsProgressBar.update(investors.length);
        } catch (error) {
            console.error(`❌ Error creating investors:`, error);
            // Fall back to individual creation if bulk fails
            for (const investor of investors) {
                try {
                    await prisma.investor.upsert({
                        where: { slug: investor.slug },
                        update: { name: investor.name },
                        create: { name: investor.name, slug: investor.slug }
                    });
                } catch (err) {
                    console.error(`❌ Error creating investor ${investor.name}:`, err);
                }
                investorsProgressBar.update();
            }
        }
    }
    investorsProgressBar.complete();

    // 5. Founders
    console.log(`\n👥 Creating ${foundersMap.size} founders...`);
    const foundersProgressBar = createProgressBar(foundersMap.size, "Founders");
    const founders = Array.from(foundersMap.values());
    const founderChunks = chunkArray(founders, RELATIONSHIP_BATCH_SIZE);

    for (const chunk of founderChunks) {
        try {
            // Create founders one by one due to complex schema
            for (const founder of chunk) {
                await prisma.founder.upsert({
                    where: { id: founder.id },
                    update: {
                        name: founder.name,
                        title: founder.title,
                        bio: founder.bio,
                        twitter: founder.twitter,
                        linkedin: founder.linkedin,
                        website: founder.website
                    },
                    create: {
                        id: founder.id,
                        name: founder.name,
                        title: founder.title,
                        bio: founder.bio,
                        twitter: founder.twitter,
                        linkedin: founder.linkedin,
                        website: founder.website
                    }
                });
                foundersProgressBar.update();
            }
        } catch (error) {
            console.error(`❌ Error creating founder batch:`, error);
        }
    }
    foundersProgressBar.complete();

    // Process relationships in dedicated functions with optimized batch processing
    console.log('\n🔄 Creating company relationships...');

    const marketRelationsProcessed = await processCompanyMarketRelationships(companyMarketRelations, companySlugToIdMap);
    const stageRelationsProcessed = await processCompanyStageRelationships(companyStageRelations, companySlugToIdMap);
    const officeRelationsProcessed = await processCompanyOfficeRelationships(companyOfficeRelations, companySlugToIdMap);
    const investorRelationsProcessed = await processCompanyInvestorRelationships(companyInvestorRelations, companySlugToIdMap);
    const founderRelationsProcessed = await processCompanyFounderRelationships(companyFounderRelations, companySlugToIdMap);

    console.log(`\n✅ Successfully processed relationships: ${marketRelationsProcessed} markets, ${stageRelationsProcessed} stages, ${officeRelationsProcessed} offices, ${founderRelationsProcessed} founders, ${investorRelationsProcessed} investors`);
    console.log(`✅ Successfully processed ${companiesProcessed} companies.`);

    return { companySlugToIdMap, companiesProcessed };
}

/**
 * Process jobs data with better error handling and duplicate detection
 */
async function processJobs(jobs, companySlugToIdMap) {
    console.log(`\n💼 Processing ${jobs.length} jobs...`);

    const progressBar = createProgressBar(jobs.length, "Jobs");
    const chunks = chunkArray(jobs, 1); // Process one job at a time to avoid transaction abort issues

    // Track unique offices for job locations
    const officesMap = new Map();
    // Track job-office relationships
    const jobOfficeRelations = [];

    let jobsProcessed = 0;
    let jobsSkipped = 0;
    let jobsErrored = 0;

    // Process jobs one by one to prevent aborted transactions
    for (const job of jobs) {
        // Skip jobs without a title or company slug
        if (!job.title || !job.companySlug) {
            console.error(`⚠️ Skipping job with missing title or company slug: ${JSON.stringify(job).substring(0, 100)}...`);
            progressBar.update();
            jobsSkipped++;
            continue;
        }

        // Skip if company doesn't exist
        const companyId = companySlugToIdMap.get(job.companySlug);
        if (!companyId) {
            console.error(`⚠️ Skipping job with unknown company slug: ${job.companySlug}`);
            progressBar.update();
            jobsSkipped++;
            continue;
        }

        try {
            // Prepare job data
            const jobData = {
                title: job.title,
                applyUrl: job.applyUrl,
                url: job.url,
                companyId: companyId,
                remote: !!job.remote,
                hybrid: !!job.hybrid,
                timeStamp: job.timeStamp ? new Date(job.timeStamp) : null,
                manager: !!job.manager,
                consultant: !!job.consultant,
                contractor: !!job.contractor,
                minYearsExp: job.minYearsExp,
                maxYearsExp: job.maxYearsExp,
                skills: job.skills,
                requiredSkills: job.requiredSkills,
                preferredSkills: job.preferredSkills,
                departments: Array.isArray(job.departments) ? job.departments : [],
                jobTypes: job.jobTypes,
                jobFunctions: job.jobFunctions,
                jobSeniorities: job.jobSeniorities,
                regions: job.regions,
                dataSource: DATA_SOURCE,
                dataCompleteness: job.dataCompleteness || 'COMPLETE',
                equityRange: job.equityRange,
                roleSpecificType: job.roleSpecificType
            };

            // Check if this job exists by URL+title or title+companyId
            let existingJob = null;

            if (job.url) {
                // Try finding by URL first if available
                existingJob = await prisma.job.findFirst({
                    where: {
                        url: job.url,
                        companyId: companyId
                    }
                });
            }

            if (!existingJob) {
                // If not found by URL, try title + companyId
                existingJob = await prisma.job.findFirst({
                    where: {
                        title: job.title,
                        companyId: companyId
                    }
                });
            }

            let createdJob;
            // Use individual transactions for each job
            await prisma.$transaction(async (tx) => {
                if (existingJob) {
                    // Update existing job
                    createdJob = await tx.job.update({
                        where: { id: existingJob.id },
                        data: jobData
                    });
                } else {
                    // Create new job
                    createdJob = await tx.job.create({
                        data: jobData
                    });
                }

                // Create salary range if it exists
                if (job.salaryRange) {
                    if (existingJob) {
                        // Update existing salary range or create if not exists
                        const existingSalary = await tx.salaryRange.findUnique({
                            where: { jobId: existingJob.id }
                        });

                        if (existingSalary) {
                            await tx.salaryRange.update({
                                where: { id: existingSalary.id },
                                data: {
                                    minValue: job.salaryRange.minValue,
                                    maxValue: job.salaryRange.maxValue,
                                    currency: job.salaryRange.currency,
                                    period: job.salaryRange.period
                                }
                            });
                        } else {
                            await tx.salaryRange.create({
                                data: {
                                    jobId: createdJob.id,
                                    minValue: job.salaryRange.minValue,
                                    maxValue: job.salaryRange.maxValue,
                                    currency: job.salaryRange.currency,
                                    period: job.salaryRange.period
                                }
                            });
                        }
                    } else {
                        // Create new salary range for new job
                        await tx.salaryRange.create({
                            data: {
                                jobId: createdJob.id,
                                minValue: job.salaryRange.minValue,
                                maxValue: job.salaryRange.maxValue,
                                currency: job.salaryRange.currency,
                                period: job.salaryRange.period
                            }
                        });
                    }
                }
            });

            // Track job's office locations
            if (job.offices && Array.isArray(job.offices)) {
                for (const office of job.offices) {
                    if (office && office.location) {
                        officesMap.set(office.location, office);

                        // Store relationship for later creation
                        jobOfficeRelations.push({
                            jobId: createdJob.id,
                            officeLocation: office.location
                        });
                    }
                }
            }

            jobsProcessed++;
        } catch (error) {
            console.error(`❌ Error processing job ${job.title} for company ${job.companySlug}:`, error);
            jobsErrored++;
        }

        progressBar.update();
    }

    progressBar.complete();
    console.log(`Jobs stats: Processed: ${jobsProcessed}, Skipped: ${jobsSkipped}, Errors: ${jobsErrored}`);

    // Ensure all job offices exist
    console.log(`\n🏢 Creating ${officesMap.size} job offices...`);
    const officesProgressBar = createProgressBar(officesMap.size, "Job Offices");
    const offices = Array.from(officesMap.values());

    if (offices.length > 0) {
        try {
            // Create offices in bulk
            const officeRecords = offices.map(office => ({
                location: office.location
            }));

            await prisma.office.createMany({
                data: officeRecords,
                skipDuplicates: true
            });

            officesProgressBar.update(offices.length);
        } catch (error) {
            console.error(`❌ Error creating job offices:`, error);
            // Fall back to individual creation
            for (const office of offices) {
                try {
                    await prisma.office.upsert({
                        where: { location: office.location },
                        update: {},
                        create: { location: office.location }
                    });
                } catch (err) {
                    console.error(`❌ Error creating office ${office.location}:`, err);
                }
                officesProgressBar.update();
            }
        }
    }
    officesProgressBar.complete();

    // Process job-office relationships with optimized batch approach
    const jobOfficeRelationsProcessed = await processJobOfficeRelationships(jobOfficeRelations);

    console.log(`✅ Successfully processed ${jobsProcessed} jobs with ${jobOfficeRelationsProcessed} office relations.`);
    return { jobsProcessed };
}

/**
 * Update company job counts
 */
async function updateCompanyJobCounts() {
    console.log('\n🔄 Updating company job counts...');

    // Get all companies
    const companies = await prisma.company.findMany({
        select: { id: true }
    });

    const progressBar = createProgressBar(companies.length, "Job Counts");
    let updatedCount = 0;

    // Process in chunks for better performance
    const companyChunks = chunkArray(companies, RELATIONSHIP_BATCH_SIZE);
    for (const chunk of companyChunks) {
        await Promise.all(chunk.map(async (company) => {
            try {
                // Count jobs for this company
                const jobCount = await prisma.job.count({
                    where: { companyId: company.id }
                });

                // Update the company's job count
                await prisma.company.update({
                    where: { id: company.id },
                    data: { numJobs: jobCount }
                });

                updatedCount++;
                progressBar.update();
            } catch (error) {
                console.error(`❌ Error updating job count for company ID ${company.id}:`, error);
                progressBar.update();
            }
        }));
    }

    progressBar.complete();
    console.log(`✅ Updated job counts for ${updatedCount} companies.`);
}

/**
 * Main import function
 */
async function importYcData(options = {}) {
    const {
        companiesFile,
        jobsFile,
        mode = 'upsert' // Changed default from 'insert' to 'upsert'
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

    try {
        console.log(`🚀 Starting YC data import (mode: ${mode})...`);

        let companySlugToIdMap = new Map();

        // Process companies if provided
        if (companiesFile) {
            const companies = readJsonFile(companiesFile);
            const result = await processCompanies(companies);
            companySlugToIdMap = result.companySlugToIdMap;
            stats.companiesProcessed = result.companiesProcessed;
        }

        // Process jobs if provided
        if (jobsFile) {
            const jobs = readJsonFile(jobsFile);
            const result = await processJobs(jobs, companySlugToIdMap);
            stats.jobsProcessed = result.jobsProcessed;
        }

        // Update company job counts
        await updateCompanyJobCounts();

        // Calculate duration and log stats
        stats.endTime = Date.now();
        stats.duration = (stats.endTime - stats.startTime) / 1000;

        console.log('\n✨ Import complete!');
        console.log(`⏱️ Total duration: ${stats.duration.toFixed(2)} seconds`);
        console.log(`📊 Stats: ${stats.companiesProcessed} companies and ${stats.jobsProcessed} jobs processed`);
        console.log(`📈 Performance: ${Math.round((stats.companiesProcessed + stats.jobsProcessed) / (stats.duration / 60))} items per minute`);

        return stats;
    } catch (error) {
        console.error('❌ Import failed:', error);
        stats.errors.push(error.message);
        stats.error = error;
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

/**
 * Command-line interface for the import script
 */
async function runImport() {
    try {
        console.log('🚀 Starting YC data import wizard...');

        // Setup files
        // Update the file paths to use correct relative paths
        const companiesFile = path.resolve(__dirname, '../YCombinatorScraping/output/yc_companies_formatted.json');
        const jobsFile = path.resolve(__dirname, '../YCombinatorScraping/output/yc_jobs_formatted.json');

        console.log(`📂 Expected companies file location: ${companiesFile}`);
        console.log(`📂 Expected jobs file location: ${jobsFile}`);

        // Validate file paths
        const errors = validateFilePaths(companiesFile, jobsFile);
        if (errors.length > 0) {
            console.error('\n❌ File validation failed:');
            errors.forEach(error => console.error(` - ${error}`));
            console.log('\n📋 Make sure to place your files in the following locations:');
            console.log(' - ./output/yc_companies_formatted.json');
            console.log(' - ./output/yc_jobs_formatted.json');
            process.exit(1);
        }

        console.log('\n⏱️ This approach is optimized for performance and should complete in minutes.');

        // Run the import
        const stats = await importYcData({
            companiesFile,
            jobsFile,
            mode: 'upsert' // Changed from 'insert' to 'upsert'
        });

    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

// Run the import if this script is executed directly
if (require.main === module) {
    runImport();
}

module.exports = {
    importYcData
};