// ===================================
// UTILITY FUNCTIONS
// ===================================
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function categorizeError(statusCode, errorMessage) {
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500) return "5xx";
  if (errorMessage && errorMessage.includes("timeout")) return "timeout";
  return "network";
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ===================================
// MAIN STRESS TESTING TOOL CLASS
// ===================================
class StressTestingTool {
  constructor() {
    this.config = {
      targetUrl: "",
      userCount: 100,
      duration: 60,
      trafficPattern: "steady",
      httpMethod: "GET",
      customHeaders: {},
      requestBody: null,
      thinkTime: 1000,
      proxyUrl:
        window.location.protocol === "file:" ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
          ? "http://localhost:3000"
          : "/proxy",

      // Crawler settings
      crawlerEnabled: false,
      crawlDepth: 2,
      linksPerPage: 10,
      stayOnDomain: true,
    };

    this.state = {
      status: "idle",
      startTime: null,
      pauseTime: null,
      elapsedTime: 0,
      activeUsers: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      requestsPerSecond: [],
      workers: [], // Web Worker instances
      workerStats: new Map(), // Stats per worker
      updateInterval: null,
      chartUpdateInterval: null,
      userErrorData: [],
      errorThreshold: null,
      lastUiUpdate: 0,
      visitedUrls: new Set(),

      // Enhanced metrics
      errorsByCategory: {
        "4xx": 0,
        "5xx": 0,
        timeout: 0,
        network: 0,
      },
      totalBytesSent: 0,
      totalBytesReceived: 0,
      requestHistory: [],

      // Percentile tracking
      percentiles: {
        p50: 0,
        p95: 0,
        p99: 0,
      },
    };

    this.charts = {
      rps: null,
      responseTime: null,
      userError: null,
    };

    // Test presets
    this.presets = {
      light: { userCount: 10, duration: 30, trafficPattern: "steady" },
      medium: { userCount: 100, duration: 60, trafficPattern: "random" },
      heavy: { userCount: 500, duration: 120, trafficPattern: "rampup" },
      spike: { userCount: 200, duration: 60, trafficPattern: "burst" },
    };

    this.init();
  }

  init() {
    this.bindElements();
    this.attachEventListeners();
    this.initializeCharts();
    this.loadTheme();
    this.loadSavedConfigs();
    this.setupKeyboardShortcuts();
    this.fetchGitInfo();
  }

  bindElements() {
    // Form inputs
    this.elements = {
      targetUrl: document.getElementById("targetUrl"),
      userCount: document.getElementById("userCount"),
      userCountValue: document.getElementById("userCountValue"),
      duration: document.getElementById("duration"),
      durationValue: document.getElementById("durationValue"),
      trafficPattern: document.getElementById("trafficPattern"),
      httpMethod: document.getElementById("httpMethod"),
      customHeaders: document.getElementById("customHeaders"),
      requestBody: document.getElementById("requestBody"),
      thinkTime: document.getElementById("thinkTime"),
      thinkTimeValue: document.getElementById("thinkTimeValue"),

      // Crawler controls
      crawlerEnabled: document.getElementById("crawlerEnabled"),
      crawlDepth: document.getElementById("crawlDepth"),
      crawlDepthValue: document.getElementById("crawlDepthValue"),
      linksPerPage: document.getElementById("linksPerPage"),
      linksPerPageValue: document.getElementById("linksPerPageValue"),

      // Controls
      startBtn: document.getElementById("startBtn"),
      pauseBtn: document.getElementById("pauseBtn"),
      stopBtn: document.getElementById("stopBtn"),
      statusBadge: document.getElementById("statusBadge"),
      progressBar: document.getElementById("progressBar"),

      // Statistics
      elapsedTime: document.getElementById("elapsedTime"),
      remainingTime: document.getElementById("remainingTime"),
      activeUsers: document.getElementById("activeUsers"),
      totalRequests: document.getElementById("totalRequests"),
      requestsPerSec: document.getElementById("requestsPerSec"),
      successRate: document.getElementById("successRate"),
      failedRequests: document.getElementById("failedRequests"),
      avgResponseTime: document.getElementById("avgResponseTime"),

      // Enhanced metrics
      p50ResponseTime: document.getElementById("p50ResponseTime"),
      p95ResponseTime: document.getElementById("p95ResponseTime"),
      p99ResponseTime: document.getElementById("p99ResponseTime"),
      errors4xx: document.getElementById("errors4xx"),
      errors5xx: document.getElementById("errors5xx"),
      errorsTimeout: document.getElementById("errorsTimeout"),
      errorsNetwork: document.getElementById("errorsNetwork"),
      totalBandwidth: document.getElementById("totalBandwidth"),

      // Request history
      requestHistoryBody: document.getElementById("requestHistoryBody"),

      // Results
      resultsPanel: document.getElementById("resultsPanel"),
      resultsTableBody: document.getElementById("resultsTableBody"),
      exportJsonBtn: document.getElementById("exportJsonBtn"),
      exportCsvBtn: document.getElementById("exportCsvBtn"),

      // Advanced options
      advancedToggle: document.getElementById("advancedToggle"),
      advancedContent: document.getElementById("advancedContent"),

      // Theme & presets
      themeToggle: document.getElementById("themeToggle"),
      presetSelect: document.getElementById("presetSelect"),
      saveConfigBtn: document.getElementById("saveConfigBtn"),

      // Git Info
      gitInfo: document.getElementById("gitInfo"),
      gitCommit: document.getElementById("gitCommit"),
      gitDate: document.getElementById("gitDate"),
    };
  }

