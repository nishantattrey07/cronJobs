# VC Portfolio Company & Job Scraper

## 📋 Overview

The `scraper` directory contains a complete system for scraping and processing job listings and company data from Venture Capital (VC) portfolio companies. This scraper specifically targets job boards from major VC firms including Andreessen Horowitz (a16z), Sequoia Capital, Sequoia Capital India, and Lightspeed Venture Partners.

## 🔄 Architecture & Workflow

The scraper operates using a modular worker-based architecture:

1. **Data Collection**: Fetch companies from VC portfolio APIs
2. **Filtering**: Extract relevant details from company data
3. **Job Scraping**: Retrieve job postings for each portfolio company
4. **Data Consolidation**: Merge and standardize data from different sources
5. **Distribution**: Split data for efficient batch processing
6. **Database Import**: Prepare and import data into the database

```
Raw API → Companies → Filtered Details → Jobs → Consolidated Data → Database
```

## 📁 Directory Structure

```
scraper/
├── config/                    # Configuration files
│   └── companies.js           # VC firms configuration
├── transferToDb/              # Database import utilities
│   ├── src/                   # Source code for database import
│   ├── clear-db.js            # Database cleanup utility
│   └── README.md              # Documentation for import process
├── workers/                   # Worker modules for specific tasks
│   ├── allJobs.js             # Job data consolidation
│   ├── companies.js           # Company data consolidation
│   ├── distribute.js          # Data distribution for batch processing
│   ├── fetchCompanies.js      # Company data fetching
│   ├── filterCompaniesDetails.js # Company data filtering
│   └── jobsFetcher.js         # Job data fetching
└── index.js                   # Main execution script
```

## 🛠️ Key Components

### Configuration (config/)

Contains settings for each VC firm:
- API endpoints
- Output directories
- Maximum companies to fetch
- Data source identifiers
- Parent company information

### Workers (workers/)

| File | Description |
|------|-------------|
| `fetchCompanies.js` | Retrieves company data from VC portfolio APIs |
| `filterCompaniesDetails.js` | Extracts and organizes company information |
| `jobsFetcher.js` | Scrapes job listings for each portfolio company |
| `allJobs.js` | Consolidates job data from all sources |
| `companies.js` | Consolidates company data from all sources |
| `distribute.js` | Splits data into batches for efficient processing |

### Database Import (transferToDb/)

Contains utilities for importing processed data into the database using an optimized staging table approach:
- `src/index.js`: Main import coordination
- `src/staging-tables.js`: Creates temporary staging tables
- `src/load-staging.js`: Loads data into staging tables
- `src/transform-data.js`: Transforms data into final schema
- `src/utils.js`: Utility functions

## 🚀 Usage

### Running the Full Scraper

To run the complete scraping process:

```bash
node index.js
```

This executes all workers in sequence:
1. Fetch companies from VC portfolios
2. Filter company details
3. Scrape jobs for each company
4. Extract and combine company data
5. Extract and combine job data
6. Distribute data for batch processing

### Running Specific Steps

To run distribution without starting over:

```bash
node index.js -od
```

To run the whole script plus distribution:

```bash
node index.js -d
```

## 📊 Data Flow

1. **API Requests** → Raw company data in JSON format
2. **Filtering** → Extracts useful information and statistics
3. **Job Scraping** → Retrieves detailed job postings
4. **Consolidation** → Merges data from different sources
5. **Deduplication** → Removes duplicate entries
6. **Distribution** → Splits data for efficient processing
7. **Import** → Transfers data to the database

## ⚙️ Technical Implementation

### API Interaction

The scraper uses axios to make POST requests to VC firm APIs:

```javascript
const response = await createAxiosInstance().post(`${companyConfig.companyApiEndpoint}/search-companies`, {
    query: { parent: companyConfig.parentSlug, promoteFeatured: true },
    meta: { size: companyConfig.maxCompanies },
    board: { id: companyConfig.parentSlug, isParent: true }
});
```

### Handling Rate Limiting

To avoid rate limiting, the scraper:
- Rotates user agents
- Adds random delays between requests
- Processes companies in batches
- Implements retry logic with exponential backoff

### Data Processing

The data processing workflow includes:
- JSON parsing and validation
- Schema mapping and normalization
- Statistical analysis
- Deduplication using map data structures
- Relationship mapping between entities

### Database Import

The optimized database import process:
1. Creates staging tables that match input data structure
2. Loads data in batches for efficiency
3. Uses SQL for bulk transformations
4. Creates entity relationships in bulk
5. Updates counters and metadata

## 📦 Output Format

The scraper generates multiple output files:

### Company Data
```json
{
  "id": "uuid",
  "name": "Company Name",
  "description": "Company description",
  "domain": "company.com",
  "emailDomains": ["company.com"],
  "staffCount": 120,
  "slug": "company-name",
  "isFeatured": false,
  "isRemoteFriendly": true,
  "markets": [{"id": "uuid", "name": "Market"}],
  "stage": {"id": "uuid", "name": "Series B"},
  "offices": [{"id": "uuid", "location": "San Francisco, CA"}],
  "dataSource": "a16z"
}
```

### Job Data
```json
{
  "id": "uuid",
  "title": "Senior Engineer",
  "companyId": "uuid",
  "companySlug": "company-name",
  "applyUrl": "https://example.com/apply",
  "url": "https://example.com/job",
  "remote": true,
  "timeStamp": "2023-01-01T00:00:00Z",
  "skills": ["JavaScript", "React"],
  "departments": ["Engineering"],
  "jobTypes": {"fulltime": true},
  "jobFunctions": {"engineering": true},
  "jobSeniorities": {"SENIOR": true},
  "dataSource": "a16z"
}
```

## ⚠️ Limitations & Considerations

- API endpoints may change and require updates
- Rate limiting may affect large-scale scraping
- Some data may be incomplete depending on source
- Deduplication logic uses heuristics that may need tuning
- Processing large datasets requires sufficient memory

## 🔧 Configuration Options

Key configuration options in `config/companies.js`:

```javascript
// Example configuration for a16z
{
    name: "Andreessen Horowitz",
    companyApiEndpoint: "https://jobs.a16z.com/api-boards",
    jobsApiEndpoint: "https://jobs.a16z.com/api-boards",
    outputDir: "./output/a16z",
    parentSlug: "andreessen-horowitz",
    dataSource: 'a16z',
    maxCompanies: 640
}
```

## 🔍 Troubleshooting

Common issues and solutions:

1. **API Changes**: Update endpoints in the configuration
2. **Rate Limiting**: Increase delay between requests
3. **Memory Issues**: Reduce batch sizes in the workers
4. **Missing Data**: Check for changes in API response structure
5. **Import Errors**: Verify database schema compatibility