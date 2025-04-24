const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Path to your JSON data file
const INPUT_FILE_PATH = './output/yc_companies_combined.json';
const OUTPUT_FILE_PATH = './output/yc_companies_formatted.json';
const JOBS_OUTPUT_FILE_PATH = './output/yc_jobs_formatted.json';

// Helper for domain extraction
function extractDomain(url) {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch (e) {
        return null;
    }
}

// Parse relative date string to timestamp
function parseRelativeDate(relativeDate) {
    if (!relativeDate) return new Date();

    const now = new Date();

    if (relativeDate.includes('month')) {
        const months = parseInt(relativeDate.match(/\d+/) || '1');
        return new Date(now.setMonth(now.getMonth() - months));
    } else if (relativeDate.includes('year')) {
        const years = parseInt(relativeDate.match(/\d+/) || '1');
        return new Date(now.setFullYear(now.getFullYear() - years));
    } else if (relativeDate.includes('day')) {
        const days = parseInt(relativeDate.match(/\d+/) || '1');
        return new Date(now.setDate(now.getDate() - days));
    } else if (relativeDate.includes('hour')) {
        const hours = parseInt(relativeDate.match(/\d+/) || '1');
        return new Date(now.setHours(now.getHours() - hours));
    }

    return now;
}

// Parse seniority from job title
function parseSeniority(title) {
    if (!title) return {};

    const seniorityMap = {
        'junior': 'JUNIOR',
        'entry': 'ENTRY',
        'senior': 'SENIOR',
        'lead': 'LEAD',
        'staff': 'SENIOR',
        'principal': 'LEAD',
        'director': 'EXECUTIVE',
        'vp': 'EXECUTIVE',
        'head': 'EXECUTIVE'
    };

    const titleLower = title.toLowerCase();
    const detected = Object.keys(seniorityMap).find(key => titleLower.includes(key));

    const result = {};
    if (detected) {
        result[seniorityMap[detected]] = true;
    } else {
        result.MID = true;
    }

    return result;
}

// Parse years of experience from string
function parseYearsOfExperience(expString) {
    if (!expString) return null;

    const match = expString.match(/(\d+)\+?\s*years?/);
    if (match) {
        return parseInt(match[1]);
    }

    return null;
}

// Parse salary range from string
function parseSalaryRange(rangeString) {
    if (!rangeString || rangeString.trim() === '') {
        return { min: null, max: null, currency: null };
    }

    // Extract currency symbol
    const currencyMatch = rangeString.match(/[$€£¥]/);
    const currency = currencyMatch ? currencyMatch[0] : 'USD';

    // Extract numeric values
    const numbers = rangeString.match(/\d+(\.\d+)?/g);

    if (!numbers || numbers.length === 0) {
        return { min: null, max: null, currency };
    }

    // Convert K/M to actual numbers
    const values = numbers.map(num => {
        let value = parseFloat(num);
        if (rangeString.includes('K') || rangeString.includes('k')) {
            value *= 1000;
        } else if (rangeString.includes('M') || rangeString.includes('m')) {
            value *= 1000000;
        }
        return value;
    });

    return {
        min: values.length > 0 ? values[0] : null,
        max: values.length > 1 ? values[1] : values[0],
        currency
    };
}

