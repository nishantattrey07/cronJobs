# Job Board Aggregator System

## 🚀 Overview

This repository contains a comprehensive system for aggregating job postings from multiple sources including:

- Venture Capital (VC) portfolio company job boards (a16z, Sequoia, Lightspeed)
- FAANG (Facebook/Meta, Amazon, Apple, Netflix, Google) career pages
- Y Combinator startup job listings

The system is designed to scrape, process, and consolidate job data into a unified database structure, making it easier to search and analyze tech job opportunities across the ecosystem.

## 📊 System Architecture

The system consists of three main components:

1. **Scrapers** - Collect raw job and company data from various sources
2. **Processors** - Transform and standardize the collected data
3. **Import Utilities** - Load the processed data into a database

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Scrapers  │────▶│  Processors │────▶│   Database  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Components Overview

- **VC Portfolio Scraper (`scraper/`)**: Scrapes job listings from VC portfolio company job boards
- **FAANG Job Scraper (`fanngJobDbUpload/`)**: Collects job postings from major tech companies
- **Y Combinator Scraper (`YCombinatorScraping/`)**: Retrieves startups and jobs from Y Combinator
- **Database Import Scripts (`DB/`)**: Utilities for importing processed data into the database
- **Universal Controllers**: Orchestrate the execution of different components

## 🛠️ Installation

### Prerequisites

- Node.js 14+ 
- Python 3.6+
- PostgreSQL or SQLite (depending on configuration)
- Chrome (for Selenium-based scrapers)

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd [repository-directory]
   ```

2. Install dependencies using the installer script:
   ```bash
   bash installer.bash
   ```

   This script will:
   - Install Node.js dependencies for each component
   - Install Python dependencies for the FAANG scraper
   - Set up the Prisma ORM for database interaction

## 🔄 Workflow

The system operates in three sequential phases:

### 1. Data Collection

Run the scraper controller to collect data from all sources:

```bash
node index.js --run-all
```

This will execute:
- VC Portfolio scraper
- FAANG job scraper
- Y Combinator scraper

Each scraper stores its results in JSON format in its respective output directory.

### 2. Data Import

After data collection, import the processed data into the database:

```bash
node universal-import.js --run-all
```

This executes:
- Main data import (VC portfolio companies)
- FAANG job data import
- Y Combinator data import

### 3. Accessing the Data

Once imported, the data is available in the database with a unified schema featuring:
- Companies with their details and relationships
- Job listings linked to companies
- Related entities (markets, stages, offices, investors)

## 📁 Repository Structure

```
.
├── DB/                        # Database import scripts
├── fanngJobDbUpload/          # FAANG job scrapers
│   ├── Crawlers/              # Individual company crawlers
│   └── DB/                    # Database utilities
├── scraper/                   # VC portfolio scrapers
│   ├── config/                # Configuration files
│   ├── transferToDb/          # Database import utilities
│   └── workers/               # Worker modules for specific tasks
├── YCombinatorScraping/       # Y Combinator scrapers
│   └── src/                   # Source code
├── index.js                   # Universal scraper controller
├── universal-import.js        # Universal database import controller
└── installer.bash             # Dependency installation script
```

## 🔧 Technologies Used

- **Web Scraping**: Axios, Cheerio, Selenium, Puppeteer
- **Data Processing**: Node.js, Python
- **Database**: PostgreSQL with Prisma ORM, SQLite
- **Utilities**: SQLAlchemy (Python), Prisma (Node.js)

## 📋 Component-Specific Documentation

For detailed information about each component, see the README files in their respective directories:

- [DB README](./DB/README.md) - Database import utilities
- [FAANG Job Scraper README](./fanngJobDbUpload/README.md) - FAANG job scraping system
- [VC Portfolio Scraper README](./scraper/README.md) - VC portfolio company scraper
- [Y Combinator Scraper README](./YCombinatorScraping/README.md) - Y Combinator startup scraper

## ⚠️ Limitations & Considerations

- Web scraping is subject to changes in website structure
- Some scrapers may require additional configuration for proxies/VPNs to avoid rate limiting
- Large-scale imports may require database optimization
- Always respect robots.txt and terms of service when scraping websites

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.