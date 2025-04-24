# FAANG Job Scraper & Database Uploader

## 📋 Overview

The `fanngJobDbUpload` directory contains a specialized system for scraping job listings from FAANG (Facebook/Meta, Amazon, Apple, Netflix, Google) and Microsoft company career pages. It includes crawlers for each company, a SQLite database for storage, and utilities to upload the data to the central database.

## 🔄 How It Works

The system operates with the following workflow:

1. **Data Collection**: Python crawlers retrieve job data from company career APIs/websites
2. **Storage**: Jobs are stored in a SQLite database with standardized schema
3. **Processing**: Data is cleaned, normalized, and prepared for import
4. **Upload**: Jobs are uploaded to the central database with company matching

## 📁 Directory Structure

```
fanngJobDbUpload/
├── Crawlers/                  # Job crawlers for each company
│   ├── Amazon.py              # Amazon jobs crawler
│   ├── Apple.py               # Apple jobs crawler
│   ├── Crawler.py             # Base crawler class
│   ├── Google.py              # Google jobs crawler
│   ├── Job.py                 # Job data model
│   ├── Meta.py                # Meta (Facebook) jobs crawler
│   ├── Microsoft.py           # Microsoft jobs crawler
│   ├── Netflix.py             # Netflix jobs crawler
│   ├── Webcrawler.py          # Web-based crawler utility
│   └── __init__.py            # Package initializer
├── DB/                        # Database utilities
│   ├── DBJob.py               # Database job model
│   └── __init__.py            # Package initializer
├── checker.js                 # Database comparison tool
├── counter.js                 # Job count statistics tool
├── main.py                    # Main crawler execution script
└── requirements.txt           # Python dependencies
```

## 🛠️ Crawler Implementation Details

### Base Classes

- **Crawler.py**: Abstract base class defining the crawler interface
- **Job.py**: Data model representing a standardized job listing
- **Webcrawler.py**: Utility for web-based (non-API) crawling

### Company-Specific Crawlers

| File | Description | Method |
|------|-------------|--------|
| **Amazon.py** | Amazon jobs crawler | REST API |
| **Apple.py** | Apple jobs crawler | Selenium-based web scraping |
| **Google.py** | Google jobs crawler | POST API |
| **Meta.py** | Meta (Facebook) jobs crawler | Selenium-based web scraping |
| **Microsoft.py** | Microsoft jobs crawler | REST API |
| **Netflix.py** | Netflix jobs crawler | REST API |

### Database Integration

- **DBJob.py**: SQLAlchemy ORM model for jobs in SQLite
- **DB/__init__.py**: Database connection initialization

## 🚀 Usage

### Running the Crawlers

To run all crawlers and collect job data:

```bash
python main.py
```

This will:
1. Initialize each crawler
2. Extract jobs from company career pages
3. Store jobs in the SQLite database

### Job Statistics

To view job statistics by company:

```bash
node counter.js
```

### Database Comparison

To compare two databases (useful for identifying new/changed jobs):

```bash
node checker.js
```

## ⚙️ Technical Details

### Job Data Model

Each job contains the following information:
- `id`: Unique identifier from the source
- `title`: Job title
- `desc`: Job description
- `company`: Company name
- `location`: Job location
- `date`: Posting date
- `url`: Link to the job posting

### Crawler Strategies

The crawlers use different strategies based on each company's career site:

1. **API-based**: Direct API requests (Amazon, Google, Microsoft, Netflix)
2. **Selenium-based**: Browser automation for interactive sites (Apple, Meta)

### Database Schema

The SQLite database uses a simple schema with a single `jobs` table:
- `id` (primary key)
- `title`
- `desc`
- `date`
- `location`
- `url`
- `company`

## 📦 Dependencies

### Python Dependencies

- requests: HTTP requests
- beautifulsoup4: HTML parsing
- sqlalchemy: Database ORM
- selenium: Browser automation
- undetected-chromedriver: Enhanced Selenium for avoiding detection
- tqdm: Progress bars

### Node.js Dependencies

- sqlite3: SQLite database interface
- fs: File system operations

## ⚠️ Limitations & Considerations

- Some crawlers may fail if company websites change their structure
- Rate limiting may affect crawlers that make many requests
- Selenium-based crawlers require Chrome browser installed
- Some companies may block automated scraping

## 🔧 Configuration

Key configuration can be adjusted in the crawler files:
- Request delays (`REQUEST_DELAY_MS`)
- Batch sizes for pagination (`JOBSPERPAGE`)
- API endpoints (company-specific URLs)
- Browser settings for Selenium-based crawlers

## 🔍 Troubleshooting

Common issues and solutions:

1. **Blocked by Website**: Increase request delays or use a proxy
2. **Chrome Driver Issues**: Update to the latest undetected-chromedriver
3. **Database Errors**: Check SQLite file permissions
4. **API Changes**: Update endpoint URLs in crawler files

## 📊 Performance Metrics

The system is designed to handle thousands of job listings with:
- Memory efficiency through generator patterns
- Batch processing to minimize API requests
- Error handling with retries
- Incremental updates to avoid re-scraping unchanged listings