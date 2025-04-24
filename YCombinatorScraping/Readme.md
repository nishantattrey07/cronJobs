# Y Combinator Company & Job Scraper

## 📋 Overview

The `YCombinatorScraping` directory contains a specialized scraping system for collecting company and job data from Y Combinator, one of the world's most prominent startup accelerators. This scraper retrieves information about YC-backed companies, their founders, investments, and job opportunities.

## 🔄 How It Works

The scraper operates in a multi-stage pipeline:

1. **Initial Data Collection**: Fetches basic company data from Y Combinator's API
2. **Detail Enrichment**: Scrapes additional company details from individual company pages
3. **Job Collection**: Gathers job postings from company career pages
4. **Data Combination**: Merges all collected data into a unified format
5. **Formatting & Cleaning**: Standardizes and prepares data for database import

## 📁 Directory Structure

```
YCombinatorScraping/
├── output/                    # Output directory for scraped data
├── src/                       # Source code for scraping components
│   ├── combined_data.js       # Data combination utilities
│   ├── companyDetailsScraper.js # Company details scraper
│   ├── extra/                 # Additional utility scripts
│   │   ├── count_jobs.js      # Job counting utility
│   │   ├── extract_companies.js # Company extraction utility
│   │   ├── filter_active_companies.js # Active company filter
│   │   ├── find_empty_founders.js # Utility to find companies with missing founder data
│   │   └── status_based_scraper.js # Company status-based scraper
│   ├── formatter.js           # Data formatting and standardization
│   ├── scrape_jobs.js         # Job scraping component
│   └── scraper.js             # Initial company data scraper
└── index.js                   # Main pipeline execution script
```

## 🛠️ Scraping Pipeline Details

### 1. Initial Company Data Collection (`scraper.js`)

Fetches basic company information from Y Combinator's Algolia-powered API:
- Company names
- Batch information
- Brief descriptions
- Website URLs
- Social media links
- Funding status

Utilizes:
- Algolia API queries with proper authentication
- Batch processing to handle pagination
- Polite request delays to avoid rate limiting

### 2. Company Details Scraping (`companyDetailsScraper.js`)

Enriches company data with details from individual company pages:
- Comprehensive company descriptions
- Founder information
- Team size and location
- Social media and contact information
- Current company status (active/acquired/inactive)

Utilizes:
- Cheerio for HTML parsing
- Concurrent request handling with batch limits
- Retry logic for failed requests

### 3. Job Scraping (`scrape_jobs.js`)

Collects job postings from each company's job page:
- Job titles and descriptions
- Location information
- Application links
- Job requirements and benefits
- Posting dates

Utilizes:
- HTML parsing of job pages
- Status tracking to handle changing company statuses
- Error logging and recovery mechanisms

### 4. Data Combination (`combined_data.js`)

Merges all collected data into a unified structure:
- Combines company core data with detailed information
- Integrates job postings with company data
- Standardizes field names and formats
- Resolves inconsistencies between data sources

### 5. Formatting & Final Processing (`formatter.js`)

Prepares data for database import:
- Converts to database-compatible schema
- Generates UUIDs for entities
- Extracts and normalizes nested data
- Maps fields to database structure
- Separates jobs into independent entities while maintaining relationships

## 🚀 Usage

### Running the Complete Pipeline

To execute the full scraping pipeline:

```bash
node index.js
```

This will run all components in sequence and generate the following output files:
- `output/yc_companies.json`: Raw company data
- `output/company_details/*.json`: Detailed company information 
- `output/jobs_data/*.json`: Job listings by company
- `output/yc_companies_combined.json`: Combined raw data
- `output/all_jobs.json`: All job listings
- `output/yc_companies_formatted.json`: Formatted company data ready for import
- `output/yc_jobs_formatted.json`: Formatted job data ready for import

### Running Individual Components

Each component can also be run independently for debugging or partial updates:

```bash
# Initial company scraping
node src/scraper.js

# Company details scraping
node src/companyDetailsScraper.js

# Job scraping
node src/scrape_jobs.js

# Data combination
node src/combined_data.js

# Formatting
node src/formatter.js
```

## ⚙️ Technical Implementation

### API Interaction

The initial scraper interacts with Y Combinator's Algolia API:

```javascript
const bodyPayload = {
    "requests": [{
        "indexName": "YCCompany_production",
        "params": `facetFilters=%5B%5B%22batch%3A${encodeURIComponent(batchName)}%22%5D%5D&hitsPerPage=${HITS_PER_PAGE}&page=0`
    }]
};

const response = await axios.post(url, bodyPayload, {
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});
```

