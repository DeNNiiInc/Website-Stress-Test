// ===================================
// CORS PROXY SERVER
// ===================================
// This proxy server allows the stress testing tool to test
// production websites without CORS restrictions.

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;

// Configuration
const CONFIG = {
    // Maximum request timeout (30 seconds)
    timeout: 30000,

    // Allowed origins (restrict to your stress testing tool's domain)
    // Use '*' for development, specific domain for production
    allowedOrigins: '*',

    // Maximum concurrent connections
    maxConnections: 5000,

    // User agents for rotation
    userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
};

// Get random user agent
function getRandomUserAgent() {
    return CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];
}

const { exec } = require('child_process');

// Helper to get git info
const getGitInfo = () => {
    return new Promise((resolve) => {
        exec('git rev-parse --short HEAD && git log -1 --format=%cd --date=relative', (err, stdout) => {
            if (err) {
                console.error('Error fetching git info:', err);
                resolve({ commit: 'Unknown', date: 'Unknown' });
                return;
            }
            const parts = stdout.trim().split('\n');
            resolve({ 
                commit: parts[0] || 'Unknown', 
                date: parts[1] || 'Unknown' 
            });
        });
    });
};

// Create the proxy server
const server = http.createServer((req, res) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        handleCORS(res);
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle Git Info request
    // Nginx proxy_pass might result in double slashes (//git-info)
    if ((req.url === '/git-info' || req.url === '//git-info') && req.method === 'GET') {
        handleCORS(res);
        getGitInfo().then(info => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(info));
        });
        return;
    }

    // Only allow POST requests to the proxy
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
        return;
    }

    // Parse request body
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const proxyRequest = JSON.parse(body);
            handleProxyRequest(proxyRequest, res);
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Invalid JSON',
                message: error.message
            }));
        }
    });
});

// Handle the actual proxy request
function handleProxyRequest(proxyRequest, clientRes) {
    const { targetUrl, method = 'GET', headers = {}, body = null } = proxyRequest;

    // Validate target URL
    if (!targetUrl) {
        clientRes.writeHead(400, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: 'targetUrl is required' }));
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (error) {
        clientRes.writeHead(400, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: 'Invalid URL' }));
        return;
    }

    // Determine if we need http or https
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    // Prepare request options with random user agent
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
            ...headers,
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        },
        timeout: CONFIG.timeout
    };

    const startTime = Date.now();

    // Make the request to the target server
    const proxyReq = protocol.request(options, (proxyRes) => {
        const responseTime = Date.now() - startTime;

        // Collect response data
        let responseData = '';
        let responseSize = 0;
        const maxBodySize = 500000; // 500KB limit for crawler

        proxyRes.on('data', chunk => {
            responseSize += chunk.length;
            // Only collect body if under size limit (for crawler)
            if (responseSize < maxBodySize) {
                responseData += chunk.toString();
            }
        });

        proxyRes.on('end', () => {
            // Send response back to client with CORS headers
            handleCORS(clientRes);
            clientRes.writeHead(200, { 'Content-Type': 'application/json' });

            clientRes.end(JSON.stringify({
                success: true,
                statusCode: proxyRes.statusCode,
                statusMessage: proxyRes.statusMessage,
                responseTime: responseTime,
                headers: proxyRes.headers,
                body: responseData, // Full body for crawler link extraction
                bodySize: responseSize
            }));
        });
    });

    // Handle request errors
    proxyReq.on('error', (error) => {
        const responseTime = Date.now() - startTime;

        handleCORS(clientRes);
        clientRes.writeHead(200, { 'Content-Type': 'application/json' });

        clientRes.end(JSON.stringify({
            success: false,
            error: error.message,
            responseTime: responseTime,
            statusCode: 0
        }));
    });

    // Handle timeout
    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        const responseTime = Date.now() - startTime;

        handleCORS(clientRes);
        clientRes.writeHead(200, { 'Content-Type': 'application/json' });

        clientRes.end(JSON.stringify({
            success: false,
            error: 'Request timeout',
            responseTime: responseTime,
            statusCode: 0
        }));
    });

    // Send request body if present
    if (body && method !== 'GET' && method !== 'HEAD') {
        proxyReq.write(typeof body === 'string' ? body : JSON.stringify(body));
    }

    proxyReq.end();
}

// Add CORS headers to response
function handleCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', CONFIG.allowedOrigins);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Start the server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         CORS Proxy Server for Stress Testing Tool         ║
╚════════════════════════════════════════════════════════════╝

✅ Server running on: http://localhost:${PORT}
✅ Max connections: ${CONFIG.maxConnections}
✅ Request timeout: ${CONFIG.timeout}ms

📝 Usage:
   POST to http://localhost:${PORT} with JSON body:
   {
     "targetUrl": "https://example.com",
     "method": "GET",
     "headers": {},
     "body": null
   }

🔒 Security Note:
   For production, update CONFIG.allowedOrigins to your
   stress testing tool's domain (not '*')

Press Ctrl+C to stop the server
  `);
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down proxy server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
