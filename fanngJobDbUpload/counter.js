const sqlite3 = require('sqlite3').verbose();

function countJobsByCompany() {
    // Connect to the database
    const db = new sqlite3.Database('./database1.db', (err) => {
        if (err) {
            console.error('Database connection error:', err);
            return;
        }
    });

    // Initialize counter for tech companies
    const techCompanies = {
        microsoft: 0,
        apple: 0,
        meta: 0,
        amazon: 0,
        netflix: 0,
        google: 0,
        unknown: 0
    };

    // Query all companies
    db.all("SELECT company FROM jobs", [], (err, rows) => {
        if (err) {
            console.error('Query error:', err);
            return;
        }

        // Count jobs for each company
        rows.forEach(row => {
            const companyName = row.company ? row.company.toLowerCase() : 'unknown';

            if (companyName.includes('microsoft')) {
                techCompanies.microsoft++;
            } else if (companyName.includes('apple')) {
                techCompanies.apple++;
            } else if (companyName.includes('meta') || companyName.includes('facebook')) {
                techCompanies.meta++;
            } else if (companyName.includes('amazon')) {
                techCompanies.amazon++;
            } else if (companyName.includes('netflix')) {
                techCompanies.netflix++;
            } else if (companyName.includes('google') || companyName.includes('alphabet')) {
                techCompanies.google++;
            } else {
                techCompanies.unknown++;
            }
        });

        // Print results
        console.log('\nJob Count by Company:');
        console.log('-'.repeat(30));

        Object.entries(techCompanies).forEach(([company, count]) => {
            console.log(`${company.charAt(0).toUpperCase() + company.slice(1)}: ${count} jobs`);
        });

        // Calculate and print total
        const totalJobs = Object.values(techCompanies).reduce((a, b) => a + b, 0);
        console.log('-'.repeat(30));
        console.log(`Total Jobs: ${totalJobs}`);

        // Close the database connection
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
        });
    });
}

// Run the function
countJobsByCompany();
