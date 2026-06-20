const axios = require('axios');
const cheerio = require('cheerio');
const { USER_AGENT } = require('./robots'); // Import unified identity

async function scrapePage(targetUrl) {
    try {
        const baseHost = new URL(targetUrl).host; // Get the domain (e.g., 'wikipedia.org')

        const response = await axios.get(targetUrl, { 
            headers: { 'User-Agent': USER_AGENT }, 
            timeout: 10000 
        });
        const html = response.data;

        const $ = cheerio.load(html);
        const title = $('title').text().trim() || 'No Title';
        const extractedLinks = new Set(); 

        $('a').each((index, element) => {
            const href = $(element).attr('href');
            if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

            try {
                const urlObj = new URL(href, targetUrl);

                // Do not keep links that lead to other websites
                if (urlObj.host !== baseHost) return;

                // CLEANER URL NORMALIZATION: Strip out the # fragments cleanly
                urlObj.hash = '';
urlObj.search = ''; 
const cleanUrl = urlObj.href.replace(/\/$/, ''); // Remove trailing slash
                
                extractedLinks.add(cleanUrl);
            } catch (err) {
                // Ignore badly formatted URLs
            }
        });

        return {
            url: targetUrl,
            title: title,
            linksFound: Array.from(extractedLinks)
        };

    } catch (error) {
        console.error(`Failed to scrape ${targetUrl}: ${error.message}`);
        throw error; 
    }
}

module.exports = { scrapePage };