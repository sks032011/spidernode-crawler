// backend/services/robots.js
const axios = require('axios');
const robotsParser = require('robots-parser');

const USER_AGENT = 'MyCrawlerBot/1.0';

// THE CACHE: Store parsed rules in RAM so we don't spam target servers.
const robotsCache = new Map();

async function isAllowedToCrawl(targetUrl) {
    try {
        const urlObj = new URL(targetUrl);
        const host = urlObj.host;
        const robotsUrl = `${urlObj.protocol}//${host}/robots.txt`;

        // 1. O(1) Cache Lookup: Have we checked this domain before?
        if (robotsCache.has(host)) {
            const cachedRobots = robotsCache.get(host);
            
            // If we cached 'null', it means the site returned a 404 previously (No rules = allowed)
            if (cachedRobots === null) return true;
            
            return cachedRobots.isAllowed(targetUrl, USER_AGENT);
        }

        // 2. Cache Miss: Fetch the file over the network
        const response = await axios.get(robotsUrl, { 
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000 
        });
        
        // 3. Parse and store it in the cache for all future requests to this domain
        const robots = robotsParser(robotsUrl, response.data);
        robotsCache.set(host, robots); 

        return robots.isAllowed(targetUrl, USER_AGENT);
        
    } catch (error) {
        const host = new URL(targetUrl).host;

        // ONLY allow if the server explicitly says the file does not exist (404)
        if (error.response && error.response.status === 404) {
            // 🔥 CRITICAL FIX: Cache the 404 so we don't keep checking for a file that doesn't exist!
            robotsCache.set(host, null); 
            return true; 
        }
        
        // If the network drops or the server 500s, it's safer to abort.
        console.warn(`⚠️ Network issue fetching robots.txt for ${targetUrl}. Defaulting to block.`);
        return false; 
    }
}

module.exports = { isAllowedToCrawl, USER_AGENT };