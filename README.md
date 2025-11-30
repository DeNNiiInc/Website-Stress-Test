# Website Stress Testing Tool - Enhanced Edition

A professional stress testing application that simulates realistic traffic patterns to test production websites with support for 1-5000 concurrent users. Now with **Website Crawler** for realistic user simulation!

## 🚀 Features

### Core Testing
- **Concurrent Users**: Simulate 1-5000 users simultaneously
- **Traffic Patterns**: Steady, Burst, Ramp-Up, and Random patterns
- **🕷️ Website Crawler**: NEW! Randomly navigate through website links like real users
- **Real-Time Monitoring**: Live statistics and interactive charts
- **CORS Proxy**: Bypass browser CORS restrictions with user agent rotation

### Advanced Metrics
- **Percentile Analysis**: P50, P95, and P99 response times
- **Error Categorization**: Track 4xx, 5xx, timeout, and network errors separately
- **Bandwidth Tracking**: Monitor total data sent and received
- **Request History**: Live log of last 100 requests with filtering

### User Experience
- **🌓 Theme Toggle**: Switch between dark and light modes
- **⚡ Test Presets**: Quick-load configurations (Light, Medium, Heavy, Spike)
- **💾 Save Configurations**: Save and reload custom test setups
- **⌨️ Keyboard Shortcuts**: S=Start, P=Pause, X=Stop
- **📱 Mobile Responsive**: Works great on all devices
- **Export Results**: JSON and CSV export functionality

### Premium UI
- Modern dark/light theme with glassmorphism effects
- Real-time charts with Chart.js
- Smooth animations and transitions
- Professional color-coded statistics

## 📋 Prerequisites

- **Node.js** (v14 or higher) - Required for the CORS proxy server
- **Modern Web Browser** (Chrome, Firefox, Edge, Safari)

## 🛠️ Setup Instructions

### Step 1: Install Node.js

If you don't have Node.js installed:

**Windows:**
```powershell
# Using Chocolatey
choco install nodejs

# Or download from: https://nodejs.org/
```

**macOS:**
```bash
# Using Homebrew
brew install node
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install nodejs npm

# Fedora
sudo dnf install nodejs
```

### Step 2: Start the CORS Proxy Server

The proxy server is required to bypass CORS restrictions when testing production websites.

```powershell
# Navigate to the project directory
cd "C:\Users\DM\OneDrive - BCT\BCT-YT - Documents\Project-Files\HomeLoan\HTML\StressTest"

# Start the proxy server
node proxy-server.js
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║         CORS Proxy Server for Stress Testing Tool         ║
╚════════════════════════════════════════════════════════════╝

✅ Server running on: http://localhost:3000
✅ Max connections: 5000
✅ Request timeout: 30000ms
```

**Keep this terminal window open** while using the stress testing tool.

### Step 3: Open the Stress Testing Tool

Open `index.html` in your web browser:

**Option A: Double-click** the `index.html` file

**Option B: Use a local web server** (recommended)
```powershell
# In a NEW terminal window (keep proxy running in the first)
python -m http.server 8080

# Then open: http://localhost:8080
```

## 📖 Usage Guide

### Quick Start with Presets

1. **Select a Preset**: Choose from Light, Medium, Heavy, or Spike test
2. **Enter Target URL**: `https://example.com`
3. **Click "Start Test"**: Watch real-time metrics
4. **Review Results**: Scroll down after test completes

### Basic Test

1. **Enter Target URL**: `https://beyondcloud.solutions/tag/guides/`
2. **Set Concurrent Users**: Use the slider (1-5000)
3. **Set Duration**: Test duration in seconds (10-600)
4. **Select Traffic Pattern**:
   - **Steady**: Constant requests per second
   - **Burst**: Traffic spikes at intervals
   - **Ramp-Up**: Gradual increase in load
   - **Random**: Realistic user behavior
5. **Click "Start Test"**
6. **Monitor Live Statistics**: Watch real-time metrics and charts
7. **Stop or Wait**: Click "Stop" or let it complete
8. **Review Results**: Scroll down to see detailed metrics
9. **Export** (optional): Download results as JSON or CSV

### 🕷️ Crawler Mode (NEW!)

Simulate real users by randomly navigating through website links:

1. **Enable Crawler Mode**: Check the "Enable Crawler Mode" checkbox
2. **Set Crawl Depth**: How many page hops per user (1-5)
3. **Set Links Per Page**: Maximum links to extract (1-50)
4. **Start Test**: Users will randomly click links and navigate the site
5. **Monitor**: Watch the Request History to see different URLs being visited

**How it works:**
- Extracts links from HTML responses
- Randomly selects links from the same domain
- Simulates realistic browsing behavior
- Tracks unique URLs visited

### Advanced Options

Click "Advanced Options" to configure:

- **HTTP Method**: GET, POST, PUT, DELETE, PATCH
- **Custom Headers**: Add authentication, content-type, etc.
  ```json
  {
    "Authorization": "Bearer your-token",
    "Content-Type": "application/json"
  }
  ```
- **Request Body**: For POST/PUT requests
  ```json
  {
    "key": "value"
  }
  ```
- **Think Time**: Delay between requests (0-5000ms)

### Keyboard Shortcuts

- **S**: Start test
- **P**: Pause/Resume test
- **X**: Stop test

### Theme Toggle

Click the **🌓 Theme** button in the header to switch between dark and light modes. Your preference is saved automatically.

### Save & Load Configurations

1. **Configure your test** with desired settings
2. **Click "💾 Save Current Config"**
3. **Enter a name** for your configuration
4. **Reload page** to see it in the presets dropdown
5. **Select saved config** to quickly load those settings

## 📊 Understanding Results

### Key Metrics

