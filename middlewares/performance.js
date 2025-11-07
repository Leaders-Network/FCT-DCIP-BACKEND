const compression = require('compression');

/**
 * Performance optimization middleware
 */

// Response compression middleware
const compressionMiddleware = compression({
    // Only compress responses larger than 1kb
    threshold: 1024,
    // Compression level (0-9, 6 is default)
    level: 6,
    // Filter function to determine what to compress
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
});

// Cache control middleware for static resources
const cacheControl = (req, res, next) => {
    // Don't cache API responses by default
    if (req.path.startsWith('/api')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
};

// Add ETag support for conditional requests
const etagSupport = (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
        // Only add ETag for GET requests
        if (req.method === 'GET' && data) {
            const etag = require('crypto')
                .createHash('md5')
                .update(JSON.stringify(data))
                .digest('hex');

            res.set('ETag', etag);

            // Check if client has cached version
            if (req.headers['if-none-match'] === etag) {
                res.status(304).end();
                return;
            }
        }

        originalSend.call(this, data);
    };

    next();
};

// Request timing middleware for monitoring
const requestTiming = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;

        // Log slow requests (> 1 second)
        if (duration > 1000) {
            console.warn(`⚠️ Slow request: ${req.method} ${req.path} took ${duration}ms`);
        }
    });

    next();
};

// Query optimization helper
const optimizeQuery = (query) => {
    // Use lean() for read-only queries to improve performance
    return query.lean();
};

// Pagination helper
const paginationDefaults = {
    page: 1,
    limit: 10,
    maxLimit: 100
};

const getPaginationParams = (req) => {
    const page = Math.max(1, parseInt(req.query.page) || paginationDefaults.page);
    const limit = Math.min(
        paginationDefaults.maxLimit,
        Math.max(1, parseInt(req.query.limit) || paginationDefaults.limit)
    );
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

module.exports = {
    compressionMiddleware,
    cacheControl,
    etagSupport,
    requestTiming,
    optimizeQuery,
    getPaginationParams
};