  attachEventListeners() {
    // Range inputs
    this.elements.userCount.addEventListener("input", (e) => {
      this.elements.userCountValue.textContent = e.target.value;
    });

    this.elements.duration.addEventListener("input", (e) => {
      this.elements.durationValue.textContent = e.target.value;
    });

    this.elements.thinkTime.addEventListener("input", (e) => {
      this.elements.thinkTimeValue.textContent = e.target.value;
    });

    if (this.elements.crawlDepth) {
      this.elements.crawlDepth.addEventListener("input", (e) => {
        this.elements.crawlDepthValue.textContent = e.target.value;
      });
    }

    if (this.elements.linksPerPage) {
      this.elements.linksPerPage.addEventListener("input", (e) => {
        this.elements.linksPerPageValue.textContent = e.target.value;
      });
    }

    // Control buttons
    this.elements.startBtn.addEventListener("click", () => this.startTest());
    this.elements.pauseBtn.addEventListener("click", () => this.pauseTest());
    this.elements.stopBtn.addEventListener("click", () => this.stopTest());

    // Export buttons
    this.elements.exportJsonBtn.addEventListener("click", () =>
      this.exportResults("json")
    );
    this.elements.exportCsvBtn.addEventListener("click", () =>
      this.exportResults("csv")
    );

    // Advanced options accordion
    this.elements.advancedToggle.addEventListener("click", () => {
      this.elements.advancedToggle.classList.toggle("active");
      this.elements.advancedContent.classList.toggle("active");
    });

    // Theme toggle
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener("click", () =>
        this.toggleTheme()
      );
    }

    // Preset selector
    if (this.elements.presetSelect) {
      this.elements.presetSelect.addEventListener("change", (e) =>
        this.loadPreset(e.target.value)
      );
    }

