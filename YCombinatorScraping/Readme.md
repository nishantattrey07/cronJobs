# Y Combinator Company and Job Data Scraper

This project scrapes company information, job postings, social links and details from Y Combinator's website using a multi-step process.

## Project Structure

```
.
├── Companies/                  # Base company data scraping
│   ├── scraper.js             # Scrapes initial company list from Algolia API
│   └── output/
│       ├── yc_companies.json  # All companies data
│       └── batch_*.json       # Individual batch files
├── JobsByCompanies/           # Job listings scraper
│   ├── scrape_jobs.js         # Scrapes jobs for each company
│   ├── companyDetailsScraper.js  # Scrapes detailed company info
│   ├── combined_data.js       # Combines all data into final output
│   ├── filter_active_companies.js  # Extracts only active companies
│   ├── status_based_scraper.js    # Sorts companies by status
│   ├── find_empty_founders.js     # Identifies companies missing founder info
│   ├── formatter.js           # Transforms data into normalized format
│   ├── extract_companies.js   # Creates random sample of companies
│   ├── count_jobs.js          # Counts total jobs across companies
│   └── output/
│       ├── jobs_data/         # Individual company job files
│       ├── company_details/   # Detailed company info files
│       ├── status_sorted/     # Companies sorted by status
│       ├── all_jobs.json      # Combined job listings
│       ├── yc_companies_combined.json # Merged dataset 
│       ├── yc_companies_formatted.json # Normalized dataset without jobs
│       ├── yc_jobs_formatted.json # Normalized job data with company references
│       ├── yc_companies_200.json # Sample of 200 companies
│       └── active_companies.json # Only active companies
└── README.md
```

## Workflow Overview

The scraping and processing workflow involves these steps:

1. **Base Company List Scraping**

   - Script: `Companies/scraper.js`
   - Purpose: Fetches the complete list of YC companies using Algolia API
   - Output: `yc_companies.json` and individual batch files
   - Usage:

   ```bash
   cd Companies
   node scraper.js
   ```

2. **Company Details & Social Links**

   - Script: `JobsByCompanies/companyDetailsScraper.js`
   - Purpose: Scrapes detailed company info, founders data and social links
   - Output: Individual JSON files in `output/company_details/`
   - Usage:

   ```bash
   cd JobsByCompanies
   node companyDetailsScraper.js
   ```

3. **Job Listings Scraper**

   - Script: `JobsByCompanies/scrape_jobs.js`
   - Purpose: Fetches job listings for each company
   - Output: Individual JSON files in `output/jobs_data/`
   - Usage:

   ```bash
   cd JobsByCompanies
   node scrape_jobs.js
   ```

4. **Data Combination**
   - Script: `JobsByCompanies/combined_data.js`
   - Purpose: Merges company details, jobs and social data
   - Output:
     - `output/yc_companies_combined.json`: Complete company dataset
     - `output/all_jobs.json`: All job listings with company context
   - Usage:
   ```bash
   cd JobsByCompanies
   node combined_data.js
   ```

5. **Data Formatting**
   - Script: `JobsByCompanies/formatter.js`
   - Purpose: Transforms combined data into a normalized, structured format
   - Output: 
     - `yc_companies_formatted.json`: Normalized company data without job arrays
     - `yc_jobs_formatted.json`: All jobs with company references
   - Usage:
   ```bash
   cd JobsByCompanies
   node formatter.js
   ```

6. **Optional Analysis & Filtering** (run any of these after the previous steps)
   - `filter_active_companies.js`: Extracts only active companies
   - `status_based_scraper.js`: Sorts companies by status (active, acquired, inactive)
   - `find_empty_founders.js`: Identifies companies with missing founder information
   - `extract_companies.js`: Creates a random sample of companies (default: 200)
   - `count_jobs.js`: Counts total jobs across all companies

## Output Data Structure

### Company Details (`company_details/*.json`)

