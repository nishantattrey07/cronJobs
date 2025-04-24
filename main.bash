#!/bin/bash
# Configuration
REPO_DIR="/Users/nishantattrey/Documents/Internship/cronJobs"
LOG_DIR="$REPO_DIR/logs"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$LOG_DIR/job_scraper_$TIMESTAMP.log"
ERROR_LOG="$LOG_DIR/job_scraper_error_$TIMESTAMP.log"
START_TIME=$(date +%s)  # Record start time in seconds since epoch

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Navigate to repository directory
cd "$REPO_DIR" || {
  echo "Failed to navigate to repository directory: $REPO_DIR"
  exit 1
}

# Start execution
log "=== Starting Job Scraper Automated Execution ==="
log "Repository: $REPO_DIR"

# Check for lockfile to prevent concurrent runs
LOCKFILE="$REPO_DIR/.job_scraper.lock"
if [ -e "$LOCKFILE" ]; then
  PID=$(cat "$LOCKFILE")
  if ps -p "$PID" > /dev/null; then
    log "ERROR: Another instance is already running with PID $PID"
    exit 1
  else
    log "WARNING: Found stale lock file. Removing it."
    rm "$LOCKFILE"
  fi
fi

# Create lockfile
echo $$ > "$LOCKFILE"

# Function to clean up
cleanup() {
  log "Cleaning up..."
  rm -f "$LOCKFILE"
  log "=== Job Scraper Execution Completed ==="
}

# Set trap to ensure cleanup on exit
trap cleanup EXIT

# Step 1: Run the scraper
log "Step 1: Running data collection scrapers..."
node index.js --run-all >> "$LOG_FILE" 2>> "$ERROR_LOG"
if [ $? -ne 0 ]; then
  log "ERROR: Scraper execution failed. Check error log for details."
  exit 1
fi
log "Step 1: Data collection completed successfully."

# Step 2: Run the database import
log "Step 2: Running database import..."
node universal-import.js --run-all >> "$LOG_FILE" 2>> "$ERROR_LOG"
if [ $? -ne 0 ]; then
  log "ERROR: Database import failed. Check error log for details."
  exit 1
fi
log "Step 2: Database import completed successfully."

# Step 3: Generate statistics (optional)
# log "Step 3: Generating statistics..."
# Add commands to generate statistics or reports here
# For example: node generate-stats.js >> "$LOG_FILE" 2>> "$ERROR_LOG"

# Calculate total runtime - works on both macOS and Linux
END_TIME=$(date +%s)
TOTAL_RUNTIME=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_RUNTIME / 60))
SECONDS=$((TOTAL_RUNTIME % 60))
log "Total runtime: ${MINUTES} minutes and ${SECONDS} seconds"

log "All tasks completed successfully."