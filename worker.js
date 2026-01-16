// ===================================
// STRESS TESTING TOOL - WEB WORKER
// Handles request loops for a group of users
// ===================================

let config = {};
let state = {
    active: false,
    users: [],
    startTime: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
    bytesSent: 0,
    bytesReceived: 0,
    errorsByCategory: {
        "4xx": 0,
        "5xx": 0,
        "timeout": 0,
        "network": 0
    }
};

// Listen for messages from the main thread
self.onmessage = function (e) {
    const { type, data } = e.data;

    switch (type) {
        case 'INIT':
            config = data.config;
            break;
        case 'START':
            state.active = true;
            state.startTime = Date.now();
            startUsers(data.users);
            break;
        case 'STOP':
            state.active = false;
            break;
    }
};

async function startUsers(userIndices) {
    const pattern = config.trafficPattern;
    const totalDuration = config.duration * 1000;

    for (const index of userIndices) {
        if (!state.active) break;

        const delay = calculateStartDelay(index, userIndices.length, pattern, totalDuration);

        setTimeout(() => {
            if (state.active) {
                runUser(index);
            }
        }, delay);
    }

    // Start reporting results periodically
    const reportInterval = setInterval(() => {
        if (!state.active) {
            clearInterval(reportInterval);
            return;
        }
        reportResults();
    }, 500);
}

function calculateStartDelay(index, count, pattern, duration) {
    switch (pattern) {
        case 'steady':
            return (index % count) * 100;
        case 'burst':
            const burstIndex = Math.floor((index % count) / (count / 5));
            return burstIndex * (duration / 5);
        case 'rampup':
            return (index % count) * (duration / count);
        case 'random':
            return Math.random() * (duration / 2);
        default:
            return 0;
    }
}

async function runUser(id) {
    const endTime = state.startTime + config.duration * 1000;
    let currentUrl = config.targetUrl;
    let crawlDepth = 0;

    while (state.active && Date.now() < endTime) {
        const result = await makeRequest(currentUrl);

        // Report individual request for history log (sampled)
        if (Math.random() < 0.1 || config.userCount < 50) {
            self.postMessage({
                type: 'LOG',
                data: {
                    url: currentUrl,
                    status: result.status,
                    responseTime: result.responseTime,
                    success: result.success,
                    timestamp: new Date().toLocaleTimeString()
                }
            });
        }

        // Logic for crawler (simplified for worker)
        if (config.crawlerEnabled && result.success && result.body && crawlDepth < config.crawlDepth) {
            const nextUrl = extractRandomLink(result.body, currentUrl);
            if (nextUrl) {
                currentUrl = nextUrl;
                crawlDepth++;
            }
        }

        // Think time with jitter
        const jitter = 0.5 + Math.random(); // 50% to 150%
        const sleepTime = config.thinkTime * jitter;
        await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
}

async function makeRequest(targetUrl) {
    const startTime = performance.now();
    let result = {
        success: false,
        status: 0,
        responseTime: 0,
        body: null
    };

    try {
        const payload = {
            targetUrl: targetUrl,
            method: config.httpMethod,
            headers: config.customHeaders,
            body: config.requestBody
        };

        const payloadStr = JSON.stringify(payload);
        state.bytesSent += payloadStr.length;

        const response = await fetch(config.proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadStr
        });

        const proxyResponse = await response.json();
        const endTime = performance.now();

        result.responseTime = proxyResponse.responseTime || (endTime - startTime);
        result.status = proxyResponse.statusCode;
        result.success = proxyResponse.success && result.status >= 200 && result.status < 400;
        result.body = proxyResponse.body;

        if (result.body) {
            state.bytesReceived += result.body.length;
        }

        updateStats(result);

    } catch (error) {
        result.responseTime = performance.now() - startTime;
        state.failedRequests++;
        state.errorsByCategory["network"]++;
    }

    return result;
}

function updateStats(result) {
    state.totalRequests++;
    if (result.success) {
        state.successfulRequests++;
    } else {
        state.failedRequests++;
        const category = categorizeError(result.status);
        state.errorsByCategory[category]++;
    }
    state.responseTimes.push(result.responseTime);

    // Keep response times capped in worker to save memory
    if (state.responseTimes.length > 500) {
        state.responseTimes.shift();
    }
}

function categorizeError(status) {
    if (status >= 400 && status < 500) return "4xx";
    if (status >= 500) return "5xx";
    return "network";
}

function reportResults() {
    self.postMessage({
        type: 'STATS',
        data: {
            totalRequests: state.totalRequests,
            successfulRequests: state.successfulRequests,
            failedRequests: state.failedRequests,
            bytesSent: state.bytesSent,
            bytesReceived: state.bytesReceived,
            errorsByCategory: state.errorsByCategory,
            responseTimes: state.responseTimes // Sampled
        }
    });

    // Clear local counters that are cumulative but reported incrementally if needed
    // Actually, state object above is cumulative. Main thread will track totals.
}

function extractRandomLink(html, baseUrl) {
    try {
        const linkRegex = /href=["'](https?:\/\/[^"']+|(?:\/[^"']+))["']/gi;
        const links = [];
        let match;
        const baseUrlObj = new URL(baseUrl);

        while ((match = linkRegex.exec(html)) !== null) {
            let href = match[1];
            try {
                const absoluteUrl = new URL(href, baseUrl);
                if (absoluteUrl.hostname === baseUrlObj.hostname) {
                    links.push(absoluteUrl.href);
                }
            } catch (e) { }
            if (links.length > 50) break; // Limit extraction
        }

        if (links.length > 0) {
            return links[Math.floor(Math.random() * links.length)];
        }
    } catch (e) { }
    return null;
}
