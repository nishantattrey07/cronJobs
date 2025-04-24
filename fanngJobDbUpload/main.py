from typing import List
from tqdm import tqdm

from Crawlers.Amazon import Amazon
# from Crawlers.Apple import Apple
from Crawlers.Crawler import Crawler
from Crawlers.Google import Google
from Crawlers.Job import Job
# from Crawlers.Meta import Meta
from Crawlers.Microsoft import Microsoft
from Crawlers.Netflix import Netflix
from DB.DBJob import DBjob

job_pages = {"microsoft": Microsoft(), "amazon": Amazon(), "netflix": Netflix(), "google": Google()}
# job_pages = { "meta": Meta()}
DB = DBjob()

def crawl_jobs():
    print("Crawling Jobs")
    jobs = []
    page: Crawler
    for key, value in tqdm(enumerate(job_pages)):
        print(f"\nLoading {value}")
        jobs.extend(job_pages[value].get_jobs())
    return jobs

def store_jobs(jobs: List[Job]):
    print("Storing Jobs")
    for job in tqdm(jobs):
        DB.store_job(job)

def main():
    # Crawl all jobs
    print("Starting job crawling process...")
    jobs = crawl_jobs()
    print(f"Found {len(jobs)} jobs.")
    
    # Store jobs in the database
    print("Storing jobs in database...")
    store_jobs(jobs)
    print("Job storage complete.")
    
    print(f"All jobs have been crawled and stored in database.db")

if __name__ == "__main__":
    main()