- **Total Requests**: Number of HTTP requests sent
- **Success Rate**: Percentage of successful responses (2xx, 3xx)
- **Requests per Second (RPS)**: Average throughput
- **Response Time**: Min, Max, Average, P50, P95, P99
- **Failed Requests**: Number of errors or timeouts
- **Bandwidth**: Total data sent and received

### Percentiles (NEW!)

- **P50 (Median)**: 50% of requests were faster than this
- **P95**: 95% of requests were faster than this (good for SLAs)
- **P99**: 99% of requests were faster than this (catches outliers)

### Error Breakdown (NEW!)

- **4xx Errors**: Client errors (bad request, not found, etc.)
- **5xx Errors**: Server errors (internal server error, etc.)
- **Timeout Errors**: Requests that exceeded timeout limit
- **Network Errors**: Connection failures, DNS errors, etc.

### Charts

- **RPS Chart**: Shows request rate over time
- **Response Time Chart**: Shows latency trends
- **User Load vs Error Rate**: Correlates user count with error percentage

### Request History (NEW!)

- Live table showing last 100 requests
- Color-coded by success/failure
- Shows URL, status code, and response time
- Auto-scrolls with new requests

## 🔧 Configuration

### Changing the Proxy URL

If you deploy the proxy server to a different location, update the proxy URL in `script.js`:

```javascript
this.config = {
  // ... other config
  proxyUrl: 'http://your-server:3000' // Change this
};
```

### Deploying to Production

When hosting on a web server:

1. **Update proxy server** `allowedOrigins` in `proxy-server.js`:
   ```javascript
   const CONFIG = {
     allowedOrigins: 'https://your-domain.com', // Not '*'
   };
   ```

2. **Deploy both files**:
   - Frontend: `index.html`, `styles.css`, `script.js`
   - Backend: `proxy-server.js`, `package.json`

3. **Run proxy server** on your hosting:
   ```bash
   npm start
   # or
   node proxy-server.js
   ```

## 🎯 Testing Your Website

### Example: Testing with Crawler Mode

1. Start proxy server: `node proxy-server.js`
2. Open `index.html` in browser
3. Enter URL: `https://beyondcloud.solutions`
4. Enable Crawler Mode ✅
5. Set crawl depth: 2
6. Set users: 50
7. Set duration: 60 seconds
8. Select pattern: Random
9. Click "Start Test"
10. Watch Request History to see different pages being visited
11. Monitor results

## ⚠️ Important Notes

### Browser Limitations

- This tool runs in the browser, which has connection limits
- For very high loads (1000+ users), consider server-side tools:
  - Apache JMeter
  - k6
  - Artillery
  - Gatling

### CORS Proxy Security

- **Development**: The proxy allows all origins (`*`)
- **Production**: Update `allowedOrigins` to your specific domain
- **Never** expose an open proxy to the internet

### Responsible Testing

- **Only test websites you own** or have permission to test
- **Start with low user counts** to avoid overwhelming servers
- **Monitor your target server** during tests
- **Be aware** that aggressive testing may trigger rate limiting or security measures
- **Crawler mode** generates more requests - use responsibly

## 🐛 Troubleshooting

### "All requests are failing"

**Problem**: CORS proxy not running

**Solution**: Start the proxy server:
```powershell
node proxy-server.js
```

### "Connection refused" errors

**Problem**: Proxy server not accessible

**Solutions**:
1. Check proxy is running on port 3000
2. Verify firewall isn't blocking port 3000
3. Check `proxyUrl` in `script.js` matches your setup

### "Request timeout" errors

**Problem**: Target server is slow or unreachable

**Solutions**:
1. Increase timeout in `proxy-server.js` (line 16)
2. Reduce concurrent users
3. Increase think time
4. Check target URL is accessible

### Crawler not finding links

**Problem**: Website uses JavaScript to render links

**Solutions**:
1. Crawler only works with server-rendered HTML
2. Try disabling crawler mode for JavaScript-heavy sites
3. Consider using headless browser tools for SPA testing

## 📁 File Structure

```
StressTest/
├── index.html          # Main application UI (enhanced)
├── styles.css          # Premium design system (dark/light theme)
├── script.js           # Frontend logic (with crawler)
├── proxy-server.js     # CORS proxy backend (enhanced)
├── package.json        # Node.js configuration
└── README.md           # This file
```

## 🆕 What's New in Enhanced Edition

### Version 2.0 Features

✨ **Website Crawler**: Simulate real user navigation
📊 **Percentile Metrics**: P50, P95, P99 response times
🔍 **Error Categorization**: Detailed error breakdown
📈 **Bandwidth Tracking**: Monitor data usage
📝 **Request History**: Live log of recent requests
⚡ **Test Presets**: Quick-load common scenarios
💾 **Save Configurations**: Persist custom setups
🌓 **Theme Toggle**: Dark and light modes
⌨️ **Keyboard Shortcuts**: Quick controls
🎨 **Enhanced UI**: Improved mobile responsiveness
🔄 **User Agent Rotation**: More realistic traffic simulation

## 🔒 Security Considerations

1. **Proxy Server**: Restrict `allowedOrigins` in production
2. **Rate Limiting**: Consider adding rate limits to the proxy
3. **Authentication**: Add auth if exposing publicly
4. **Monitoring**: Log requests for security auditing
5. **Crawler Mode**: Be mindful of the additional load it generates

## 📝 License

MIT License - Feel free to modify and use as needed.

## 🤝 Support

For issues or questions:
1. Check this README
2. Review the browser console for errors
3. Check proxy server logs
4. Verify target website is accessible

---

**Happy Stress Testing! 🚀**

*Enhanced with Website Crawler & Advanced Metrics*
