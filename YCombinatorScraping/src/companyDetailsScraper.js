const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Configuration
const INPUT_FILE = path.join('output', 'yc_companies.json');
const OUTPUT_DIR = path.join('output', 'company_details');
const BASE_URL = 'https://www.ycombinator.com/companies';
const REQUEST_DELAY_MS = 500;
const BATCH_SIZE = 50; // Process 5 companies concurrently
const MAX_RETRIES = 3;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function extractAllSocialLinks($, element) {
    const socialLinks = {};

    // Find all links within the element
    element.find('a[href]').each((_, link) => {
        const href = $(link).attr('href');
        if (!href) return;

        // Match against common social media domains
        if (href.includes('linkedin.com')) socialLinks.linkedin = href;
        if (href.includes('twitter.com')) socialLinks.twitter = href;
        if (href.includes('facebook.com')) socialLinks.facebook = href;
        if (href.includes('github.com')) socialLinks.github = href;
        if (href.includes('instagram.com')) socialLinks.instagram = href;
        if (href.includes('youtube.com')) socialLinks.youtube = href;
        if (href.includes('medium.com')) socialLinks.medium = href;
        if (href.includes('crunchbase.com')) socialLinks.crunchbase = href;
        if (href.includes('angel.co')) socialLinks.angellist = href;

        // If it's a website but not a social media link
        const isSocialLink = Object.values(socialLinks).includes(href);
        const isWebsite = href.startsWith('http') || href.startsWith('https');
        if (isWebsite && !isSocialLink && !socialLinks.website) {
            socialLinks.website = href;
        }
    });

    return socialLinks;
}

async function scrapeCompanyDetails(slug, retryCount = 0) {
    try {
        const url = `${BASE_URL}/${slug}`;
        console.log(`Fetching: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            }
        });

        const $ = cheerio.load(response.data);

        // Find the data-page element and parse its JSON content
        const dataPageElement = $('div[data-page]');
        const dataPageJson = JSON.parse(dataPageElement.attr('data-page'));
        const companyData = dataPageJson.props.company;

        // Extract founders with all their social links
        const founders = companyData.founders.map(founder => {
            // Look for founder section containing social links
            const founderSection = $(`div:contains("${founder.full_name}")`).closest('.ycdc-card-new');
            const socialLinks = {};

            // Add provided URLs from the API data
            if (founder.twitter_url) socialLinks.twitter = founder.twitter_url;
            if (founder.linkedin_url) socialLinks.linkedin = founder.linkedin_url;

            // Add any additional social links found in the HTML
            if (founderSection.length) {
                const additionalLinks = extractAllSocialLinks($, founderSection);
                Object.assign(socialLinks, additionalLinks);
            }

            return {
                name: founder.full_name,
                title: founder.title,
                bio: founder.founder_bio,
                social_links: socialLinks
            };
        });

        // Extract company social links
        const companySection = $('.ycdc-card-new').first();
        const companySocialLinks = {};

        // Add provided URLs from the API data
        if (companyData.linkedin_url) companySocialLinks.linkedin = companyData.linkedin_url;
        if (companyData.twitter_url) companySocialLinks.twitter = companyData.twitter_url;
        if (companyData.fb_url) companySocialLinks.facebook = companyData.fb_url;
        if (companyData.github_url) companySocialLinks.github = companyData.github_url;
        if (companyData.website) companySocialLinks.website = companyData.website;

        // Add any additional social links found in the HTML
        if (companySection.length) {
            const additionalLinks = extractAllSocialLinks($, companySection);
            Object.assign(companySocialLinks, additionalLinks);
        }

        // Extract relevant information
        const companyDetails = {
            name: companyData.name,
            slug: companyData.slug,
            batch: companyData.batch_name,
            status: companyData.ycdc_status,
            website: companyData.website,
            teamSize: companyData.team_size,
            location: companyData.location,
            description: companyData.long_description,
            tags: companyData.tags,
            founders: founders,
            jobCount: (companyData.jobPostings || []).length,
            social_links: companySocialLinks,
            metadata: {
                scrapedAt: new Date().toISOString(),
                sourceUrl: url,
                references: {
                    foundersCount: companyData.founders.length,
                    foundersProcessed: founders.length,
                    socialLinksFound: Object.keys(companySocialLinks).length
                }
            }
        };

        // Save to file
        const outputFile = path.join(OUTPUT_DIR, `${slug}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(companyDetails, null, 2));

        return companyDetails;

    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying ${slug} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS * (retryCount + 1)));
            return scrapeCompanyDetails(slug, retryCount + 1);
        }
        console.error(`Error scraping company ${slug}:`, error.message);
        return null;
    }
}

async function processBatch(companies) {
    return Promise.all(
        companies.map(company => scrapeCompanyDetails(company.slug))
    );
}

async function processCompanies() {
    try {
        // Read companies from input file
        const companies = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
        console.log(`Found ${companies.length} companies to process`);

        let successCount = 0;
        let errorCount = 0;

        // Process companies in batches
        for (let i = 0; i < companies.length; i += BATCH_SIZE) {
            const batch = companies.slice(i, i + BATCH_SIZE)
                .filter(company => company.slug);

            const results = await processBatch(batch);

            // Count successes and failures
            results.forEach(result => {
                if (result) {
                    successCount++;
                    console.log(`Successfully processed ${result.slug} (${successCount}/${companies.length})`);
                } else {
                    errorCount++;
                }
            });

            // Add delay between batches
            if (i + BATCH_SIZE < companies.length) {
                await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
            }
        }

        console.log('\nScraping completed:');
        console.log(`Successes: ${successCount}`);
        console.log(`Errors: ${errorCount}`);

    } catch (error) {
        console.error('Error reading input file:', error);
    }
}

// Start processing
processCompanies();
