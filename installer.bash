#!/bin/bash
# Job Board Aggregator - Complete Setup Script
# This script installs all required dependencies and sets up the application components

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to install required system packages
install_dependencies() {
    log "Updating package lists..."
    sudo apt-get update

    log "Installing required packages..."
    sudo apt-get install -y curl wget git build-essential

    # Install Node.js and npm if not installed
    if ! command_exists node || ! command_exists npm; then
        log "Installing Node.js and npm..."
        # Using the NodeSource repository for the latest LTS version
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        log "Node.js $(node -v) and npm $(npm -v) installed."
    else
        log "Node.js $(node -v) and npm $(npm -v) already installed."
    fi

    # Install Python and pip if not installed
    if ! command_exists python3; then
        log "Installing Python3..."
        sudo apt-get install -y python3
    else
        log "Python $(python3 --version) already installed."
    fi

    # Install pip if not installed
    if ! command_exists pip; then
        log "Installing pip..."
        sudo apt-get install -y python3-pip
    else
        log "pip $(pip --version) already installed."
    fi

    log "All system dependencies installed successfully."
}

# Install all dependencies
install_dependencies

# Set up the database component
log "Setting up database component..."
cd DB || {
    log "ERROR: DB directory not found"
    exit 1
}

npm install || {
    log "ERROR: Failed to install npm packages for DB"
    exit 1
}

npx prisma generate || {
    log "ERROR: Failed to generate Prisma client"
    exit 1
}

# Set up VC Portfolio Scraper
log "Setting up VC Portfolio Scraper..."
cd ../scraper || {
    log "ERROR: scraper directory not found"
    exit 1
}

npm install || {
    log "ERROR: Failed to install npm packages for scraper"
    exit 1
}

# Set up FAANG Job Scraper with direct pip installation
log "Setting up FAANG Job Scraper..."
cd ../fanngJobDbUpload || {
    log "ERROR: fanngJobDbUpload directory not found"
    exit 1
}

# Install Python requirements directly to system
log "Installing Python requirements..."
python3 -m pip install --break-system-packages -r requirements.txt || {
    log "ERROR: Failed to install Python requirements for FAANG Job Scraper"
    exit 1
}

# Install npm packages for FAANG Job Scraper
log "Installing npm packages for FAANG Job Scraper..."
npm install || {
    log "ERROR: Failed to install npm packages for FAANG Job Scraper"
    exit 1
}

# Set up Y Combinator Scraper
log "Setting up Y Combinator Scraper..."
cd ../YCombinatorScraping || {
    log "ERROR: YCombinatorScraping directory not found"
    exit 1
}

npm install || {
    log "ERROR: Failed to install npm packages for Y Combinator Scraper"
    exit 1
}