// Format company data
function formatCompanyData(companyData) {
    // Generate a stable ID for the company
    const companyId = uuidv4();

    // Format logos as JSON
    const logos = companyData.small_logo_thumb_url
        ? { url: companyData.small_logo_thumb_url }
        : null;

    // Format website as JSON with label
    const website = companyData.website
        ? {
            url: companyData.website,
            label: companyData.name
        }
        : null;

    // Extract email domain
    const domain = extractDomain(companyData.website);

    // Format social links
    const socialLinks = {};
    if (companyData.social_links) {
        if (companyData.social_links.linkedin) socialLinks.linkedin = companyData.social_links.linkedin;
        if (companyData.social_links.twitter) socialLinks.twitter = companyData.social_links.twitter;
        if (companyData.social_links.facebook) socialLinks.facebook = companyData.social_links.facebook;
        if (companyData.social_links.website) socialLinks.website = companyData.social_links.website;
    }

    // Process founders
    const founders = [];
    if (companyData.founders && Array.isArray(companyData.founders)) {
        for (const founderData of companyData.founders) {
            founders.push({
                id: uuidv4(),
                name: founderData.name,
                title: founderData.title || null,
                bio: founderData.bio || null,
                twitter: founderData.social_links?.twitter || null,
                linkedin: founderData.social_links?.linkedin || null,
                website: null // Not provided in sample data
            });
        }
    }

    // Process markets (from industries and tags)
    const markets = [
        ...(companyData.industries || []),
        ...(companyData.tags || [])
    ].filter(Boolean).map(marketName => ({
        id: uuidv4(),
        name: marketName
    }));

    // Process locations
    const offices = [];
    if (companyData.all_locations) {
        const locations = companyData.all_locations.split(',').map(loc => loc.trim());
        for (const location of locations) {
            offices.push({
                id: uuidv4(),
                location: location
            });
        }
    }

    // Process stage
    let stage = null;
    if (companyData.stage) {
        stage = {
            id: uuidv4(),
            name: companyData.stage
        };
    }

    // Process jobs
    const jobs = [];
    if (companyData.jobPostings && Array.isArray(companyData.jobPostings)) {
        for (const jobData of companyData.jobPostings) {
            try {
                // Format the URL with YC prefix
                const formattedUrl = jobData.url
                    ? `https://www.ycombinator.com${jobData.url}`
                    : null;

                // Parse job type
                const jobTypeValue = jobData.type || 'Unknown';
                const jobTypes = {};
                jobTypes[jobTypeValue.toLowerCase().replace(/\s+/g, '')] = true;

                // Parse departments from role
                const departments = jobData.role ? [jobData.role] : [];

                // Parse job functions from roleSpecificType
                const jobFunctions = {};
                if (jobData.roleSpecificType) {
                    jobFunctions[jobData.roleSpecificType.toLowerCase().replace(/\s+/g, '')] = true;
                }

                // Parse job seniority
                const jobSeniorities = parseSeniority(jobData.title);

                // Parse date from relative string
                const timeStamp = parseRelativeDate(jobData.createdAt);

                // Parse salary information
                let salaryRange = null;
                if (jobData.salaryRange && jobData.salaryRange.trim() !== '') {
                    const { min, max, currency } = parseSalaryRange(jobData.salaryRange);
                    if (min !== null || max !== null) {
                        salaryRange = {
                            id: uuidv4(),
                            minValue: min,
                            maxValue: max,
                            currency: currency,
                            period: 'yearly'
                        };
                    }
                }

                // Process job location
                const jobOffices = [];
                if (jobData.location) {
                    jobOffices.push({
                        id: uuidv4(),
                        location: jobData.location
                    });
                }

                // Create the job object with added company reference
                const jobObject = {
                    id: uuidv4(),
                    companyId: companyId,         // Add company ID reference
                    companyName: companyData.name, // Add company name for easy reference
                    companySlug: companyData.slug, // Add company slug for URL building
                    title: jobData.title,
                    applyUrl: jobData.applyUrl || null,
                    url: formattedUrl,
                    remote: jobData.location?.toLowerCase().includes('remote') || false,
                    hybrid: false, // Not explicitly in job data
                    timeStamp: timeStamp,
                    manager: jobData.title?.toLowerCase().includes('manager') || false,
                    consultant: false, // Not in sample data
                    contractor: jobData.type?.toLowerCase().includes('contract') || false,
                    minYearsExp: parseYearsOfExperience(jobData.minExperience),
                    maxYearsExp: null, // Not in sample data
                    skills: jobData.roleSpecificType ? [jobData.roleSpecificType] : null,
                    requiredSkills: null,
                    preferredSkills: null,
                    departments: departments,
                    jobTypes: jobTypes,
                    jobFunctions: jobFunctions,
                    jobSeniorities: jobSeniorities,
                    regions: null,
                    equityRange: jobData.equityRange || null,
                    roleSpecificType: jobData.roleSpecificType || null,
                    dataSource: 'YC',
                    dataCompleteness: 'COMPLETE',
                    offices: jobOffices,
                    salaryRange: salaryRange
                };

                jobs.push(jobObject);
            } catch (error) {
                console.error(`Error formatting job for ${companyData.slug}: ${error.message}`);
            }
        }
    }

    // Create formatted company object
    return {
        id: companyId,
        name: companyData.name,
        description: companyData.long_description || companyData.description || null,
        domain: domain,
        emailDomains: domain ? [domain] : [],
        staffCount: companyData.team_size || companyData.teamSize || null,
        numJobs: jobs.length,
        slug: companyData.slug,
        isFeatured: companyData.top_company || false,
        isRemoteFriendly: (companyData.regions || []).includes("Remote") || false,
        logos: logos,
        website: website,
        parentSlugs: [],
        parents: [],
        oneLiner: companyData.one_liner || null,
        foundedAt: companyData.launched_at ? new Date(companyData.launched_at * 1000).toISOString() : null,
        batchInfo: companyData.batch || null,
        status: companyData.status || null,
        dataSource: 'YC',
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
        founders: founders,
        markets: markets,
        stage: stage,
        offices: offices,
        jobs: jobs  // Keep jobs array for now, we'll handle extraction later
    };
}

