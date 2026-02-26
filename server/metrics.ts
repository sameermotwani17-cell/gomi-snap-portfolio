// System metrics tracking for GOMI SNAP
// Tracks active scans, API calls, cache performance, and system health

interface MetricsData {
  // Active operations
  activeScans: number;
  peakActiveScans: number;
  
  // Request counters (resets periodically)
  totalScansToday: number;
  openAICallsToday: number;
  cacheHitsToday: number;
  cacheMissesToday: number;
  
  // Rolling window (last 5 minutes)
  recentScans: number[];
  recentOpenAICalls: number[];
  recentErrors: number[];
  
  // Timestamps
  lastScanAt: Date | null;
  lastOpenAICallAt: Date | null;
  lastErrorAt: Date | null;
  metricsStartedAt: Date;
  lastDailyReset: Date;
  
  // Error tracking
  consecutiveErrors: number;
  totalErrorsToday: number;
  lastErrorMessage: string | null;
  
  // Response times (last 10)
  recentResponseTimes: number[];
}

class SystemMetrics {
  private data: MetricsData;
  private readonly ROLLING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RECENT_ITEMS = 100;

  constructor() {
    const now = new Date();
    this.data = {
      activeScans: 0,
      peakActiveScans: 0,
      totalScansToday: 0,
      openAICallsToday: 0,
      cacheHitsToday: 0,
      cacheMissesToday: 0,
      recentScans: [],
      recentOpenAICalls: [],
      recentErrors: [],
      lastScanAt: null,
      lastOpenAICallAt: null,
      lastErrorAt: null,
      metricsStartedAt: now,
      lastDailyReset: now,
      consecutiveErrors: 0,
      totalErrorsToday: 0,
      lastErrorMessage: null,
      recentResponseTimes: [],
    };

    // Reset daily counters at midnight JST
    this.scheduleDailyReset();
  }

