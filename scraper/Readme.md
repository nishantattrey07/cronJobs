# Venture Capital Portfolio Company Job Scraper

This project scrapes company and job information from various venture capital firms, processes the data, and prepares it for database import. It collects data from VC firms like Andreessen Horowitz, Sequoia Capital, and Lightspeed.

## Prerequisites

* Node.js (v18.18+)
* NPM (Node Package Manager)
* PostgreSQL database (for data import functionality)

## Dependencies

The project requires the following npm packages:
* `axios` - For making HTTP requests to the job listing APIs
* `chalk` - For colorized terminal output
* `fs`, `path` - Node.js built-in modules for file operations
* `@prisma/client` - ORM for database operations

## Installation

1. **Clone the repository:**
   ```sh
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Install Dependencies:**
   ```sh
   npm install
   ```

3. **Configure Sources:**
   Edit `config/companies.js` to configure the data sources, API endpoints, and other settings.

4. **Set up Database:**
   Configure your PostgreSQL database connection in your Prisma schema file.

## Usage

The application supports different running modes:

### Default Mode (No Flags)

Run all steps except the final distribution step:

```sh
node index.js
```

### Include Distribution

Run the entire workflow from fetching to distribution:

```sh
node index.js -d
```

### Distribution Only

Only run the distribution step (useful when data is already fetched and processed):

```sh
node index.js -od
```

## Process Flow

The application follows a multi-step process:

1. **Fetch Companies** (`fetchCompanies.js`):
   * Fetches company data from VC portfolio sites
   * Uses rotating user agents to avoid rate limiting
   * Creates a JSON file for each source (`./output/<source>/all_companies.json`)

2. **Filter Companies** (`filterCompaniesDetails.js`):
   * Processes raw company data
   * Separates companies with/without job listings
   * Generates statistics for each source
   * Creates multiple output files:
     - `companiesIds.json`: List of all company IDs
     - `companiesFilteredDetails.json`: Company details with job counts
     - `companiesWithJobs.json`: Companies that have job listings
     - `companiesWithoutJobs.json`: Companies without job listings
     - `companyStats.txt`: Human-readable statistics summary

3. **Scrape Jobs** (`jobsFetcher.js`):
   * Processes companies with job listings
   * Fetches detailed job information from each company's jobs API
   * Implements batch processing, retries, and random delays
   * Outputs individual job JSON files to `./output/<source>/company_jobs/`
   * Tracks failed requests in `failed_companies.json`

4. **Combine Companies** (`companies.js`):
   * Combines company data from all sources
   * Adds source tracking via `dataSource` field
   * Detects and handles duplicate companies
   * Creates `./output/all_companies_combined.json`

5. **Combine Jobs** (`allJobs.js`):
   * Combines job listings from all sources
   * Adds source tracking via `dataSource` field
   * Handles duplicate job listings
   * Creates source-specific combined files in `./output/combined_jobs/`
   * Creates unified `./output/all_jobs_combined.json`

6. **Distribute Data** (`distribute.js`) - *Only runs with `-d` or `-od` flags*:
   * Splits combined data into two roughly equal parts
   * Ensures jobs are assigned to the same file as their parent company
   * Creates split files in `./output/split_data/`
   * Generates distribution statistics

7. **Database Import** (`import.js`) - *Separate process after data collection*:
   * Interactive CLI wizard for selecting data files
   * Validates file paths before import
   * Optimized for fast database import (minutes instead of hours)
   * Uses a staging table approach for performance
   * Provides statistics on import operations

## Database Import Process

The database import system uses a sophisticated approach to efficiently load large datasets into a PostgreSQL database:

### Import CLI Tool (`import.js`)

The interactive command-line tool for performing database imports:
* Provides a user-friendly menu system with arrow key navigation
* Allows selection between Combined or Distributed file modes
* Validates file existence before proceeding
* Provides rich feedback and statistics during and after import
* Run with: `node import.js`

### Core Import System Components

The import process is divided into several specialized modules:

1. **Core Import Function** (`transferToDb/src/index.js`):
   * Manages the overall import workflow
   * Supports both insert (new data) and upsert (update existing) modes
   * Uses an optimized staging table approach for performance
   * Returns detailed statistics on the import operation

2. **Staging Tables Management** (`staging-tables.js`):
   * Creates temporary PostgreSQL tables optimized for the JSON data format
   * Includes proper indexing for performance
   * Manages the lifecycle of staging tables (create, clear, drop)
   * Provides safe cleanup operations

3. **Data Loading** (`load-staging.js`):
   * Bulk-loads companies and jobs data into staging tables
   * Uses batch processing and transactions for performance and reliability
   * Handles complex nested JSON structures
   * Includes progress reporting during loading

4. **Data Transformation** (`transform-data.js`):
   * Transforms data from staging tables to the final Prisma schema
   * Preserves relationships between entities
   * Handles reference data (markets, stages, investors, etc.)
   * Manages foreign key constraints correctly

5. **Utilities** (`utils.js`):
   * Provides logging at different verbosity levels
   * Offers helper functions for JSON processing
   * Implements visual progress bars
   * Handles batch processing and error management

### Database Cleanup

A separate script (`clear-db.js`) is provided to clear the database if needed:
* Removes all data while preserving the schema
* Handles table dependencies in the correct order
* Run with: `node clear-db.js`

## Output Directory Structure

```
output/
├── a16z/                         # Andreessen Horowitz data
│   ├── all_companies.json        # Raw company data
│   ├── companiesIds.json         # Just company IDs/slugs
│   ├── companiesFilteredDetails.json  # Companies with job counts
│   ├── companiesWithJobs.json    # Only companies with jobs
│   ├── companiesWithoutJobs.json # Only companies without jobs
│   ├── companyStats.txt          # Text statistics
│   ├── failed_companies.json     # Companies that failed job scraping
│   └── company_jobs/             # Directory of job files
│       ├── company1_jobs.json    # Jobs for a specific company
│       └── ...
├── sequoia/                      # Similar structure for Sequoia
├── sequoia_IN/                   # Similar structure for Sequoia India
├── lightspeed/                   # Similar structure for Lightspeed
├── all_companies_combined.json   # All companies from all sources
├── all_jobs_combined.json        # All jobs from all sources
├── combined_jobs/                # Source-specific combined job files
│   ├── a16z_all_jobs.json        # All jobs from a16z
│   ├── sequoia_all_jobs.json     # All jobs from Sequoia
│   └── ...
└── split_data/                   # Split files for distribution (when using -d or -od)
    ├── companies_A.json          # First half of companies
    ├── companies_B.json          # Second half of companies
    ├── jobs_A.json               # Jobs for companies in A
    ├── jobs_B.json               # Jobs for companies in B
    ├── jobs_without_company.json # Jobs without matching company
    └── split_stats.json          # Statistics about the split
