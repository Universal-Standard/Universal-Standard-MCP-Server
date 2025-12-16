const logger = require('./logger');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const WEBHOOK_EVENTS = [
  'tool.executed',
  'tool.created',
  'tool.failed',
  'api_key.created',
  'api_key.deleted',
  'provider.configured',
  'provider.test_failed',
  'security.rate_limit_exceeded',
  'evolution.started',
  'evolution.completed',
  'evolution.failed'
];

class WebhookManager {
  constructor() {
    this.webhooks = new Map();
    this.queue = [];
    this.processing = false;
  }

  registerWebhook(id, config) {
    if (!config.url || !config.events) {
      throw new Error('Webhook requires url and events');
    }
    
    const invalidEvents = config.events.filter(e => !WEBHOOK_EVENTS.includes(e) && e !== '*');
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }
    
    this.webhooks.set(id, {
      id,
      url: config.url,
      events: config.events,
      secret: config.secret || null,
      enabled: config.enabled !== false,
      retries: config.retries || 3,
      createdAt: new Date().toISOString()
    });
    
    logger.info('Webhook registered', { id, url: config.url, events: config.events });
    return this.webhooks.get(id);
  }

  unregisterWebhook(id) {
    const removed = this.webhooks.delete(id);
    if (removed) {
      logger.info('Webhook unregistered', { id });
    }
    return removed;
  }

  getWebhook(id) {
    return this.webhooks.get(id);
  }

  listWebhooks() {
    return Array.from(this.webhooks.values()).map(w => ({
      id: w.id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      createdAt: w.createdAt
    }));
  }

  async trigger(event, payload) {
    if (!WEBHOOK_EVENTS.includes(event)) {
      logger.warn('Unknown webhook event', { event });
      return;
    }
    
    const matchingWebhooks = Array.from(this.webhooks.values())
      .filter(w => w.enabled && (w.events.includes(event) || w.events.includes('*')));
    
    if (matchingWebhooks.length === 0) {
      return;
    }
    
    const notification = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event,
      payload,
      timestamp: new Date().toISOString()
    };
    
    for (const webhook of matchingWebhooks) {
      this.queue.push({
        webhook,
        notification,
        attempts: 0
      });
    }
    
    this.processQueue();
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      await this.sendWebhook(item);
    }
    
    this.processing = false;
  }

  sendWebhook(item) {
    const { webhook, notification, attempts } = item;
    
    return new Promise((resolve) => {
      try {
        const body = JSON.stringify(notification);
        const parsedUrl = new URL(webhook.url);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const headers = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Webhook-Event': notification.event,
          'X-Webhook-ID': notification.id,
          'X-Webhook-Timestamp': notification.timestamp
        };
        
        if (webhook.secret) {
          const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(body)
            .digest('hex');
          headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }
        
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers,
          timeout: 10000
        };
        
        const req = httpModule.request(options, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.debug('Webhook delivered', { 
              webhookId: webhook.id, 
              event: notification.event,
              url: webhook.url,
              statusCode: res.statusCode
            });
            resolve(true);
          } else {
            this.handleWebhookError(item, `HTTP ${res.statusCode}`);
            resolve(false);
          }
          res.resume();
        });
        
        req.on('error', (error) => {
          this.handleWebhookError(item, error.message);
          resolve(false);
        });
        
        req.on('timeout', () => {
          req.destroy();
          this.handleWebhookError(item, 'Request timeout');
          resolve(false);
        });
        
        req.write(body);
        req.end();
        
      } catch (error) {
        this.handleWebhookError(item, error.message);
        resolve(false);
      }
    });
  }
  
  handleWebhookError(item, errorMessage) {
    const { webhook, notification, attempts } = item;
    
    logger.warn('Webhook delivery failed', { 
      webhookId: webhook.id, 
      event: notification.event,
      error: errorMessage,
      attempt: attempts + 1
    });
    
    if (attempts < webhook.retries) {
      const delay = Math.pow(2, attempts) * 1000;
      setTimeout(() => {
        this.queue.push({
          webhook,
          notification,
          attempts: attempts + 1
        });
        this.processQueue();
      }, delay);
    } else {
      logger.error('Webhook delivery permanently failed', {
        webhookId: webhook.id,
        event: notification.event,
        url: webhook.url
      });
    }
  }

  async testWebhook(id) {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    
    const testEvent = webhook.events.includes('*') ? 'tool.executed' : webhook.events[0];
    
    const notification = {
      id: `wh_test_${Date.now()}`,
      event: testEvent,
      payload: {
        test: true,
        message: 'This is a test webhook notification',
        webhookId: id
      },
      timestamp: new Date().toISOString()
    };
    
    return this.sendWebhook({ webhook, notification, attempts: 0 });
  }
}

const webhookManager = new WebhookManager();

module.exports = { webhookManager, WEBHOOK_EVENTS };
