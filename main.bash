#!/bin/bash
# Configuration
REPO_DIR="/home/ubuntu/cron-jobs"
LOG_DIR="$REPO_DIR/logs"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$LOG_DIR/job_scraper_$TIMESTAMP.log"
ERROR_LOG="$LOG_DIR/job_scraper_error_$TIMESTAMP.log"
MEMORY_LOG="$LOG_DIR/memory_usage_$TIMESTAMP.log"
START_TIME=$(date +%s)  # Record start time in seconds since epoch

# Slack webhook configuration
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/"  # Replace with your actual Slack webhook URL
SLACK_CHANNEL="#cron-jobs"  # Replace with your desired channel
SLACK_USERNAME="Job Scraper Bot"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to log memory usage
log_memory() {
  local mem_free=$(free -m | awk 'NR==2{print $4}')
  local mem_used=$(free -m | awk 'NR==2{print $3}')
  local mem_total=$(free -m | awk 'NR==2{print $2}')
  local mem_percent=$((mem_used * 100 / mem_total))
  
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Memory: ${mem_used}MB used (${mem_percent}%), ${mem_free}MB free" | tee -a "$MEMORY_LOG"
}

# Function to send Slack notifications
send_slack_notification() {
  local message="$1"
  local color="$2"  # good (green), warning (yellow), danger (red)
  
  # Default to "good" if no color specified
  [[ -z "$color" ]] && color="good"
  
  # Prepare the payload
  local hostname=$(hostname)
  local payload=$(cat <<EOF
{
  "channel": "${SLACK_CHANNEL}",
  "username": "${SLACK_USERNAME}",
  "attachments": [
    {
      "color": "${color}",
      "title": "Job Scraper Update",
      "text": "${message}",
      "fields": [
        {
          "title": "Host",
          "value": "${hostname}",
          "short": true
        },
        {
          "title": "Time",
          "value": "$(date +'%Y-%m-%d %H:%M:%S')",
          "short": true
        }
      ],
      "footer": "Job Scraper Automation"
    }
  ]
}
EOF
)

  # Send the notification
  curl -s -X POST -H 'Content-type: application/json' --data "${payload}" "${SLACK_WEBHOOK_URL}" > /dev/null

  # Log the notification attempt
  if [ $? -eq 0 ]; then
    log "Slack notification sent: ${message}"
  else
    log "Failed to send Slack notification: ${message}"
  fi
}

# Navigate to repository directory
cd "$REPO_DIR" || {
  error_msg="Failed to navigate to repository directory: $REPO_DIR"
  echo "$error_msg"
  send_slack_notification "$error_msg" "danger"
  exit 1
}

# Start execution
log "=== Starting Job Scraper Automated Execution ==="
log "Repository: $REPO_DIR"
log_memory

# Send start notification to Slack
send_slack_notification "🚀 Job Scraper process started on $(hostname)" "good"

# Check for lockfile to prevent concurrent runs
LOCKFILE="$REPO_DIR/.job_scraper.lock"
if [ -e "$LOCKFILE" ]; then
  PID=$(cat "$LOCKFILE")
  if ps -p "$PID" > /dev/null; then
    error_msg="ERROR: Another instance is already running with PID $PID"
    log "$error_msg"
    send_slack_notification "$error_msg" "warning"
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
  log_memory
  log "=== Job Scraper Execution Completed ==="
}

# Function to handle script failure and send notification
handle_error() {
  local error_msg="$1"
  local exit_code="$2"
  
  log "$error_msg"
  send_slack_notification "❌ $error_msg (Exit code: $exit_code)" "danger"
  exit $exit_code
}

# Set trap to ensure cleanup on exit
trap cleanup EXIT

# Function to clear system caches (requires sudo)
clear_caches() {
  log "Attempting to clear system caches..."
  
  # Drop caches if we have sudo privileges (comment this out if not needed)
  if command -v sudo >/dev/null 2>&1; then
    sudo bash -c "echo 1 > /proc/sys/vm/drop_caches" >/dev/null 2>&1 || log "Cannot drop caches (requires sudo)"
  fi
  
  # Force Node.js garbage collection in next run
  export NODE_OPTIONS="--expose-gc ${NODE_OPTIONS}"
}

# Step 1: Run the scraper
log "Step 1: Running data collection scrapers..."
send_slack_notification "🔍 Step 1: Starting data collection scrapers" "good"
log_memory
node index.js --run-all >> "$LOG_FILE" 2>> "$ERROR_LOG"
SCRAPER_EXIT_CODE=$?

