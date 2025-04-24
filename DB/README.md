# Database Import Utilities

## 📋 Overview

The `DB` directory contains scripts and utilities for importing scraped job and company data from various sources into the central database. These scripts handle the transformation and loading phases of the ETL (Extract, Transform, Load) process.

## 🔄 How It Works

The import process uses a sophisticated approach to efficiently import large volumes of data:

1. **Data Loading**: Reads JSON files containing company and job data
2. **Transformation**: Maps the raw data to the database schema
3. **Batch Processing**: Uses optimized batch operations to minimize database round-trips
4. **Relationship Management**: Properly establishes all entity relationships
5. **Deduplication**: Ensures no duplicate entries are created

## 📁 Directory Contents

### Core Files

| File | Description |
|------|-------------|
| `import.js` | Main import script for VC portfolio data with interactive CLI |
| `direct-import.js` | Script for importing FAANG jobs from SQLite database |
| `import-yc-data.js` | Script for importing Y Combinator companies and jobs |

## 🛠️ Import Methods

### 1. Standard Import (import.js)

This script imports data from the general scraper (VC portfolio companies). It provides an interactive CLI for selecting import options:

- **Combined files mode**: Imports from single combined files 
- **Distributed files mode**: Allows selecting between different data distributions

```bash
node import.js
```

Key features:
- Interactive file selection
- Progress tracking
- Performance optimization with batch processing
- Automatic relationship management
- Error handling and logging

### 2. Direct FAANG Import (direct-import.js)

This script imports FAANG job data from a SQLite database:

```bash
node direct-import.js
```

Key features:
- Direct SQL-to-SQL transfer 
- Company name and URL pattern matching
- Efficient batch processing
- Detailed logging and error tracking
- Detection of companies from URLs and names

### 3. Y Combinator Import (import-yc-data.js)

Specialized script for importing Y Combinator companies and jobs:

```bash
node import-yc-data.js
```

Key features:
- YC-specific data handling
- Batch processing with progress bars
- Entity relationship management
- Comprehensive progress visualization
- Performance optimizations

## 📊 Database Schema

The import scripts target a database with the following core entities:

- **Company**: Organization information (name, description, domain, etc.)
- **Job**: Job posting details (title, description, requirements, etc.)
- **Market**: Market/industry classification
- **Stage**: Company funding/growth stage
- **Office**: Physical location information
- **Investor**: Investment entity information
- **Relationship Tables**: CompanyMarket, CompanyStage, CompanyOffice, etc.

## 🚀 Usage Examples

### Importing All Data Sources

Use the universal import controller from the root directory:

```bash
node universal-import.js --run-all
```

### Importing a Specific Data Source

```bash
# Import only VC portfolio data
node universal-import.js --main

# Import only FAANG job data
node universal-import.js --faang

# Import only Y Combinator data
node universal-import.js --yc
```

### Clearing the Database

To clear all data from the database before importing:

```bash
node clear-db.js
```

## ⚠️ Performance Considerations

- **Memory Usage**: The import process can be memory-intensive for large datasets
- **Database Connections**: Ensure the database can handle the connection load
- **Batch Sizing**: Adjust batch sizes in the code if needed for your environment
- **Transaction Timeouts**: For very large imports, you may need to adjust transaction timeouts

## 🔍 Troubleshooting

Common issues and solutions:

1. **Connection Errors**: Ensure database credentials and connection strings are correct
2. **Timeout Errors**: Increase transaction timeout values for large imports
3. **Memory Issues**: Reduce batch sizes or run on a machine with more RAM
4. **Missing Data**: Check that input JSON files contain the expected structure
5. **Duplicate Entries**: Use the `clear-db.js` script to start with a clean database

## 📦 Dependencies

- Prisma ORM for database operations
- SQLite3 for FAANG job data source
- UUID for unique ID generation
- Node.js File System (fs) modules