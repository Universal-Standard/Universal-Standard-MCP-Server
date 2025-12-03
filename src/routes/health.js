/**
 * Health Check Routes
 * Provides Kubernetes-compatible health endpoints for monitoring
 */
const express = require('express');
const router = express.Router();

const startTime = Date.now();
const VERSION = '1.0.0';

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @returns {string}
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format uptime to human readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

/**
 * GET /health - Basic health check
 * Returns server health status
 */
router.get('/', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: uptimeSeconds,
    uptimeFormatted: formatUptime(uptimeSeconds),
    version: VERSION,
  });
});

/**
 * GET /health/detailed - Detailed health check
 * Returns comprehensive server status including memory usage
 */
router.get('/detailed', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    memory: {
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      rss: formatBytes(memoryUsage.rss),
      external: formatBytes(memoryUsage.external),
      heapUsedRaw: memoryUsage.heapUsed,
      heapTotalRaw: memoryUsage.heapTotal,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /health/ready - Kubernetes readiness probe
 * Indicates if server is ready to receive traffic
 */
router.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/live - Kubernetes liveness probe
 * Indicates if server process is alive
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'live',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