// Extract all jobs from formatted companies
function extractJobsFromCompanies(companies) {
    const allJobs = [];
    
    for (const company of companies) {
        if (company.jobs && company.jobs.length > 0) {
            // Add all jobs to the allJobs array
            allJobs.push(...company.jobs);
        }
    }
    
    return allJobs;
}

// Remove jobs from company objects to avoid duplication
function removeJobsFromCompanies(companies) {
    return companies.map(company => {
        // Create a new object without the jobs array
        const { jobs, ...companyWithoutJobs } = company;
        
        // Keep job count for reference
        return {
            ...companyWithoutJobs,
            numJobs: jobs ? jobs.length : 0
        };
    });
}

// Main function to format data
async function formatData() {
    console.log(`Reading data from ${INPUT_FILE_PATH}...`);
    const rawData = fs.readFileSync(INPUT_FILE_PATH, 'utf8');
    const companiesData = JSON.parse(rawData);

    console.log(`Found ${companiesData.length} companies to format`);

    const formattedCompanies = [];
    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const companyData of companiesData) {
        try {
            processed++;
            const formattedCompany = formatCompanyData(companyData);
            formattedCompanies.push(formattedCompany);
            successful++;

            // Log progress every 100 companies
            if (processed % 100 === 0 || processed === companiesData.length) {
                console.log(`Processed ${processed}/${companiesData.length} companies (${Math.round(processed / companiesData.length * 100)}%)`);
            }
        } catch (error) {
            console.error(`Error formatting company ${companyData.slug}: ${error.message}`);
            failed++;
        }
    }

    // Extract all jobs before removing them from companies
    const allJobs = extractJobsFromCompanies(formattedCompanies);
    console.log(`Extracted ${allJobs.length} jobs total from all companies`);
    
    // Remove jobs from companies to avoid duplication
    const companiesWithoutJobs = removeJobsFromCompanies(formattedCompanies);
    
    // Write the formatted companies (without jobs) to file
    console.log(`Writing formatted companies data to ${OUTPUT_FILE_PATH}...`);
    fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(companiesWithoutJobs, null, 2));
    
    // Write all jobs to a separate file
    console.log(`Writing formatted jobs data to ${JOBS_OUTPUT_FILE_PATH}...`);
    fs.writeFileSync(JOBS_OUTPUT_FILE_PATH, JSON.stringify(allJobs, null, 2));

    console.log('\nFormat summary:');
    console.log(`- Total companies processed: ${processed}`);
    console.log(`- Successfully formatted: ${successful}`);
    console.log(`- Failed to format: ${failed}`);
    console.log(`- Total jobs extracted: ${allJobs.length}`);
    console.log('Formatting completed successfully!');
}

// Run the formatter
formatData()
    .then(() => {
        console.log('Data formatting completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error(`Data formatting failed: ${error.message}`);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    });