// backend/queue/worker.js
const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const connectDB = require('../config/db');      
const Page = require('../models/Page');         
const { scrapePage } = require('../services/crawler');
const { isAllowedToCrawl } = require('../services/robots');
const { addUrlToQueue } = require('./producer');
const { MAX_DEPTH } = require('../config/constants'); 

// 🔥 THE BRAKES: A simple promise that forces JavaScript to wait
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Connect to MongoDB Atlas before starting the worker
connectDB();

// (Cleaned up the duplicate logs)
console.log('🤖 Worker Node booting up... Waiting for jobs.');

const crawlerWorker = new Worker('CrawlerQueue', async (job) => {
    const { url, depth } = job.data;
    console.log(`\n⚙️  Processing [Depth ${depth}]: ${url}`);

    // 🔥 EVERYTHING is now safely inside one try/catch block
    try {
        // Step 1: Check robots.txt 
        const allowed = await isAllowedToCrawl(url);
        if (!allowed) {
            console.log(`🚫 Blocked by robots.txt: ${url}`);
            return { url, title: 'Blocked', linksFound: [] };
        }

        // Step 2: The naive polite delay (Good enough for testing)
        await delay(2000); 

        // Step 3: Scrape the page
        const pageData = await scrapePage(url);
        console.log(`✅ Scraped: "${pageData.title}"`);
        console.log(`🔗 Found ${pageData.linksFound.length} links`);

        // Step 4: Queue new links if under depth limit
        if (depth < MAX_DEPTH) {
            for (const link of pageData.linksFound) {
                await addUrlToQueue(link, depth + 1);
            }
        } else {
            console.log(`🛑 Max depth reached. Not going deeper.`);
        }

        return pageData;

    } catch (error) {
        console.error(`💥 Worker failed on ${url}:`, error.message);
        throw error; // Let BullMQ handle the DLQ/Retry logic
    }

}, {
    connection: redisConnection,
    concurrency: 5 // Process 5 URLs simultaneously
});

// 🔥 The Persistence Layer: Upsert to MongoDB Atlas
crawlerWorker.on('completed', async (job, pageData) => {
    try {
        if (pageData && pageData.title !== 'Blocked') {
            
            // Upsert: Insert if new, Update if it already exists
            await Page.findOneAndUpdate(
                { url: pageData.url },           // Find by this URL
                { 
                    title: pageData.title, 
totalLinks: pageData.linksFound?.length ?? 0                },
                { upsert: true, new: true }      // Execute the Upsert
            );
            
            console.log(`💾 Upserted to MongoDB: ${pageData.url}`);
        }
    } catch (error) {
        console.error(`❌ MongoDB Save Error:`, error.message);
    }
});

crawlerWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} permanently failed: ${err.message}`);
});