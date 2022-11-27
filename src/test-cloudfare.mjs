import cloudflareScraper from './chrome-engine/index.js';

(async () => {
    try {
        const response = await cloudflareScraper.get('https://www.boulanger.com');
        console.log(response);
    } catch (error) {
        console.log(error);
    }
})();
