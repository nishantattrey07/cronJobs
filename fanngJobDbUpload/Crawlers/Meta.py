#!/usr/bin/env python3
"""
Dead Simple Meta Jobs Scraper - Just Makes It Work
"""

import csv
import json
import os
import random
import sys
import time
from datetime import datetime

# Try to import required libraries
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException
except ImportError:
    print("Error: Required libraries not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "selenium", "webdriver-manager"])
    
    # Import again after installation
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException

# Try to import webdriver_manager (for ChromeDriverManager)
try:
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("Installing webdriver-manager...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "webdriver-manager"])
    from webdriver_manager.chrome import ChromeDriverManager

def print_with_timestamp(message):
    """Print message with timestamp."""
    current_time = datetime.now().strftime("%H:%M:%S")
    print(f"[{current_time}] {message}")

def setup_driver():
    """Set up and return a Chrome WebDriver."""
    print_with_timestamp("Setting up Chrome driver...")
    
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
    # Randomize user agent to avoid detection
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36'
    ]
    options.add_argument(f'user-agent={random.choice(user_agents)}')
    
    try:
        # Try to use ChromeDriverManager to handle driver installation
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
    except Exception as e:
        print_with_timestamp(f"Error with ChromeDriverManager: {e}")
        print_with_timestamp("Falling back to default Chrome driver...")
        driver = webdriver.Chrome(options=options)
    
    driver.set_page_load_timeout(30)
    return driver

def save_jobs_to_csv(jobs, filename="meta_jobs.csv"):
    """Save jobs to a CSV file."""
    print_with_timestamp(f"Saving {len(jobs)} jobs to {filename}...")
    
    # Create output directory if it doesn't exist
    os_dir = os.path.dirname(filename)
    if os_dir and not os.path.exists(os_dir):
        os.makedirs(os_dir)
    
    # Determine fieldnames from jobs
    fieldnames = set()
    for job in jobs:
        fieldnames.update(job.keys())
    fieldnames = sorted(list(fieldnames))
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(jobs)
    
    print_with_timestamp(f"Jobs saved to {filename}")

def save_jobs_to_json(jobs, filename="meta_jobs.json"):
    """Save jobs to a JSON file."""
    print_with_timestamp(f"Saving {len(jobs)} jobs to {filename}...")
    
    # Create output directory if it doesn't exist
    os_dir = os.path.dirname(filename)
    if os_dir and not os.path.exists(os_dir):
        os.makedirs(os_dir)
    
    with open(filename, 'w', encoding='utf-8') as jsonfile:
        json.dump(jobs, jsonfile, indent=2)
    
    print_with_timestamp(f"Jobs saved to {filename}")

def wait_random(min_seconds=1, max_seconds=3):
    """Wait a random amount of time between min and max seconds."""
    time.sleep(random.uniform(min_seconds, max_seconds))

def scroll_page(driver):
    """Scroll the page to load all content."""
    print_with_timestamp("Scrolling page to load all content...")
    
    # Scroll slowly in steps
    total_height = driver.execute_script("return document.body.scrollHeight")
    viewport_height = driver.execute_script("return window.innerHeight")
    
    for i in range(0, total_height, viewport_height):
        driver.execute_script(f"window.scrollTo(0, {i});")
        wait_random(0.1, 0.3)  # Short wait between scrolls
    
    # Final scroll to bottom
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    wait_random()
    
    # Scroll back to top
    driver.execute_script("window.scrollTo(0, 0);")
    wait_random()

def scrape_meta_jobs():
    """Scrape jobs from Meta Careers and save them."""
    base_url = "https://www.metacareers.com/jobs"
    
    print_with_timestamp("Starting Meta Careers scraper...")
    print_with_timestamp(f"Target URL: {base_url}")
    
    driver = None
    try:
        driver = setup_driver()
        
        # Navigate to the careers page
        print_with_timestamp(f"Navigating to {base_url}")
        driver.get(base_url)
        wait_random(3, 5)  # Wait for page to load
        
        # Create a WebDriverWait instance
        wait = WebDriverWait(driver, 20)
        
        # Handle cookie consent if present
        print_with_timestamp("Checking for cookie consent dialog...")
        try:
            # Try various cookie consent button selectors
            for selector in ["//button[contains(text(), 'Accept')]", 
                            "//button[contains(text(), 'Accept All')]", 
                            "//button[contains(text(), 'Allow')]"]:
                try:
                    cookie_button = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
                    cookie_button.click()
                    print_with_timestamp("Clicked cookie consent button")
                    wait_random()
                    break
                except:
                    continue
        except:
            print_with_timestamp("No cookie consent dialog found or unable to interact with it")
        
        print_with_timestamp("Searching for job listings...")
        
        # Try to save page source for debugging if needed
        with open("meta_page_debug.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print_with_timestamp("Saved page source to meta_page_debug.html for debugging")
        
        # Scroll to load all content
        scroll_page(driver)
        
        # Define multiple selectors to try for job cards
        job_card_selectors = [
            'a[data-testid="job-card"]',
            'div[data-testid="job-listing"]',
            'div.x1i10hfl',
            '.job-card',
            'div[role="article"]',
            'div.job-listing',
            'a.job-link',
            'div.job-result',
            'li[data-testid="job-list-item"]'
        ]
        
        # Try each selector until we find job cards
        job_cards = []
        for selector in job_card_selectors:
            try:
                print_with_timestamp(f"Trying to find job cards with selector: {selector}")
                # Wait a bit for dynamic content
                wait_random(1, 2)
                job_cards = driver.find_elements(By.CSS_SELECTOR, selector)
                
                if job_cards:
                    print_with_timestamp(f"Found {len(job_cards)} job cards with selector: {selector}")
                    break
            except Exception as e:
                print_with_timestamp(f"Error with selector {selector}: {e}")
                continue
        
        if not job_cards:
            print_with_timestamp("Failed to find job cards with any selector")
            print_with_timestamp("Trying a different approach with XPATH...")
            
            # Try with more general XPATH selectors
            xpath_selectors = [
                "//a[contains(@href, '/jobs/')]",
                "//div[contains(@class, 'job')]",
                "//div[contains(@class, 'career')]",
                "//div[contains(@data-testid, 'job')]"
            ]
            
            for xpath in xpath_selectors:
                try:
                    job_cards = driver.find_elements(By.XPATH, xpath)
                    if job_cards:
                        print_with_timestamp(f"Found {len(job_cards)} job cards with XPATH: {xpath}")
                        break
                except Exception as e:
                    print_with_timestamp(f"Error with XPATH {xpath}: {e}")
                    continue
        
        if not job_cards:
            print_with_timestamp("Could not find any job listings with standard methods.")
            print_with_timestamp("Attempting direct page source parsing as last resort...")
            
            # As a last resort, try to extract job links directly from page source
            import re
            from bs4 import BeautifulSoup
            
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            # Find all links that might be job listings
            job_links = []
            for a in soup.find_all('a', href=True):
                if '/jobs/' in a['href'] and not a['href'].endswith('/jobs/'):
                    job_links.append({
                        'url': a['href'] if a['href'].startswith('http') else f"https://www.metacareers.com{a['href']}",
                        'title': a.get_text().strip()
                    })
            
            print_with_timestamp(f"Found {len(job_links)} potential job links from page source")
            
            # Visit each job page to get details
            all_jobs = []
            for i, link in enumerate(job_links[:50]):  # Limit to 50 for safety
                try:
                    print_with_timestamp(f"Processing job link {i+1}/{len(job_links)}: {link['url']}")
                    driver.get(link['url'])
                    wait_random(2, 4)
                    
                    job = {}
                    job['url'] = link['url']
                    job['id'] = link['url'].split('/')[-1] if '/' in link['url'] else "unknown"
                    
                    # Try to get job title
                    for selector in ['h1[data-testid="job-title"]', 'h1.job-title', 'h1', 'h2.job-title', 'h2']:
                        try:
                            title_element = driver.find_element(By.CSS_SELECTOR, selector)
                            job['title'] = title_element.text.strip()
                            break
                        except:
                            continue
                    
                    if 'title' not in job or not job['title']:
                        job['title'] = link['title'] if link['title'] else "Unknown"
                    
                    # Try to get job location
                    for selector in ['div[data-testid="job-location"]', '.job-location', 'div[class*="location"]']:
                        try:
                            location_element = driver.find_element(By.CSS_SELECTOR, selector)
                            job['location'] = location_element.text.strip()
                            break
                        except:
                            continue
                    
                    # Try to get job team
                    for selector in ['div[data-testid="job-team"]', '.job-team', 'div[class*="team"]']:
                        try:
                            team_element = driver.find_element(By.CSS_SELECTOR, selector)
                            job['team'] = team_element.text.strip()
                            break
                        except:
                            continue
                    
                    # Try to get job description
                    for selector in ['div[data-testid="job-description"]', '.job-description', 'div[role="main"]']:
                        try:
                            desc_element = driver.find_element(By.CSS_SELECTOR, selector)
                            job['description'] = desc_element.get_attribute('innerHTML')
                            break
                        except:
                            continue
                    
                    job['date_scraped'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    
                    all_jobs.append(job)
                    
                except Exception as e:
                    print_with_timestamp(f"Error processing job page: {e}")
                    continue
                
            # Save jobs and return
            if all_jobs:
                save_jobs_to_csv(all_jobs)
                save_jobs_to_json(all_jobs)
                print_with_timestamp(f"Successfully scraped {len(all_jobs)} jobs using page source method")
                return all_jobs
            
            print_with_timestamp("Could not find any job listings. Make sure the website structure hasn't changed.")
            return []
        
        # Process job cards normally if we found them
        print_with_timestamp(f"Processing {len(job_cards)} job cards...")
        
        all_jobs = []
        for i, card in enumerate(job_cards):
            try:
                print_with_timestamp(f"Processing job card {i+1}/{len(job_cards)}")
                
                job = {}
                
                # Get job URL
                job_url = card.get_attribute('href')
                if not job_url:
                    # Try to find a link inside the card
                    try:
                        link = card.find_element(By.TAG_NAME, 'a')
                        job_url = link.get_attribute('href')
                    except:
                        print_with_timestamp("Could not find URL, skipping job")
                        continue
                
                if not job_url.startswith('http'):
                    job_url = f"https://www.metacareers.com{job_url}"
                
                job['url'] = job_url
                
                # Extract job ID from URL
                import re
                job_id_match = re.search(r'/jobs/(\d+)/', job_url)
                if job_id_match:
                    job['id'] = job_id_match.group(1)
                else:
                    job['id'] = job_url.split('/')[-1] if '/' in job_url else "unknown"
                
                # Get job title
                title_selectors = [
                    'div[data-testid="job-title"]',
                    'h3', 'h2', 'h4',
                    '.job-title', 
                    'div[class*="title"]'
                ]
                
                job['title'] = "Unknown"
                for selector in title_selectors:
                    try:
                        title_element = card.find_element(By.CSS_SELECTOR, selector)
                        title = title_element.text.strip()
                        if title:
                            job['title'] = title
                            break
                    except:
                        continue
                
                # Get job location
                location_selectors = [
                    'div[data-testid="job-location"]',
                    '.job-location',
                    'div[class*="location"]'
                ]
                
                job['location'] = "Unknown"
                for selector in location_selectors:
                    try:
                        location_element = card.find_element(By.CSS_SELECTOR, selector)
                        location = location_element.text.strip()
                        if location:
                            job['location'] = location
                            break
                    except:
                        continue
                
                # Get job team
                team_selectors = [
                    'div[data-testid="job-team"]',
                    '.job-team',
                    'div[class*="team"]'
                ]
                
                job['team'] = "Unknown"
                for selector in team_selectors:
                    try:
                        team_element = card.find_element(By.CSS_SELECTOR, selector)
                        team = team_element.text.strip()
                        if team:
                            job['team'] = team
                            break
                    except:
                        continue
                
                # Add job to list if we have at least ID and URL
                if job['id'] and job['url']:
                    all_jobs.append(job)
                
            except Exception as e:
                print_with_timestamp(f"Error processing job card: {e}")
                continue
        
        # Now go to each job page to get the description
        print_with_timestamp(f"Getting full details for {len(all_jobs)} jobs...")
        
        for i, job in enumerate(all_jobs):
            try:
                print_with_timestamp(f"Getting details for job {i+1}/{len(all_jobs)}: {job['title']}")
                
                driver.get(job['url'])
                wait_random(2, 4)
                
                # Get job description
                desc_selectors = [
                    'div[data-testid="job-description"]',
                    '.job-description',
                    'div[role="main"]',
                    'div[class*="description"]',
                    'div.job-details'
                ]
                
                for selector in desc_selectors:
                    try:
                        desc_element = driver.find_element(By.CSS_SELECTOR, selector)
                        job['description'] = desc_element.get_attribute('innerHTML')
                        break
                    except:
                        continue
                
                job['date_scraped'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
            except Exception as e:
                print_with_timestamp(f"Error getting job details: {e}")
                job['description'] = "Failed to retrieve description"
                continue
        
        # Save the jobs to files
        save_jobs_to_csv(all_jobs)
        save_jobs_to_json(all_jobs)
        
        print_with_timestamp(f"Successfully scraped {len(all_jobs)} jobs")
        return all_jobs
        
    except Exception as e:
        print_with_timestamp(f"Error in scraper: {e}")
        return []
    finally:
        if driver:
            driver.quit()
            print_with_timestamp("Chrome driver closed")

def main():
    """Main function."""
    try:
        jobs = scrape_meta_jobs()
        print_with_timestamp(f"Total jobs scraped: {len(jobs)}")
        
        if jobs:
            print_with_timestamp("Here are the first few jobs:")
            for i, job in enumerate(jobs[:5]):
                print(f"{i+1}. {job.get('title', 'Unknown')} - {job.get('location', 'Unknown')}")
        
    except Exception as e:
        print_with_timestamp(f"Error in main: {e}")

if __name__ == "__main__":
    main()