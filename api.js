const express = require('express');
const StreamScraper = require('./stream_scraper');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Input validation middleware
const validateSearchInput = (req, res, next) => {
    const query = req.params.query || req.query.q;
    const page = parseInt(req.query.page) || 1;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Search query is required and must be a non-empty string'
        });
    }

    if (isNaN(page) || page < 1) {
        return res.status(400).json({
            success: false,
            message: 'Page number must be a positive integer'
        });
    }

    next();
};

// Search endpoint with path parameter
app.get('/search/:query', validateSearchInput, async (req, res) => {
    try {
        const query = req.params.query;
        const page = parseInt(req.query.page) || 1;

        const scraper = new StreamScraper();
        const result = await scraper.searchAndGetWatchLinks(query, page);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Search endpoint with query parameter
app.get('/search', validateSearchInput, async (req, res) => {
    try {
        const query = req.query.q;
        const page = parseInt(req.query.page) || 1;

        const scraper = new StreamScraper();
        const result = await scraper.searchAndGetWatchLinks(query, page);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint with instructions
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Stream Scraper API',
        version: '1.0.0',
        endpoints: {
            search: {
                path: '/search/:query',
                example: '/search/peaky+blinders',
                query: '/search?q=peaky+blinders',
                parameters: {
                    page: 'optional (default: 1)'
                }
            },
            health: '/health'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Try these examples:`);
    console.log(`- http://localhost:${port}/search/peaky+blinders`);
    console.log(`- http://localhost:${port}/search?q=peaky+blinders`);
}); 