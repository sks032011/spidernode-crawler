// backend/api.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// BullBoard imports
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const connectDB = require('./config/db');
const { addUrlToQueue } = require('./queue/producer');
const crawlerQueue = require('./queue/crawlerQueue');
const Page = require('./models/Page');
const redisConnection = require('./config/redis');

// 1. Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// 2. Setup BullBoard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
    queues: [new BullMQAdapter(crawlerQueue)],
    serverAdapter
});
app.use('/admin/queues', serverAdapter.getRouter());

// 3. Create HTTP Server
const server = http.createServer(app);

// 4. Initialize WebSockets
const io = new Server(server, {
    cors: { origin: "*" }
});

// 5. Connect to MongoDB
connectDB();

// 6. HTTP Routes
app.post('/api/crawl', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
        await addUrlToQueue(url, 0);
        res.json({ success: true, message: `Crawl started for ${url}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start crawl' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const jobCounts = await crawlerQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
        const totalSaved = await Page.countDocuments();
        const recentPages = await Page.find().sort({ updatedAt: -1 }).limit(5).select('url title updatedAt');
        res.json({ queue: jobCounts, database: { totalSaved }, recentPages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
// Clears waiting jobs but keeps your database intact
app.post('/api/stop', async (req, res) => {
    try {
        console.log('Draining queue to stop crawler...');
        // .drain() removes all waiting jobs, effectively starving the workers
        await crawlerQueue.drain(); 
        res.json({ success: true, message: 'Crawler stopped.' });
    } catch (error) {
        console.error('Stop failed:', error.message);
        res.status(500).json({ error: 'Failed to stop crawler' });
    }
});
app.post('/api/reset', async (req, res) => {
    try {
        console.log(' INITIATING SYSTEM RESET...');
        await crawlerQueue.obliterate({ force: true });
        await redisConnection.del('visited_urls');
        await Page.deleteMany({});
        console.log('sYSTEM RESET COMPLETE');
        res.json({ success: true, message: 'System wiped clean.' });
    } catch (error) {
        console.error(' Reset failed:', error.message);
        res.status(500).json({ error: 'Failed to reset system' });
    }
});

// 7. WebSocket + Metrics
let metricsInterval = null;

io.on('connection', (socket) => {
    console.log(' Dashboard Connected');

    if (!metricsInterval) {
        metricsInterval = setInterval(async () => {
            try {
                const jobCounts = await crawlerQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
                const totalSaved = await Page.countDocuments();
                const recentPages = await Page.find().sort({ updatedAt: -1 }).limit(5).select('url title updatedAt');
                io.emit('metrics_update', {
                    queue: jobCounts,
                    database: { totalSaved },
                    recentPages
                });
            } catch (error) {
                console.error(' Metrics error:', error.message);
            }
        }, 1000);
    }

    socket.on('disconnect', () => {
        console.log(' Dashboard Disconnected');
        if (io.engine.clientsCount === 0) {
            clearInterval(metricsInterval);
            metricsInterval = null;
        }
    });
});

// 8. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('\n Shutting down gracefully...');
    clearInterval(metricsInterval);
    await crawlerQueue.close();
    process.exit(0);
});
// When yo hitCTRL+C to stop the server:

// SIGINT is the signal your terminal sends when you press CTRL+C
// clearInterval(metricsInterval) stops the WebSocket polling loop
// crawlerQueue.close() tells BullMQ to finish current operations cleanly before closing
// process.exit(0) exits with code 0 (success, not a crash)