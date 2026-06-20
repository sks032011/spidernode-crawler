// backend/test-phase2.js
const { addUrlToQueue } = require('./queue/producer');

async function runTest() {
    console.log('Starting Queue Injection Test...\n');

    // 1. Add a new URL (Should succeed)
    await addUrlToQueue('https://quotes.toscrape.com', 0);

    // 2. Add the EXACT SAME URL immediately (Should be blocked by Deduplication)
    await addUrlToQueue('https://quotes.toscrape.com', 0);

    // 3. Add the same URL but with a trailing slash (Should be cleaned and blocked)
    await addUrlToQueue('https://quotes.toscrape.com/', 0);

    // 4. Add a completely different URL 
    await addUrlToQueue('https://en.wikipedia.org', 1);

    console.log('\n Test complete. If you only saw TWO "Queued" messages, your Deduplication is flawless.');
    process.exit(0);
}

// Give Redis 1 second to connect before running the test
setTimeout(runTest, 1000);