import time
from datetime import datetime
from typing import List

import undetected_chromedriver as uc  # More stealth than regular ChromeDriver
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from .Crawler import Crawler
from .Job import Job

APPLE_JOBS_URL = "https://jobs.apple.com/en-us/search"

class Apple(Crawler):
    def parse_job_page(self, page=1):
        try:
            # Use undetected-chromedriver instead of regular ChromeDriver
            options = uc.ChromeOptions()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--window-size=1920,1080')
            
            driver = uc.Chrome(options=options)
            driver.set_page_load_timeout(30)  # Set page load timeout
            
            try:
                # Navigate to Apple jobs page
                print(f"Navigating to {APPLE_JOBS_URL}")
                driver.get(APPLE_JOBS_URL)
                
                # Wait for initial page load
                time.sleep(5)  # Give time for JavaScript to execute
                
                # Wait for job listings to load with multiple possible selectors
                selectors = [
                    "div[role='main']",
                    "section[role='region']",
                    "a[href*='/search/']",
                    "h3"  # Job titles are usually in h3 tags
                ]
                
                element_found = False
                for selector in selectors:
                    try:
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        element_found = True
                        print(f"Found elements with selector: {selector}")
                        break
                    except TimeoutException:
                        continue
                
                if not element_found:
                    print("Could not find any job listings with known selectors")
                    return [], False
                
                # Scroll down to load all jobs
                last_height = driver.execute_script("return document.body.scrollHeight")
                while True:
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(2)
                    new_height = driver.execute_script("return document.body.scrollHeight")
                    if new_height == last_height:
                        break
                    last_height = new_height
                
                # Get all job listings
                job_elements = []
                for selector in ["a[href*='/search/']", "div[role='listitem']"]:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        job_elements = elements
                        break
                
                jobs_data = []
                
                for job in job_elements:
                    try:
                        # Try to scroll element into view for better interaction
                        driver.execute_script("arguments[0].scrollIntoView(true);", job)
                        time.sleep(0.5)  # Small delay after scroll
                        
                        # Extract job details with multiple possible selectors
                        title = None
                        for title_selector in ["h3", "h2", ".job-title", "[data-test='job-title']"]:
                            try:
                                title_element = job.find_element(By.CSS_SELECTOR, title_selector)
                                title = title_element.text.strip()
                                if title:
                                    break
                            except:
                                continue
                        
                        if not title:
                            continue
                            
                        job_url = job.get_attribute("href")
                        job_id = job_url.split("/")[-1] if job_url else "N/A"
                        
                        # Get all text elements that might contain details
                        details = job.find_elements(By.CSS_SELECTOR, "p, span, div")
                        text_contents = [elem.text.strip() for elem in details if elem.text.strip()]
                        
                        # Try to intelligently categorize the text contents
                        team = text_contents[0] if len(text_contents) > 0 else "N/A"
                        location = text_contents[1] if len(text_contents) > 1 else "N/A"
                        date = text_contents[2] if len(text_contents) > 2 else "N/A"
                        
                        if title and not title.isspace():
                            jobs_data.append({
                                "title": title,
                                "location": location,
                                "team": team,
                                "date": date,
                                "id": job_id,
                                "url": job_url
                            })
                            print(f"Found job: {title}")
                    except Exception as e:
                        print(f"Error parsing job element: {e}")
                        continue
                
                # Check for next page
                has_next_page = False
                for next_selector in ["[aria-label='Next page']", ".pagination-next", "[data-test='pagination-next']"]:
                    try:
                        next_button = driver.find_element(By.CSS_SELECTOR, next_selector)
                        has_next_page = not ("disabled" in next_button.get_attribute("class").split())
                        break
                    except:
                        continue
                
                return jobs_data, has_next_page
            
            except TimeoutException:
                print(f"Timeout waiting for page to load: {APPLE_JOBS_URL}")
                return [], False
            except Exception as e:
                print(f"Error in parse_job_page: {e}")
                return [], False
            
        except Exception as e:
            print(f"Error creating browser instance: {e}")
            return [], False
        
        finally:
            try:
                driver.quit()
            except:
                pass

    def get_jobs(self) -> List[Job]:
        all_jobs = []
        page = 1
        max_pages = 10  # Limit to 10 pages to avoid infinite loops
        
        while page <= max_pages:
            print(f"Scraping Apple jobs page {page}")
            jobs_data, has_next_page = self.parse_job_page(page)
            
            if not jobs_data:
                print("No jobs found on this page")
                break
            
            for job in jobs_data:
                all_jobs.append(Job(
                    company="apple",
                    title=job["title"],
                    date=job["date"],
                    desc=job["team"],
                    id=job["id"],
                    location=job["location"],
                    url=job["url"]
                ))
            
            if not has_next_page:
                break
                
            page += 1
            time.sleep(5)  # Increased delay between pages
        
        return all_jobs

if __name__ == '__main__':
    apple = Apple()
    jobs = apple.get_jobs()
    print(f"\nTotal jobs found: {len(jobs)}")
    for job in jobs:
        print(f"\nTitle: {job.title}")
        print(f"Location: {job.location}")
        print(f"Team: {job.desc}")
        print(f"URL: {job.url}")
