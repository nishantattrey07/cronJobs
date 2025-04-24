const companies = {
    a16z: {
        name: "Andreessen Horowitz",
        companyApiEndpoint: "https://jobs.a16z.com/api-boards",
        jobsApiEndpoint: "https://jobs.a16z.com/api-boards",
        outputDir: "./output/a16z",
        parentSlug: "andreessen-horowitz",
        dataSource:'a16z',
        maxCompanies: 640
    },
    sequoia: {
        name: "Sequoia Capital",
        companyApiEndpoint: "https://jobs.sequoiacap.com/api-boards",
        jobsApiEndpoint: "https://jobs.sequoiacap.com/api-boards",
        outputDir: "./output/sequoia",
        parentSlug: "sequoia-capital",
        dataSource: 'sequoia',
        maxCompanies: 234
    },
    sequoiaIndia: {
        name: "Sequoia Capital India",
        companyApiEndpoint: "https://consider.com/api-boards",
        jobsApiEndpoint: "https://consider.com/api-boards",
        outputDir: "./output/sequoia_IN",
        parentSlug: "sequoia-capital-india",
        dataSource: 'sequoia_in',
        maxCompanies: 234
    },
    lightspeed: {
        name: "Lightspeed",
        companyApiEndpoint: "https://jobs.lsvp.com/api-boards",
        jobsApiEndpoint: "https://jobs.lsvp.com/api-boards",
        outputDir: "./output/lightspeed",
        parentSlug: "lightspeed",
        dataSource: 'lightspeed',
        maxCompanies: 100
    }
};

module.exports = companies; 