```

## Data Fields

### Company Data

Each company record includes:
- Basic info (name, domain, description)
- Job count
- Email domains
- Funding stage
- Office locations
- Investors
- Remote-friendly status
- `dataSource` field (identifies which VC firm the data came from)

### Job Data

Each job record includes:
- Title and description
- Apply URL
- Company association
- Job type (remote, hybrid, on-site)
- Experience requirements
- Skills (required and preferred)
- Departments and functions
- Salary information (when available)
- `dataSource` field (identifies which VC firm the data came from)

## Database Schema

The Prisma schema includes the following main entities:

1. **Company**:
   - Core company information
   - Relationships to investors, markets, stages, and office locations
   - Job count tracking

2. **Job**:
   - Core job listing details
   - Relationship to company
   - Salary information
   - Location and role details

3. **Reference tables**:
   - Markets
   - Funding Stages
   - Office Locations
   - Investors

4. **Relationship tables**:
   - CompanyInvestor
   - CompanyOffice
   - CompanyStage
   - CompanyMarket
   - JobOffice
   - SalaryRange

## Performance Optimization

The import system is designed for performance:

- **Staging Tables**: Uses a two-step process with staging tables to optimize bulk loading
- **Batch Processing**: Loads data in configurable batches to manage memory usage
- **Transactions**: Uses database transactions to ensure data integrity
- **Indexing**: Creates appropriate indexes to speed up join operations
- **Progress Reporting**: Provides real-time feedback on import progress

For large datasets (10,000+ companies/jobs), typical import times are minutes rather than hours.

## Common Issues

1. **API Rate Limiting**: The script includes delays and user-agent rotation to minimize this, but you may need to adjust these parameters in high-volume scraping.

2. **Failed Company Jobs**: If fetching jobs for some companies fails, they are logged in `failed_companies.json`. These can be retried by running the script again.

3. **Duplicate Companies/Jobs**: The script attempts to identify and handle duplicates based on domain and job title. Check the statistics to see how many duplicates were detected.

4. **Database Connection**: Ensure your PostgreSQL connection settings are correct in the Prisma schema. The default connection URL format is `postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE`.

5. **Node.js Version**: The project requires Node.js v18.18+ due to dependency requirements. Check your version with `node -v`.

## Customizing

### Adding New Data Sources

To add or modify data sources:
1. Edit `config/companies.js` to define new sources
2. Make sure each source has required properties (name, endpoints, parentSlug, dataSource)
3. Update the `folders` array in the worker scripts if necessary

### Modifying Database Schema

If you need to modify the database schema:
1. Update your Prisma schema file
2. Modify the `staging-tables.js` to match your new schema
3. Update the transformation logic in `transform-data.js`
4. Run migrations if needed

## Advanced Usage

### Import Modes

The import system supports two modes:

- **Insert Mode** (`mode: 'insert'`): Only adds new records, skipping existing ones
- **Upsert Mode** (`mode: 'upsert'`): Updates existing records and adds new ones

Example:
```js
const { importData } = require('./transferToDb/src/index');

// For insert-only mode
await importData({
  companiesFile: './output/all_companies_combined.json',
  jobsFile: './output/all_jobs_combined.json',
  mode: 'insert'
});

// For update and insert mode
await importData({
  companiesFile: './output/all_companies_combined.json',
  jobsFile: './output/all_jobs_combined.json',
  mode: 'upsert'
});
```

### Programmatic Usage

You can also use the import functionality programmatically:

```js
const { importData } = require('./transferToDb/src/index');
const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();
  
  try {
    const stats = await importData({
      companiesFile: './path/to/companies.json',
      jobsFile: './path/to/jobs.json',
      mode: 'upsert',
      prismaClient: prisma // Use existing Prisma client
    });
    
    console.log(`Imported ${stats.companiesProcessed} companies and ${stats.jobsProcessed} jobs`);
    console.log(`Duration: ${stats.duration.toFixed(2)} seconds`);
  } finally {
    await prisma.$disconnect();
  }
}

run();
```

## License

