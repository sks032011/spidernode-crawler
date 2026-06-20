// backend/test.js
const { isAllowedToCrawl } = require('./services/robots');
const { scrapePage } = require('./services/crawler');

async function runTest() {
    // A website specifically built for developers to test scraping on
    const target = 'https://quotes.toscrape.com'; 

    console.log(` Checking if we are allowed to crawl: ${target}...`);
    const allowed = await isAllowedToCrawl(target);

    if (!allowed) {
        console.log('Blocked by robots.txt. Stopping.');
        return;
    }

    console.log('Allowed! Starting scrape...\n');
    
    const data = await scrapePage(target);
    
    console.log(` Page Title: ${data.title}`);
    console.log(` Found ${data.linksFound.length} unique links.`);
    console.log('Here are the first 5 links found:');
    console.log(data.linksFound.slice(0, 5));
}

runTest();