  private scheduleDailyReset() {
    const now = new Date();
    const jstOffset = 9 * 60; // JST is UTC+9
    const nowJST = new Date(now.getTime() + jstOffset * 60 * 1000);
    const tomorrowMidnightJST = new Date(nowJST);
    tomorrowMidnightJST.setHours(24, 0, 0, 0);
    const msUntilMidnight = tomorrowMidnightJST.getTime() - nowJST.getTime();

    setTimeout(() => {
      this.resetDailyCounters();
      // Schedule next reset
      setInterval(() => this.resetDailyCounters(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  private resetDailyCounters() {
    this.data.totalScansToday = 0;
    this.data.openAICallsToday = 0;
    this.data.cacheHitsToday = 0;
    this.data.cacheMissesToday = 0;
    this.data.totalErrorsToday = 0;
    this.data.lastDailyReset = new Date();
  }

  private pruneOldEntries() {
    const cutoff = Date.now() - this.ROLLING_WINDOW_MS;
    this.data.recentScans = this.data.recentScans.filter(t => t > cutoff);
    this.data.recentOpenAICalls = this.data.recentOpenAICalls.filter(t => t > cutoff);
    this.data.recentErrors = this.data.recentErrors.filter(t => t > cutoff);
  }

  // Call when a scan request starts
  startScan(): () => void {
    this.data.activeScans++;
    this.data.totalScansToday++;
    this.data.lastScanAt = new Date();
    this.data.recentScans.push(Date.now());
    
    if (this.data.activeScans > this.data.peakActiveScans) {
      this.data.peakActiveScans = this.data.activeScans;
    }

    const startTime = Date.now();
    
    // Return a function to call when scan ends
    return () => {
      this.data.activeScans = Math.max(0, this.data.activeScans - 1);
      const responseTime = Date.now() - startTime;
      this.data.recentResponseTimes.push(responseTime);
      if (this.data.recentResponseTimes.length > 10) {
        this.data.recentResponseTimes.shift();
      }
    };
  }

  // Call when OpenAI API is invoked
  recordOpenAICall() {
    this.data.openAICallsToday++;
    this.data.lastOpenAICallAt = new Date();
    this.data.recentOpenAICalls.push(Date.now());
    this.data.cacheMissesToday++;
    this.data.consecutiveErrors = 0; // Successful API call resets error counter
  }

  // Call when cache hit occurs
  recordCacheHit() {
    this.data.cacheHitsToday++;
    this.data.consecutiveErrors = 0;
  }

  // Call when an error occurs
  recordError(message: string) {
    this.data.totalErrorsToday++;
    this.data.consecutiveErrors++;
    this.data.lastErrorAt = new Date();
    this.data.lastErrorMessage = message;
    this.data.recentErrors.push(Date.now());
  }

  // Get current system health status
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: {
      activeScans: number;
      peakActiveScans: number;
      scansPerMinute: number;
      openAICallsPerMinute: number;
      cacheHitRate: number;
      averageResponseTime: number;
      consecutiveErrors: number;
      totalScansToday: number;
      totalOpenAICallsToday: number;
      totalErrorsToday: number;
      lastScanAt: string | null;
      lastErrorAt: string | null;
      lastErrorMessage: string | null;
      uptime: number;
    };
    alerts: string[];
  } {
    this.pruneOldEntries();

    const now = Date.now();
    const fiveMinutesAgo = now - this.ROLLING_WINDOW_MS;
    
    // Calculate rates per minute
    const scansInWindow = this.data.recentScans.filter(t => t > fiveMinutesAgo).length;
    const openAIInWindow = this.data.recentOpenAICalls.filter(t => t > fiveMinutesAgo).length;
    const errorsInWindow = this.data.recentErrors.filter(t => t > fiveMinutesAgo).length;
    
    const scansPerMinute = scansInWindow / 5;
    const openAICallsPerMinute = openAIInWindow / 5;
    
    // Cache hit rate
    const totalRequests = this.data.cacheHitsToday + this.data.cacheMissesToday;
    const cacheHitRate = totalRequests > 0 
      ? (this.data.cacheHitsToday / totalRequests) * 100 
      : 0;

    // Average response time
    const avgResponseTime = this.data.recentResponseTimes.length > 0
      ? this.data.recentResponseTimes.reduce((a, b) => a + b, 0) / this.data.recentResponseTimes.length
      : 0;

    // Determine health status and alerts
    const alerts: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for issues
    if (this.data.activeScans >= 5) {
      alerts.push(`High load: ${this.data.activeScans} concurrent scans`);
      status = 'critical';
    } else if (this.data.activeScans >= 3) {
      alerts.push(`Elevated load: ${this.data.activeScans} concurrent scans`);
      if (status === 'healthy') status = 'warning';
    }

    if (this.data.consecutiveErrors >= 3) {
      alerts.push(`API issues: ${this.data.consecutiveErrors} consecutive errors`);
      status = 'critical';
    } else if (this.data.consecutiveErrors >= 1) {
      alerts.push(`Recent error detected`);
      if (status === 'healthy') status = 'warning';
    }

    if (openAICallsPerMinute >= 4) {
      alerts.push(`High API usage: ${openAICallsPerMinute.toFixed(1)} calls/min (approaching rate limit)`);
      if (status === 'healthy') status = 'warning';
    }

    if (errorsInWindow >= 5) {
      alerts.push(`Error spike: ${errorsInWindow} errors in last 5 minutes`);
      status = 'critical';
    }

    if (avgResponseTime > 10000) {
      alerts.push(`Slow responses: ${(avgResponseTime / 1000).toFixed(1)}s average`);
      if (status === 'healthy') status = 'warning';
    }

    if (cacheHitRate < 30 && totalRequests >= 10) {
      alerts.push(`Low cache efficiency: ${cacheHitRate.toFixed(0)}% hit rate`);
      if (status === 'healthy') status = 'warning';
    }

    // Calculate uptime
    const uptimeMs = now - this.data.metricsStartedAt.getTime();
    const uptimeHours = uptimeMs / (1000 * 60 * 60);

    return {
      status,
      metrics: {
        activeScans: this.data.activeScans,
        peakActiveScans: this.data.peakActiveScans,
        scansPerMinute: Math.round(scansPerMinute * 10) / 10,
        openAICallsPerMinute: Math.round(openAICallsPerMinute * 10) / 10,
        cacheHitRate: Math.round(cacheHitRate * 10) / 10,
        averageResponseTime: Math.round(avgResponseTime),
        consecutiveErrors: this.data.consecutiveErrors,
        totalScansToday: this.data.totalScansToday,
        totalOpenAICallsToday: this.data.openAICallsToday,
        totalErrorsToday: this.data.totalErrorsToday,
        lastScanAt: this.data.lastScanAt?.toISOString() ?? null,
        lastErrorAt: this.data.lastErrorAt?.toISOString() ?? null,
        lastErrorMessage: this.data.lastErrorMessage,
        uptime: Math.round(uptimeHours * 10) / 10,
      },
      alerts,
    };
  }

  // Get capacity info for scaling decisions
  getCapacityInfo(): {
    currentLoad: number; // 0-100%
    estimatedMaxConcurrent: number;
    recommendation: string;
  } {
    const maxConcurrent = 6; // Based on architecture analysis
    const currentLoad = (this.data.activeScans / maxConcurrent) * 100;
    
    let recommendation = 'System operating normally';
    if (currentLoad >= 80) {
      recommendation = 'At capacity - consider scaling or implementing queue';
    } else if (currentLoad >= 50) {
      recommendation = 'Moderate load - monitor for spikes';
    }

    return {
      currentLoad: Math.min(100, Math.round(currentLoad)),
      estimatedMaxConcurrent: maxConcurrent,
      recommendation,
    };
  }
}

// Export singleton instance
export const systemMetrics = new SystemMetrics();