### HTML Parsing

Company details and job scraping use Cheerio for HTML parsing:

```javascript
const $ = cheerio.load(response.data);
const dataPageElement = $('div[data-page]');
const dataPageJson = JSON.parse(dataPageElement.attr('data-page'));
const companyData = dataPageJson.props.company;
```

### Data Processing

The system performs sophisticated data processing including:

- UUID generation for entities
- JSON schema transformation
- Field normalization and standardization
- Relationship mapping
- Deduplication and conflict resolution

### Error Handling

Robust error handling is implemented throughout:
- Retry logic with exponential backoff
- Error logging to dedicated files
- Skipped company tracking
- Graceful degradation for partial data

## 📊 Data Model

### Company Data Model

```javascript
{
  "id": "uuid",
  "name": "Company Name",
  "description": "Detailed company description",
  "domain": "company.com",
  "emailDomains": ["company.com"],
  "staffCount": 25,
  "numJobs": 5,
  "slug": "company-name",
  "isFeatured": false,
  "isRemoteFriendly": true,
  "logos": { "url": "https://..." },
  "website": { "url": "https://...", "label": "Company Name" },
  "foundedAt": "2020-01-01T00:00:00Z",
  "batchInfo": "W20",
  "status": "Active",
  "dataSource": "YC",
  "founders": [
    {
      "id": "uuid",
      "name": "Founder Name",
      "title": "CEO",
      "bio": "Founder biography",
      "twitter": "https://twitter.com/...",
      "linkedin": "https://linkedin.com/in/..."
    }
  ],
  "markets": [
    { "id": "uuid", "name": "SaaS" }
  ],
  "stage": { "id": "uuid", "name": "Seed" },
  "offices": [
    { "id": "uuid", "location": "San Francisco, CA" }
  ]
}
```

### Job Data Model

```javascript
{
  "id": "uuid",
  "companyId": "uuid",
  "companyName": "Company Name",
  "companySlug": "company-name",
  "title": "Senior Engineer",
  "applyUrl": "https://...",
  "url": "https://...",
  "remote": true,
  "timeStamp": "2023-01-01T00:00:00Z",
  "jobTypes": { "fulltime": true },
  "jobFunctions": { "engineering": true },
  "jobSeniorities": { "SENIOR": true },
  "dataSource": "YC",
  "offices": [
    { "id": "uuid", "location": "San Francisco, CA" }
  ]
}
```

## ⚠️ Limitations & Considerations

- Y Combinator's website structure may change, requiring scraper updates
- Rate limiting may affect large-scale scraping operations
- Some companies may have incomplete data
- Job listings may become outdated
- The scraper should be run with appropriate delays to be respectful to the website

## 🔧 Configuration Options

Key configuration constants in the source files:

```javascript
// API endpoints
const BASE_URL = 'https://www.ycombinator.com/companies';
const ALGOLIA_URL = 'https://45bwzj1sgc-dsn.algolia.net/1/indexes/*/queries';

// Request parameters
const REQUEST_DELAY_MS = 500;  // Delay between requests
const BATCH_SIZE = 50;         // Companies to process concurrently
const MAX_RETRIES = 3;         // Retry attempts for failed requests

// Output paths
const OUTPUT_DIR = 'output';
const COMBINED_FILENAME = 'yc_companies.json';
```

## 🔍 Troubleshooting

Common issues and solutions:

1. **Rate Limiting**: Increase `REQUEST_DELAY_MS` to add more delay between requests
2. **API Changes**: Update the Algolia API parameters or endpoints in `scraper.js`
3. **HTML Structure Changes**: Update the selectors in `companyDetailsScraper.js` or `scrape_jobs.js`
4. **Memory Issues**: Reduce `BATCH_SIZE` to process fewer companies concurrently
5. **Incomplete Data**: Check `error_companies.json` and `skipped_companies.json` for details

## 📦 Dependencies

- **axios**: HTTP requests
- **cheerio**: HTML parsing
- **path**: File path handling
- **fs**: File system operations
- **uuid**: UUID generation

## 🧩 Integration

This scraper integrates with the broader system through:
1. Standardized output files consumed by the database import scripts
2. Consistent data schema aligned with other data sources
3. Common identifiers for entity relationships
4. Source tracking with the "YC" data source identifier