    // Save config
    if (this.elements.saveConfigBtn) {
      this.elements.saveConfigBtn.addEventListener("click", () =>
        this.saveConfig()
      );
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      switch (e.key.toLowerCase()) {
        case "s":
          if (this.state.status === "idle") this.startTest();
          break;
        case "p":
          if (this.state.status === "running" || this.state.status === "paused")
            this.pauseTest();
          break;
        case "x":
          if (this.state.status === "running" || this.state.status === "paused")
            this.stopTest();
          break;
      }
    });
  }

  loadTheme() {
    const savedTheme = localStorage.getItem("stressTestTheme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  toggleTheme() {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("stressTestTheme", newTheme);

    // Update chart colors
    this.updateChartTheme();
  }

  updateChartTheme() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark
      ? "rgba(148, 163, 184, 0.1)"
      : "rgba(148, 163, 184, 0.2)";

    Object.values(this.charts).forEach((chart) => {
      if (chart) {
        chart.options.scales.x.ticks.color = textColor;
        chart.options.scales.x.grid.color = gridColor;
        chart.options.scales.y.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
        if (chart.options.scales.y1) {
          chart.options.scales.y1.ticks.color = textColor;
        }
        chart.update("none");
      }
    });
  }

  loadSavedConfigs() {
    const saved = localStorage.getItem("stressTestConfigs");
    if (saved) {
      try {
        const configs = JSON.parse(saved);
        // Add to preset select if exists
        if (this.elements.presetSelect) {
          Object.keys(configs).forEach((name) => {
            const option = document.createElement("option");
            option.value = `saved_${name}`;
            option.textContent = `💾 ${name}`;
            this.elements.presetSelect.appendChild(option);
          });
        }
      } catch (e) {
        console.error("Failed to load saved configs:", e);
      }
    }
  }

  loadPreset(presetName) {
    if (!presetName) return;

    let config;
    if (presetName.startsWith("saved_")) {
      const saved = JSON.parse(
        localStorage.getItem("stressTestConfigs") || "{}"
      );
      config = saved[presetName.replace("saved_", "")];
    } else {
      config = this.presets[presetName];
    }

    if (config) {
      this.elements.userCount.value = config.userCount;
      this.elements.userCountValue.textContent = config.userCount;
      this.elements.duration.value = config.duration;
      this.elements.durationValue.textContent = config.duration;
      this.elements.trafficPattern.value = config.trafficPattern;
    }
  }

  saveConfig() {
    const name = prompt("Enter a name for this configuration:");
    if (!name) return;

    const config = {
      userCount: parseInt(this.elements.userCount.value),
      duration: parseInt(this.elements.duration.value),
      trafficPattern: this.elements.trafficPattern.value,
      targetUrl: this.elements.targetUrl.value,
    };

    const saved = JSON.parse(localStorage.getItem("stressTestConfigs") || "{}");
    saved[name] = config;
    localStorage.setItem("stressTestConfigs", JSON.stringify(saved));

    alert(`Configuration "${name}" saved!`);
    location.reload(); // Reload to update preset list
  }

  async fetchGitInfo() {
    try {
      // Ensure we don't have double slashes if proxyUrl ends with slash (it shouldn't based on init logic)
      const url = `${this.config.proxyUrl}/git-info`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.commit && data.date && data.commit !== 'Unknown') {
          if (this.elements.gitCommit) this.elements.gitCommit.textContent = data.commit;
          if (this.elements.gitDate) {
            let dateStr = data.date;
            // Shorten to match screenshot style (approximate)
            dateStr = dateStr.replace(/ days? ago/, 'd ago')
              .replace(/ hours? ago/, 'h ago')
              .replace(/ minutes? ago/, 'm ago')
              .replace(/ seconds? ago/, 's ago');
            this.elements.gitDate.textContent = dateStr;
          }
          if (this.elements.gitInfo) this.elements.gitInfo.style.display = 'flex';
        }
      }
    } catch (e) {
      console.error('Failed to fetch git info:', e);
    }
  }

  initializeCharts() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark
      ? "rgba(148, 163, 184, 0.1)"
      : "rgba(148, 163, 184, 0.2)";

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
          },
          ticks: {
            color: textColor,
          },
        },
        y: {
          grid: {
            color: gridColor,
          },
          ticks: {
            color: textColor,
          },
          beginAtZero: true,
        },
      },
    };

    // RPS Chart
    const rpsCtx = document.getElementById("rpsChart").getContext("2d");
    this.charts.rps = new Chart(rpsCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Requests per Second",
            data: [],
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          title: {
            display: true,
            text: "Requests per Second",
            color: textColor,
            font: {
              size: 14,
              weight: 600,
            },
          },
        },
      },
    });

    // Response Time Chart
    const responseTimeCtx = document
      .getElementById("responseTimeChart")
      .getContext("2d");
    this.charts.responseTime = new Chart(responseTimeCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Average Response Time (ms)",
            data: [],
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          title: {
            display: true,
            text: "Average Response Time",
            color: textColor,
            font: {
              size: 14,
              weight: 600,
            },
          },
        },
      },
    });

    // User/Error Correlation Chart
    const userErrorCtx = document
      .getElementById("userErrorChart")
      .getContext("2d");
    this.charts.userError = new Chart(userErrorCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Active Users",
            data: [],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            yAxisID: "y",
          },
          {
            label: "Error Rate (%)",
            data: [],
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: textColor,
              font: {
                size: 12,
                weight: 600,
              },
            },
          },
          title: {
            display: true,
            text: "User Load vs Error Rate",
            color: textColor,
            font: {
              size: 14,
              weight: 600,
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
            },
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "Active Users",
              color: "#3b82f6",
              font: {
                size: 12,
                weight: 600,
              },
            },
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
            },
            beginAtZero: true,
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Error Rate (%)",
              color: "#ef4444",
              font: {
                size: 12,
                weight: 600,
              },
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              color: textColor,
            },
            beginAtZero: true,
            max: 100,
          },
        },
      },
    });
  }

  async startTest() {
    if (!this.validateConfig()) {
      return;
    }

    this.gatherConfig();
    this.resetState();
    this.updateStatus("running");
    this.state.startTime = Date.now();

    // Update UI
    this.elements.startBtn.disabled = true;
    this.elements.pauseBtn.disabled = false;
    this.elements.stopBtn.disabled = false;

    // Start workers
    this.startWorkers();

    // Start update intervals
    this.state.updateInterval = setInterval(() => this.updateStatistics(), 100);
    this.state.chartUpdateInterval = setInterval(
      () => this.updateCharts(),
      1000
    );
  }

  pauseTest() {
    if (this.state.status === "running") {
      this.updateStatus("paused");
      this.state.pauseTime = Date.now();
      this.stopWorkers();
      this.elements.pauseBtn.textContent = "▶️ Resume";
    } else if (this.state.status === "paused") {
      this.updateStatus("running");
      const pauseDuration = Date.now() - this.state.pauseTime;
      this.state.startTime += pauseDuration;
      this.startWorkers();
      this.elements.pauseBtn.textContent = "⏸️ Pause";
    }
  }

  stopTest() {
    this.updateStatus("stopped");
    this.stopWorkers();
    clearInterval(this.state.updateInterval);
    clearInterval(this.state.chartUpdateInterval);

    // Update UI
    this.elements.startBtn.disabled = false;
    this.elements.pauseBtn.disabled = true;
    this.elements.stopBtn.disabled = true;
    this.elements.pauseBtn.textContent = "⏸️ Pause";

    // Calculate final percentiles
    this.calculatePercentiles();

    // Show results
    this.displayResults();
  }

  validateConfig() {
    const url = this.elements.targetUrl.value.trim();
    if (!url) {
      alert("Please enter a target URL");
      return false;
    }

    try {
      new URL(url);
    } catch (e) {
      alert("Please enter a valid URL");
      return false;
    }

    const headersText = this.elements.customHeaders.value.trim();
    if (headersText) {
      try {
        JSON.parse(headersText);
      } catch (e) {
        alert("Custom headers must be valid JSON");
        return false;
      }
    }

    const bodyText = this.elements.requestBody.value.trim();
    if (bodyText) {
      try {
        JSON.parse(bodyText);
      } catch (e) {
        alert("Request body must be valid JSON");
        return false;
      }
    }

    return true;
  }

  gatherConfig() {
    this.config.targetUrl = this.elements.targetUrl.value.trim();
    this.config.userCount = parseInt(this.elements.userCount.value);
    this.config.duration = parseInt(this.elements.duration.value);
    this.config.trafficPattern = this.elements.trafficPattern.value;
    this.config.httpMethod = this.elements.httpMethod.value;
    this.config.thinkTime = parseInt(this.elements.thinkTime.value);

    const headersText = this.elements.customHeaders.value.trim();
    this.config.customHeaders = headersText ? JSON.parse(headersText) : {};

    const bodyText = this.elements.requestBody.value.trim();
    this.config.requestBody = bodyText ? JSON.parse(bodyText) : null;

    // Crawler config
    if (this.elements.crawlerEnabled) {
      this.config.crawlerEnabled = this.elements.crawlerEnabled.checked;
      this.config.crawlDepth = parseInt(this.elements.crawlDepth?.value || 2);
      this.config.linksPerPage = parseInt(
        this.elements.linksPerPage?.value || 10
      );
    }
  }

  resetState() {
    this.state.elapsedTime = 0;
    this.state.activeUsers = 0;
    this.state.totalRequests = 0;
    this.state.successfulRequests = 0;
    this.state.failedRequests = 0;
    this.state.responseTimes = [];
    this.state.requestsPerSecond = [];
    this.state.workers = [];
    this.state.userErrorData = [];
    this.state.errorThreshold = null;
    this.state.errorsByCategory = {
      "4xx": 0,
      "5xx": 0,
      timeout: 0,
      network: 0,
    };
    this.state.totalBytesSent = 0;
    this.state.totalBytesReceived = 0;
    this.state.requestHistory = [];
    this.state.percentiles = { p50: 0, p95: 0, p99: 0 };

    // Reset state variables
    this.state.visitedUrls.clear();

    // Reset charts
    this.charts.rps.data.labels = [];
    this.charts.rps.data.datasets[0].data = [];
    this.charts.responseTime.data.labels = [];
    this.charts.responseTime.data.datasets[0].data = [];
    this.charts.userError.data.labels = [];
    this.charts.userError.data.datasets[0].data = [];
    this.charts.userError.data.datasets[1].data = [];
    this.charts.rps.update("none");
    this.charts.responseTime.update("none");
    this.charts.userError.update("none");

    // Clear request history table
    if (this.elements.requestHistoryBody) {
      this.elements.requestHistoryBody.innerHTML = "";
    }

    // Hide results panel
    this.elements.resultsPanel.style.display = "none";
  }

  startWorkers() {
    const totalUsers = this.config.userCount;
    const workerCount = Math.min(Math.ceil(totalUsers / 100), navigator.hardwareConcurrency || 4);
    const usersPerWorker = Math.ceil(totalUsers / workerCount);

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker('worker.js');
      const startUser = i * usersPerWorker;
      const endUser = Math.min((i + 1) * usersPerWorker, totalUsers);
      const workerUsers = Array.from({ length: endUser - startUser }, (_, j) => startUser + j);

      worker.onmessage = (e) => this.handleWorkerMessage(i, e.data);

      worker.postMessage({
        type: 'INIT',
        data: { config: this.config }
      });

      worker.postMessage({
        type: 'START',
        data: { users: workerUsers }
      });

      this.state.workers.push(worker);
      this.state.workerStats.set(i, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        bytesSent: 0,
        bytesReceived: 0,
        errorsByCategory: { "4xx": 0, "5xx": 0, "timeout": 0, "network": 0 },
        responseTimes: []
      });
    }

    this.state.activeUsers = totalUsers;
  }

  handleWorkerMessage(workerId, message) {
    if (message.type === 'STATS') {
      this.state.workerStats.set(workerId, message.data);
      this.aggregateStats();
    } else if (message.type === 'LOG') {
      this.state.visitedUrls.add(message.data.url);
      this.addToRequestHistory(message.data);
    }
  }

  aggregateStats() {
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let bytesSent = 0;
    let bytesReceived = 0;
    let errors = { "4xx": 0, "5xx": 0, "timeout": 0, "network": 0 };
    let allResponseTimes = [];

    for (const stats of this.state.workerStats.values()) {
      totalRequests += stats.totalRequests;
      successfulRequests += stats.successfulRequests;
      failedRequests += stats.failedRequests;
      bytesSent += stats.bytesSent;
      bytesReceived += stats.bytesReceived;

      errors["4xx"] += stats.errorsByCategory["4xx"];
      errors["5xx"] += stats.errorsByCategory["5xx"];
      errors["timeout"] += stats.errorsByCategory["timeout"];
      errors["network"] += stats.errorsByCategory["network"];

      if (stats.responseTimes) {
        allResponseTimes = allResponseTimes.concat(stats.responseTimes);
      }
    }

    this.state.totalRequests = totalRequests;
    this.state.successfulRequests = successfulRequests;
    this.state.failedRequests = failedRequests;
    this.state.totalBytesSent = bytesSent;
    this.state.totalBytesReceived = bytesReceived;
    this.state.errorsByCategory = errors;
    this.state.responseTimes = allResponseTimes.slice(-1000); // Sample for percentiles
  }

  addToRequestHistory(request) {
    this.state.requestHistory.unshift(request);

    // Keep only last 100
    if (this.state.requestHistory.length > 100) {
      this.state.requestHistory.pop();
    }

    // Update UI table
    if (this.elements.requestHistoryBody) {
      const row = document.createElement("tr");
      row.className = request.success ? "success-row" : "error-row";
      row.innerHTML = `
        <td>${request.timestamp}</td>
        <td class="url-cell" title="${request.url}">${this.truncateUrl(request.url)}</td>
        <td><span class="status-code ${request.success ? "success" : "error"}">${request.status}</span></td>
        <td>${request.responseTime}ms</td>
      `;

      this.elements.requestHistoryBody.insertBefore(row, this.elements.requestHistoryBody.firstChild);

      // Keep only 100 rows in DOM
      while (this.elements.requestHistoryBody.children.length > 100) {
        this.elements.requestHistoryBody.removeChild(this.elements.requestHistoryBody.lastChild);
      }
    }
  }

  truncateUrl(url) {
    if (url.length > 50) {
      return url.substring(0, 47) + "...";
    }
    return url;
  }

  stopWorkers() {
    this.state.workers.forEach((worker) => {
      worker.terminate();
    });
    this.state.workers = [];
    this.state.workerStats.clear();
  }

  calculatePercentiles() {
    if (this.state.responseTimes.length > 0) {
      this.state.percentiles.p50 = Math.round(
        calculatePercentile(this.state.responseTimes, 50)
      );
      this.state.percentiles.p95 = Math.round(
        calculatePercentile(this.state.responseTimes, 95)
      );
      this.state.percentiles.p99 = Math.round(
        calculatePercentile(this.state.responseTimes, 99)
      );
    }
  }

  updateStatistics() {
    const now = Date.now();

    // Check if enough time has passed for a UI update (1000ms throttled)
    if (this.state.status === "running" && now - this.state.lastUiUpdate < 1000) {
      return;
    }
    this.state.lastUiUpdate = now;

    const elapsed = Math.floor((now - this.state.startTime) / 1000);
    const remaining = Math.max(0, this.config.duration - elapsed);
    const progress = Math.min(100, (elapsed / this.config.duration) * 100);

    // Update time displays
    this.elements.elapsedTime.textContent = `${elapsed}s`;
    this.elements.remainingTime.textContent = `${remaining}s`;
    this.elements.progressBar.style.width = `${progress}%`;

    // Update statistics
    this.elements.activeUsers.textContent = this.state.activeUsers;
    this.elements.totalRequests.textContent =
      this.state.totalRequests.toLocaleString();
    this.elements.failedRequests.textContent =
      this.state.failedRequests.toLocaleString();

    // Calculate RPS
    const rps =
      elapsed > 0 ? Math.round(this.state.totalRequests / elapsed) : 0;
    this.elements.requestsPerSec.textContent = rps;

    // Calculate success rate
    const successRate =
      this.state.totalRequests > 0
        ? (
          (this.state.successfulRequests / this.state.totalRequests) *
          100
        ).toFixed(1)
        : 0;
    this.elements.successRate.textContent = `${successRate}%`;

    // Calculate average response time
    const avgResponseTime =
      this.state.responseTimes.length > 0
        ? Math.round(
          this.state.responseTimes.reduce((a, b) => a + b, 0) /
          this.state.responseTimes.length
        )
        : 0;
    this.elements.avgResponseTime.textContent = `${avgResponseTime}ms`;

    // Update enhanced metrics
    if (this.elements.p50ResponseTime) {
      const p50 = Math.round(calculatePercentile(this.state.responseTimes, 50));
      const p95 = Math.round(calculatePercentile(this.state.responseTimes, 95));
      const p99 = Math.round(calculatePercentile(this.state.responseTimes, 99));

      this.elements.p50ResponseTime.textContent = `${p50}ms`;
      this.elements.p95ResponseTime.textContent = `${p95}ms`;
      this.elements.p99ResponseTime.textContent = `${p99}ms`;
    }

    if (this.elements.errors4xx) {
      this.elements.errors4xx.textContent = this.state.errorsByCategory["4xx"];
      this.elements.errors5xx.textContent = this.state.errorsByCategory["5xx"];
      this.elements.errorsTimeout.textContent =
        this.state.errorsByCategory["timeout"];
      this.elements.errorsNetwork.textContent =
        this.state.errorsByCategory["network"];
    }

    if (this.elements.totalBandwidth) {
      const totalBytes =
        this.state.totalBytesSent + this.state.totalBytesReceived;
      this.elements.totalBandwidth.textContent = formatBytes(totalBytes);
    }
  }

  updateCharts() {
    const now = Date.now();
    const elapsed = Math.floor((now - this.state.startTime) / 1000);

    // Calculate current RPS
    const currentRps =
      this.state.totalRequests > 0 && elapsed > 0
        ? Math.round(this.state.totalRequests / elapsed)
        : 0;

    // Calculate current average response time
    const recentResponseTimes = this.state.responseTimes.slice(-100);
    const currentAvgResponseTime =
      recentResponseTimes.length > 0
        ? Math.round(
          recentResponseTimes.reduce((a, b) => a + b, 0) /
          recentResponseTimes.length
        )
        : 0;

    // Update RPS chart
    this.charts.rps.data.labels.push(`${elapsed}s`);
    this.charts.rps.data.datasets[0].data.push(currentRps);

    if (this.charts.rps.data.labels.length > 60) {
      this.charts.rps.data.labels.shift();
      this.charts.rps.data.datasets[0].data.shift();
    }

    this.charts.rps.update("none");

    // Update Response Time chart
    this.charts.responseTime.data.labels.push(`${elapsed}s`);
    this.charts.responseTime.data.datasets[0].data.push(currentAvgResponseTime);

    if (this.charts.responseTime.data.labels.length > 60) {
      this.charts.responseTime.data.labels.shift();
      this.charts.responseTime.data.datasets[0].data.shift();
    }

    this.charts.responseTime.update("none");

    // Calculate current error rate
    const currentErrorRate =
      this.state.totalRequests > 0
        ? (
          (this.state.failedRequests / this.state.totalRequests) *
          100
        ).toFixed(1)
        : 0;

    // Update User/Error chart
    this.charts.userError.data.labels.push(`${elapsed}s`);
    this.charts.userError.data.datasets[0].data.push(this.state.activeUsers);
    this.charts.userError.data.datasets[1].data.push(
      parseFloat(currentErrorRate)
    );

    // Track user/error data
    this.state.userErrorData.push({
      time: elapsed,
      users: this.state.activeUsers,
      errorRate: parseFloat(currentErrorRate),
      failedRequests: this.state.failedRequests,
    });

    // Detect error threshold
    if (
      this.state.errorThreshold === null &&
      this.state.failedRequests > 0 &&
      this.state.activeUsers > 0
    ) {
      this.state.errorThreshold = {
        users: this.state.activeUsers,
        time: elapsed,
        errorRate: parseFloat(currentErrorRate),
      };
    }

    if (this.charts.userError.data.labels.length > 60) {
      this.charts.userError.data.labels.shift();
      this.charts.userError.data.datasets[0].data.shift();
      this.charts.userError.data.datasets[1].data.shift();
    }

    this.charts.userError.update("none");
  }

  updateStatus(status) {
    this.state.status = status;
    const badge = this.elements.statusBadge;

    badge.className = "status-badge";

    switch (status) {
      case "idle":
        badge.classList.add("status-idle");
        badge.textContent = "Idle";
        break;
      case "running":
        badge.classList.add("status-running");
        badge.textContent = "Running";
        break;
      case "paused":
        badge.classList.add("status-paused");
        badge.textContent = "Paused";
        break;
      case "stopped":
        badge.classList.add("status-idle");
        badge.textContent = "Completed";
        break;
    }
  }

  displayResults() {
    this.elements.resultsPanel.style.display = "block";

    const results = this.calculateResults();
    const tbody = this.elements.resultsTableBody;
    tbody.innerHTML = "";

    // Populate results table
    Object.entries(results).forEach(([key, value]) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${key}</strong></td>
        <td><code>${value}</code></td>
      `;
      tbody.appendChild(row);
    });

    // Scroll to results
    this.elements.resultsPanel.scrollIntoView({ behavior: "smooth" });
  }

  calculateResults() {
    const totalTime =
      this.state.elapsedTime ||
      Math.floor((Date.now() - this.state.startTime) / 1000);
    const successRate =
      this.state.totalRequests > 0
        ? (
          (this.state.successfulRequests / this.state.totalRequests) *
          100
        ).toFixed(2)
        : 0;

    const avgResponseTime =
      this.state.responseTimes.length > 0
        ? Math.round(
          this.state.responseTimes.reduce((a, b) => a + b, 0) /
          this.state.responseTimes.length
        )
        : 0;

    const minResponseTime =
      this.state.responseTimes.length > 0
        ? Math.round(Math.min(...this.state.responseTimes))
        : 0;

    const maxResponseTime =
      this.state.responseTimes.length > 0
        ? Math.round(Math.max(...this.state.responseTimes))
        : 0;

    const rps =
      totalTime > 0 ? (this.state.totalRequests / totalTime).toFixed(2) : 0;

    const results = {
      "Target URL": this.config.targetUrl,
      "Test Duration": `${totalTime} seconds`,
      "Concurrent Users": this.config.userCount,
      "Traffic Pattern": this.config.trafficPattern,
      "Crawler Mode": this.config.crawlerEnabled ? "Enabled" : "Disabled",
      "Total Requests": this.state.totalRequests.toLocaleString(),
      "Successful Requests": this.state.successfulRequests.toLocaleString(),
      "Failed Requests": this.state.failedRequests.toLocaleString(),
      "Success Rate": `${successRate}%`,
      "Requests per Second": rps,
      "Average Response Time": `${avgResponseTime}ms`,
      "Min Response Time": `${minResponseTime}ms`,
      "Max Response Time": `${maxResponseTime}ms`,
      "P50 Response Time": `${this.state.percentiles.p50}ms`,
      "P95 Response Time": `${this.state.percentiles.p95}ms`,
      "P99 Response Time": `${this.state.percentiles.p99}ms`,
      "4xx Errors": this.state.errorsByCategory["4xx"],
      "5xx Errors": this.state.errorsByCategory["5xx"],
      "Timeout Errors": this.state.errorsByCategory["timeout"],
      "Network Errors": this.state.errorsByCategory["network"],
      "Total Bandwidth": formatBytes(
        this.state.totalBytesSent + this.state.totalBytesReceived
      ),
      "Data Sent": formatBytes(this.state.totalBytesSent),
      "Data Received": formatBytes(this.state.totalBytesReceived),
      "HTTP Method": this.config.httpMethod,
      "Think Time": `${this.config.thinkTime}ms`,
      "Error Threshold": this.state.errorThreshold
        ? `${this.state.errorThreshold.users} users at ${this.state.errorThreshold.time}s (${this.state.errorThreshold.errorRate}% error rate)`
        : "No errors detected",
    };

    if (this.config.crawlerEnabled) {
      results["Unique URLs Visited"] = this.state.visitedUrls.size;
    }

    return results;
  }

  exportResults(format) {
    const results = this.calculateResults();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "json") {
      const data = {
        config: this.config,
        results: results,
        requestHistory: this.state.requestHistory.slice(0, 100),
        timestamp: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      this.downloadFile(blob, `stress-test-results-${timestamp}.json`);
    } else if (format === "csv") {
      let csv = "Metric,Value\n";
      Object.entries(results).forEach(([key, value]) => {
        csv += `"${key}","${value}"\n`;
      });

      const blob = new Blob([csv], { type: "text/csv" });
      this.downloadFile(blob, `stress-test-results-${timestamp}.csv`);
    }
  }

  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new StressTestingTool();
});