if [ $SCRAPER_EXIT_CODE -ne 0 ]; then
  handle_error "ERROR: Scraper execution failed with exit code $SCRAPER_EXIT_CODE. Check error log for details." $SCRAPER_EXIT_CODE
fi
log "Step 1: Data collection completed successfully."
send_slack_notification "✅ Step 1: Data collection completed successfully" "good"
log_memory

# Clear memory between major steps
log "Cleaning up memory resources before database import..."
clear_caches
sleep 5  # Wait 5 seconds to let the system recover
log_memory

# Step 2: Run the database import using our optimized runner
log "Step 2: Running database import with memory optimization..."
send_slack_notification "💾 Step 2: Starting database import" "good"
log_memory

# If import-runner.js exists, use it. Otherwise, fallback to universal-import.js
if [ -f "$REPO_DIR/import-runner.js" ]; then
  log "Using optimized import runner with memory management"
  node --expose-gc import-runner.js >> "$LOG_FILE" 2>> "$ERROR_LOG"
  IMPORT_EXIT_CODE=$?
else
  log "Using standard import process (memory optimization not available)"
  # Split the import steps for better memory management
  
  log "Step 2.1: Running main data import..."
  send_slack_notification "📥 Step 2.1: Running main data import" "good"
  node --expose-gc universal-import.js --main >> "$LOG_FILE" 2>> "$ERROR_LOG"
  MAIN_IMPORT_EXIT_CODE=$?
  log_memory
  
  if [ $MAIN_IMPORT_EXIT_CODE -eq 0 ]; then
    # Clear memory between import steps
    log "Main import successful. Cleaning up memory resources..."
    send_slack_notification "✅ Step 2.1: Main data import successful" "good"
    clear_caches
    sleep 5
    log_memory
    
    log "Step 2.2: Running FAANG data import..."
    send_slack_notification "📥 Step 2.2: Running FAANG data import" "good"
    node --expose-gc universal-import.js --faang >> "$LOG_FILE" 2>> "$ERROR_LOG"
    FAANG_IMPORT_EXIT_CODE=$?
    log_memory
    
    if [ $FAANG_IMPORT_EXIT_CODE -eq 0 ]; then
      # Clear memory between import steps
      log "FAANG import successful. Cleaning up memory resources..."
      send_slack_notification "✅ Step 2.2: FAANG data import successful" "good"
      clear_caches
      sleep 5
      log_memory
      
      log "Step 2.3: Running YC data import..."
      send_slack_notification "📥 Step 2.3: Running YC data import" "good"
      node --expose-gc universal-import.js --yc >> "$LOG_FILE" 2>> "$ERROR_LOG"
      YC_IMPORT_EXIT_CODE=$?
      log_memory
      
      if [ $YC_IMPORT_EXIT_CODE -ne 0 ]; then
        handle_error "ERROR: YC import failed with exit code $YC_IMPORT_EXIT_CODE. Check error log for details." $YC_IMPORT_EXIT_CODE
      else
        send_slack_notification "✅ Step 2.3: YC data import successful" "good"
      fi
    else
      handle_error "ERROR: FAANG import failed with exit code $FAANG_IMPORT_EXIT_CODE. Check error log for details." $FAANG_IMPORT_EXIT_CODE
    fi
  else
    handle_error "ERROR: Main import failed with exit code $MAIN_IMPORT_EXIT_CODE. Check error log for details." $MAIN_IMPORT_EXIT_CODE
  fi
  
  # Set overall import exit code
  if [ $MAIN_IMPORT_EXIT_CODE -eq 0 ] && [ $FAANG_IMPORT_EXIT_CODE -eq 0 ] && [ $YC_IMPORT_EXIT_CODE -eq 0 ]; then
    IMPORT_EXIT_CODE=0
  else
    IMPORT_EXIT_CODE=1
  fi
fi

if [ -z "$IMPORT_EXIT_CODE" ] || [ $IMPORT_EXIT_CODE -ne 0 ]; then
  handle_error "ERROR: Database import failed with exit code $IMPORT_EXIT_CODE. Check error log for details." ${IMPORT_EXIT_CODE:-1}
fi
log "Step 2: Database import completed successfully."
send_slack_notification "✅ Step 2: Database import completed successfully" "good"
log_memory

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

# Final completion notification
completion_msg="✅ Job Scraper completed successfully! Runtime: ${MINUTES}m ${SECONDS}s"
log "All tasks completed successfully."
send_slack_notification "$completion_msg" "good"
log_memory