```json
{
  "name": "Company Name",
  "slug": "company-slug",
  "batch": "W23",
  "status": "Active",
  "website": "https://...",
  "teamSize": 10,
  "location": "City, Country",
  "description": "...",
  "tags": ["tag1", "tag2"],
  "founders": [
    {
      "name": "Founder Name",
      "title": "Founder & CEO",
      "bio": "...",
      "social_links": {
        "linkedin": "https://...",
        "twitter": "https://..."
      }
    }
  ],
  "social_links": {
    "linkedin": "https://...",
    "twitter": "https://...",
    "website": "https://..."
  },
  "metadata": {
    "scrapedAt": "2025-04-11...",
    "sourceUrl": "https://...",
    "references": {
      "foundersCount": 2,
      "foundersProcessed": 2,
      "socialLinksFound": 3
    }
  }
}
```

### Job Listings (`jobs_data/*.json`)

```json
{
  "jobPostings": [
    {
      "title": "Software Engineer",
      "url": "/companies/example/jobs/123",
      "location": "San Francisco, CA",
      "type": "Full-time",
      "salary": "$120K-180K",
      "equity": "0.5-1.0%",
      "description": "..."
    }
  ],
  "socialLinks": {
    "linkedin": "https://...",
    "twitter": "https://..."
  }
}
```

### Combined Data (`yc_companies_combined.json`)

Merges company details, job listings and social data into a unified dataset.

### Formatted Companies Data (`yc_companies_formatted.json`)

```json
{
  "id": "uuid-value",
  "name": "Company Name",
  "description": "Company description...",
  "domain": "company.com",
  "emailDomains": ["company.com"],
  "staffCount": 25,
  "numJobs": 5,  // Number of jobs, but job data is stored separately
  "slug": "company-name",
  "isFeatured": false,
  "isRemoteFriendly": true,
  "logos": { "url": "https://..." },
  "website": { 
    "url": "https://company.com",
    "label": "Company Name"
  },
  "oneLiner": "One-line description",
  "foundedAt": "2022-01-01T00:00:00.000Z",
  "batchInfo": "W23",
  "status": "Active",
  "dataSource": "YC",
  "socialLinks": {
    "linkedin": "https://...",
    "twitter": "https://..."
  },
  "founders": [
    {
      "id": "uuid-value",
      "name": "Founder Name",
      "title": "CEO",
      "bio": "...",
      "twitter": "https://...",
      "linkedin": "https://..."
    }
  ],
  "markets": [
    {
      "id": "uuid-value",
      "name": "Market Name"
    }
  ],
  "offices": [
    {
      "id": "uuid-value",
      "location": "City, Country"
    }
  ]
  // Jobs are now stored in a separate file
}
```

### Formatted Jobs Data (`yc_jobs_formatted.json`)

```json
[
  {
    "id": "uuid-value",
    "companyId": "uuid-value",     // Reference to parent company
    "companyName": "Company Name", // For easy reference
    "companySlug": "company-name", // For URL building
    "title": "Software Engineer",
    "url": "https://www.ycombinator.com/...",
    "remote": true,
    "timeStamp": "2025-02-01T00:00:00.000Z",
    "skills": ["JavaScript", "React"],
    "departments": ["Engineering"],
    "jobTypes": { "fulltime": true },
    "jobSeniorities": { "SENIOR": true },
    "offices": [
      {
        "id": "uuid-value",
        "location": "Remote"
      }
    ],
    "salaryRange": {
      "id": "uuid-value",
      "minValue": 120000,
      "maxValue": 180000,
      "currency": "$",
      "period": "yearly"
    }
  }
]
```

## Rate Limiting & Ethics

The scripts include:

- Delays between requests (configurable)
- Batch processing to avoid overwhelming servers
- Retry logic for failed requests
- User agent rotation
- Respects robots.txt

## Error Handling

- Failed requests are retried up to 3 times
- Error logs are maintained
- Skipped companies are tracked
- Data validation before saving

## Requirements

- Node.js 14+
- NPM packages:
  - axios
  - cheerio
  - fs-extra
  - uuid (for formatter.js)

## Installation

```bash
git clone <repo>
cd y-combinator-scraper
npm install
```

## Known Limitations

- Some company pages may be access restricted
- Job listing formats can vary
- Social links extraction depends on page structure
- API rate limits may apply

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT