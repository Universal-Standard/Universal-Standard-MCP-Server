const API_BASE = '';
let API_KEY = localStorage.getItem('spurs_api_key') || 'demo-api-key';

function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

function setApiKey(key) {
  if (key && key.trim()) {
    API_KEY = key.trim();
    localStorage.setItem('spurs_api_key', API_KEY);
    showToast('API key updated', 'success');
    refreshData();
  }
}

function clearApiKey() {
  API_KEY = 'demo-api-key';
  localStorage.removeItem('spurs_api_key');
  showToast('API key cleared, using demo key', 'info');
}

async function refreshData() {
  await Promise.all([
    loadTools(),
    loadProviders(),
    loadStats()
  ]);
  updateToolCount();
}

async function loadStats() {
  try {
    const data = await apiRequest('/api/settings/stats');
    state.stats = data;
    return data;
  } catch (error) {
    console.error('Failed to load stats:', error);
    return null;
  }
}

function updateToolCount() {
  const count = state.tools?.length || 0;
  const badge = document.getElementById('tools-count');
  if (badge) {
    badge.textContent = count;
  }
  const heroText = document.querySelector('.feature-card:nth-child(2) p');
  if (heroText && heroText.textContent.includes('built-in tools')) {
    heroText.textContent = `${count}+ built-in tools including AI chat, web search, code execution, and utilities. Easily extend with custom tools through the modular registry system.`;
  }
}

const state = {
  currentPage: 'home',
  tools: [],
  prompts: [],
  resources: [],
  providers: [],
  apiKeys: [],
  settings: {},
  logs: [],
  chatSessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  chatMessages: []
};

async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || `API Error: ${response.statusText}`);
    }
    
    return data;
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

async function loadTools() {
  try {
    const data = await apiRequest('/mcp/tools');
    state.tools = data.tools || [];
    return state.tools;
  } catch (error) {
    console.error('Failed to load tools:', error);
    return [];
  }
}

async function loadPrompts() {
  try {
    const data = await apiRequest('/mcp/prompts');
    state.prompts = data.prompts || [];
    return state.prompts;
  } catch (error) {
    console.error('Failed to load prompts:', error);
    return [];
  }
}

async function loadResources() {
  try {
    const data = await apiRequest('/mcp/resources');
    state.resources = data.resources || [];
    return state.resources;
  } catch (error) {
    console.error('Failed to load resources:', error);
    return [];
  }
}

async function loadProviders() {
  try {
    const data = await apiRequest('/api/settings/providers');
    state.providers = data.providers || [];
    return state.providers;
  } catch (error) {
    console.error('Failed to load providers:', error);
    return [];
  }
}

async function loadApiKeys() {
  try {
    const data = await apiRequest('/api/settings/api-keys');
    state.apiKeys = data.apiKeys || [];
    return state.apiKeys;
  } catch (error) {
    console.error('Failed to load API keys:', error);
    return [];
  }
}

async function loadActivityLogs() {
  try {
    const data = await apiRequest('/api/settings/activity?limit=50');
    return data.logs || [];
  } catch (error) {
    console.error('Failed to load activity logs:', error);
    return [];
  }
}

async function executeTool(name, args = {}) {
  try {
    const result = await apiRequest('/mcp/tools/call', {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args })
    });
    addLog('success', `Tool "${name}" executed successfully`);
    return result;
  } catch (error) {
    addLog('error', `Tool "${name}" failed: ${error.message}`);
    throw error;
  }
}

function addLog(level, message) {
  const now = new Date();
  const time = now.toLocaleTimeString();
  state.logs.unshift({ time, level, message });
  if (state.logs.length > 100) state.logs.pop();
  updateConsole();
}

function updateConsole() {
  const console = document.getElementById('activity-console');
  if (!console) return;
  
  console.innerHTML = state.logs.slice(0, 20).map(log => `
    <div class="console-line">
      <span class="console-time">[${log.time}]</span>
      <span class="console-level ${log.level}">${log.level.toUpperCase()}</span>
      <span>${log.message}</span>
    </div>
  `).join('');
}

function navigate(page) {
  state.currentPage = page;
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = p.id === `page-${page}` ? 'block' : 'none';
  });
  
  document.querySelector('.page-title').textContent = getPageTitle(page);
  
  if (page === 'dashboard') loadDashboard();
  if (page === 'tools') loadToolsPage();
  if (page === 'resources') loadResourcesPage();
  if (page === 'settings') loadSettings();
  if (page === 'logs') loadLogsPage();
}

function getPageTitle(page) {
  const titles = {
    home: 'Welcome',
    dashboard: 'Dashboard',
    tools: 'Tools',
    resources: 'Resources',
    playground: 'AI Playground',
    connections: 'Connections',
    addons: 'Add-ons',
    logs: 'Activity Logs',
    settings: 'Settings',
    about: 'About'
  };
  return titles[page] || 'SPURS MCP Server';
}

async function loadToolsPage() {
  const tools = await loadTools();
  renderToolsGrid(tools);
  
  const countEl = document.getElementById('tools-count');
  if (countEl) countEl.textContent = tools.length;
}

async function loadResourcesPage() {
  const resources = await loadResources();
  renderResourcesGrid(resources);
}

async function loadDashboard() {
  try {
    const stats = await apiRequest('/api/settings/stats');
    
    document.getElementById('stat-tools').textContent = stats.tools;
    document.getElementById('stat-prompts').textContent = stats.prompts;
    document.getElementById('stat-resources').textContent = stats.resources;
    
    addLog('info', 'Dashboard data loaded');
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    addLog('error', 'Failed to load dashboard');
  }
}

async function loadServices() {
  const [tools, resources] = await Promise.all([
    loadTools(),
    loadResources()
  ]);
  
  renderToolsGrid(tools);
  renderResourcesGrid(resources);
}

function renderToolsGrid(tools) {
  const container = document.getElementById('tools-grid');
  if (!container) return;
  
  const categoryIcons = {
    ai: '🤖',
    search: '🔍',
    code: '💻',
    utility: '🔧'
  };
  
  container.innerHTML = tools.map(tool => `
    <div class="tool-card" onclick="showToolModal('${tool.name}')">
      <div class="tool-card-header">
        <div class="tool-card-icon">${categoryIcons[tool.category] || '⚡'}</div>
        <div class="tool-card-info">
          <h3>${tool.name}</h3>
          <span class="tool-card-category">${tool.category}</span>
        </div>
      </div>
      <p class="tool-card-description">${tool.description}</p>
    </div>
  `).join('');
}

function renderPromptsGrid(prompts) {
  const container = document.getElementById('prompts-grid');
  if (!container) return;
  
  container.innerHTML = prompts.map(prompt => `
    <div class="tool-card" onclick="showPromptModal('${prompt.name}')">
      <div class="tool-card-header">
        <div class="tool-card-icon">📝</div>
        <div class="tool-card-info">
          <h3>${prompt.name}</h3>
          <span class="tool-card-category">Prompt Template</span>
        </div>
      </div>
      <p class="tool-card-description">${prompt.description}</p>
    </div>
  `).join('');
}

function renderResourcesGrid(resources) {
  const container = document.getElementById('resources-grid');
  if (!container) return;
  
  container.innerHTML = resources.map(resource => `
    <div class="tool-card" onclick="showResourceModal('${resource.uri}')">
      <div class="tool-card-header">
        <div class="tool-card-icon">📦</div>
        <div class="tool-card-info">
          <h3>${resource.name}</h3>
          <span class="tool-card-category">Resource</span>
        </div>
      </div>
      <p class="tool-card-description">${resource.description}</p>
    </div>
  `).join('');
}

async function loadSettings() {
  const [providers, apiKeys] = await Promise.all([
    loadProviders(),
    loadApiKeys()
  ]);
  
  renderProviderCards(providers);
  renderApiKeysTable(apiKeys);
}

function renderProviderCards(providers) {
  const container = document.getElementById('providers-list');
  if (!container) return;
  
  const logoMap = { openai: 'O', anthropic: 'A', gemini: 'G' };
  
  container.innerHTML = providers.map(provider => `
    <div class="provider-card">
      <div class="provider-header">
        <div class="provider-info">
          <div class="provider-logo ${provider.name}">${logoMap[provider.name] || provider.name[0].toUpperCase()}</div>
          <span class="provider-name">${provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}</span>
        </div>
        <div class="provider-status ${provider.configured ? 'active' : 'inactive'}">
          <span class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: currentColor;"></span>
          ${provider.configured ? 'Configured' : 'Not Configured'}
        </div>
      </div>
      <div class="provider-actions" style="display: flex; gap: 12px; margin-top: 16px;">
        <button class="btn btn-secondary" onclick="configureProvider('${provider.name}')">Configure</button>
        <button class="btn btn-primary" onclick="testProvider('${provider.name}')" ${!provider.configured ? 'disabled' : ''}>Test Connection</button>
      </div>
    </div>
  `).join('');
}

function renderApiKeysTable(apiKeys) {
  const container = document.getElementById('api-keys-list');
  if (!container) return;
  
  if (apiKeys.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--gray-500);">
        <p>No API keys created yet.</p>
        <button class="btn btn-primary" onclick="showCreateApiKeyModal()" style="margin-top: 16px;">Create Your First API Key</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <table class="api-keys-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="text-align: left; border-bottom: 1px solid var(--gray-200);">
          <th style="padding: 12px;">Name</th>
          <th style="padding: 12px;">Key</th>
          <th style="padding: 12px;">Scopes</th>
          <th style="padding: 12px;">Created</th>
          <th style="padding: 12px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${apiKeys.map(key => `
          <tr style="border-bottom: 1px solid var(--gray-100);">
            <td style="padding: 12px; font-weight: 500;">${key.name}</td>
            <td style="padding: 12px; font-family: monospace; color: var(--gray-500);">${key.keyPrefix}</td>
            <td style="padding: 12px;">${key.scopes?.length || 0} scopes</td>
            <td style="padding: 12px; color: var(--gray-500);">${key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td style="padding: 12px;">
              <button class="btn btn-secondary" onclick="deleteApiKey(${key.id})" style="padding: 6px 12px; font-size: 0.875rem;">Revoke</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <button class="btn btn-primary" onclick="showCreateApiKeyModal()" style="margin-top: 20px;">Add New API Key</button>
  `;
}

function showCreateApiKeyModal() {
  const modal = document.getElementById('provider-modal');
  const title = document.getElementById('provider-modal-title');
  const content = document.getElementById('provider-modal-content');
  
  title.textContent = 'Create API Key';
  
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Key Name</label>
      <input type="text" class="form-input" id="new-key-name" placeholder="e.g., Production API Key">
    </div>
    <div class="form-group">
      <label class="form-label">Rate Limit (requests/min)</label>
      <input type="number" class="form-input" id="new-key-ratelimit" value="100" min="1" max="10000">
    </div>
    <div class="form-group">
      <label class="form-label">Scopes</label>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <label style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" class="scope-checkbox" value="tools:read" checked> Tools Read
        </label>
        <label style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" class="scope-checkbox" value="tools:execute" checked> Tools Execute
        </label>
        <label style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" class="scope-checkbox" value="prompts:read" checked> Prompts Read
        </label>
        <label style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" class="scope-checkbox" value="resources:read" checked> Resources Read
        </label>
        <label style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" class="scope-checkbox" value="sampling" checked> Sampling
        </label>
        <label style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" class="scope-checkbox" value="settings:read"> Settings Read
        </label>
        <label style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" class="scope-checkbox" value="settings:write"> Settings Write
        </label>
      </div>
    </div>
    <div style="display: flex; gap: 12px; margin-top: 24px;">
      <button class="btn btn-secondary" onclick="closeModal('provider-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="createApiKey()">Create API Key</button>
    </div>
  `;
  
  modal.classList.add('active');
}

async function createApiKey() {
  const name = document.getElementById('new-key-name').value.trim();
  const rateLimit = parseInt(document.getElementById('new-key-ratelimit').value) || 100;
  const scopes = Array.from(document.querySelectorAll('.scope-checkbox:checked')).map(cb => cb.value);
  
  if (!name) {
    showNotification('Please enter a name for the API key', 'error');
    return;
  }
  
  try {
    const result = await apiRequest('/api/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, scopes, rateLimit })
    });
    
    closeModal('provider-modal');
    
    showNotification('API key created successfully!', 'success');
    addLog('success', `API key "${name}" created`);
    
    const keyModal = document.getElementById('tool-modal');
    document.getElementById('tool-modal-title').textContent = 'API Key Created';
    document.getElementById('tool-modal-content').innerHTML = `
      <p style="margin-bottom: 16px; color: var(--gray-600);">
        Your new API key has been created. <strong>Copy it now</strong> - you won't be able to see it again!
      </p>
      <div style="background: var(--gray-100); padding: 16px; border-radius: var(--radius); font-family: monospace; word-break: break-all;">
        ${result.apiKey.key}
      </div>
      <button class="btn btn-primary" style="margin-top: 16px;" onclick="copyToClipboard('${result.apiKey.key}'); closeModal('tool-modal');">
        Copy to Clipboard
      </button>
    `;
    keyModal.classList.add('active');
    
    loadSettings();
  } catch (error) {
    showNotification(`Failed to create API key: ${error.message}`, 'error');
    addLog('error', `Failed to create API key: ${error.message}`);
  }
}

async function deleteApiKey(id) {
  if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
    return;
  }
  
  try {
    await apiRequest(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    showNotification('API key revoked', 'success');
    addLog('info', 'API key revoked');
    loadSettings();
  } catch (error) {
    showNotification(`Failed to revoke API key: ${error.message}`, 'error');
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Copied to clipboard!', 'success');
  }).catch(() => {
    showNotification('Failed to copy to clipboard', 'error');
  });
}

function configureProvider(providerId) {
  const modal = document.getElementById('provider-modal');
  const title = document.getElementById('provider-modal-title');
  const content = document.getElementById('provider-modal-content');
  
  const provider = state.providers.find(p => p.name === providerId) || {};
  
  title.textContent = `Configure ${providerId.charAt(0).toUpperCase() + providerId.slice(1)}`;
  
  if (providerId === 'openai') {
    content.innerHTML = `
      <p style="color: var(--gray-600); margin-bottom: 20px;">
        OpenAI is configured automatically through Replit AI Integrations. No API key required!
      </p>
      <div class="form-group">
        <label class="form-label">Default Model</label>
        <select class="form-select" id="openai-model">
          <option value="gpt-4o-mini" ${provider.defaultModel === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini (Fast)</option>
          <option value="gpt-4o" ${provider.defaultModel === 'gpt-4o' ? 'selected' : ''}>GPT-4o (Powerful)</option>
          <option value="gpt-4-turbo" ${provider.defaultModel === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
        </select>
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button class="btn btn-secondary" onclick="closeModal('provider-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="saveProviderSettings('${providerId}')">Save Settings</button>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="form-group">
        <label class="form-label">API Key</label>
        <input type="password" class="form-input" id="${providerId}-apikey" placeholder="Enter your API key" value="${provider.hasCustomKey ? '••••••••••••' : ''}">
        <p style="color: var(--gray-500); font-size: 0.75rem; margin-top: 4px;">
          Leave blank to keep existing key
        </p>
      </div>
      <div class="form-group">
        <label class="form-label">Default Model</label>
        <select class="form-select" id="${providerId}-model">
          ${providerId === 'anthropic' ? `
            <option value="claude-3-5-sonnet-20241022" ${provider.defaultModel === 'claude-3-5-sonnet-20241022' ? 'selected' : ''}>Claude 3.5 Sonnet</option>
            <option value="claude-3-opus-20240229" ${provider.defaultModel === 'claude-3-opus-20240229' ? 'selected' : ''}>Claude 3 Opus</option>
            <option value="claude-3-haiku-20240307" ${provider.defaultModel === 'claude-3-haiku-20240307' ? 'selected' : ''}>Claude 3 Haiku</option>
          ` : `
            <option value="gemini-1.5-flash" ${provider.defaultModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro" ${provider.defaultModel === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro</option>
          `}
        </select>
      </div>
      <div class="form-group">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="${providerId}-enabled" ${provider.isEnabled !== false ? 'checked' : ''}>
          Enable this provider
        </label>
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button class="btn btn-secondary" onclick="closeModal('provider-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="saveProviderSettings('${providerId}')">Save Settings</button>
      </div>
    `;
  }
  
  modal.classList.add('active');
}

async function saveProviderSettings(providerId) {
  const data = {};
  
  if (providerId === 'openai') {
    data.defaultModel = document.getElementById('openai-model').value;
  } else {
    const apiKeyInput = document.getElementById(`${providerId}-apikey`);
    const apiKey = apiKeyInput.value;
    if (apiKey && !apiKey.includes('••••')) {
      data.apiKey = apiKey;
    }
    data.defaultModel = document.getElementById(`${providerId}-model`).value;
    data.isEnabled = document.getElementById(`${providerId}-enabled`).checked;
  }
  
  try {
    await apiRequest(`/api/settings/providers/${providerId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    closeModal('provider-modal');
    showNotification(`${providerId} settings saved successfully!`, 'success');
    addLog('success', `Provider ${providerId} configured`);
    loadSettings();
  } catch (error) {
    showNotification(`Failed to save settings: ${error.message}`, 'error');
    addLog('error', `Failed to save ${providerId} settings`);
  }
}

async function testProvider(providerId) {
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Testing...';
  btn.disabled = true;
  
  try {
    const result = await apiRequest(`/api/settings/providers/${providerId}/test`, {
      method: 'POST'
    });
    
    if (result.success) {
      showNotification(`${providerId} is working! Response: "${result.response || 'Success'}"`, 'success');
      addLog('success', `Provider ${providerId} test successful`);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showNotification(`Failed to connect to ${providerId}: ${error.message}`, 'error');
    addLog('error', `Provider ${providerId} test failed: ${error.message}`);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function loadLogsPage() {
  const container = document.getElementById('activity-logs-container');
  if (!container) return;
  
  container.innerHTML = '<p style="color: var(--gray-500);">Loading activity logs...</p>';
  
  try {
    const logs = await loadActivityLogs();
    
    if (logs.length === 0) {
      container.innerHTML = '<p style="color: var(--gray-500);">No activity logs yet.</p>';
      return;
    }
    
    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="text-align: left; border-bottom: 1px solid var(--gray-200);">
            <th style="padding: 12px;">Time</th>
            <th style="padding: 12px;">Type</th>
            <th style="padding: 12px;">Action</th>
            <th style="padding: 12px;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr style="border-bottom: 1px solid var(--gray-100);">
              <td style="padding: 12px; color: var(--gray-500); font-size: 0.875rem;">${new Date(log.timestamp).toLocaleString()}</td>
              <td style="padding: 12px;"><span class="badge badge-${log.type}">${log.type}</span></td>
              <td style="padding: 12px;">${log.action}</td>
              <td style="padding: 12px; color: var(--gray-500); font-size: 0.875rem;">${JSON.stringify(log.details || {})}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    container.innerHTML = `<p style="color: var(--danger);">Failed to load activity logs: ${error.message}</p>`;
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${type === 'success' ? 'var(--accent)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};
    color: white;
    padding: 16px 24px;
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: 2000;
    animation: slideIn 0.3s ease;
    max-width: 400px;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function getToolFormFields(tool) {
  const toolForms = {
    'ai_chat': [
      { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Enter your message...', required: true },
      { name: 'provider', label: 'AI Provider', type: 'select', options: ['openai', 'anthropic', 'gemini'], default: 'openai' }
    ],
    'ai_summarize': [
      { name: 'text', label: 'Text to Summarize', type: 'textarea', placeholder: 'Paste the text you want to summarize...', required: true },
      { name: 'provider', label: 'AI Provider', type: 'select', options: ['openai', 'anthropic', 'gemini'], default: 'openai' }
    ],
    'ai_providers': [],
    'web_search': [
      { name: 'query', label: 'Search Query', type: 'text', placeholder: 'Enter search terms...', required: true }
    ],
    'code_sandbox': [
      { name: 'code', label: 'JavaScript Code', type: 'textarea', placeholder: 'Enter JavaScript code to execute...', required: true }
    ],
    'generate_uuid': [
      { name: 'count', label: 'Number of UUIDs', type: 'number', placeholder: '1', default: '1' }
    ],
    'timestamp': [],
    'json_format': [
      { name: 'json', label: 'JSON to Format', type: 'textarea', placeholder: '{"key": "value"}', required: true }
    ],
    'base64': [
      { name: 'text', label: 'Text', type: 'textarea', placeholder: 'Enter text...', required: true },
      { name: 'action', label: 'Action', type: 'select', options: ['encode', 'decode'], default: 'encode' }
    ]
  };
  
  return toolForms[tool.name] || [];
}

function renderToolForm(tool) {
  const fields = getToolFormFields(tool);
  
  if (fields.length === 0) {
    return `
      <p style="margin-bottom: 20px; color: var(--gray-600);">${tool.description}</p>
      <p style="color: var(--gray-500); font-style: italic;">This tool requires no input parameters.</p>
    `;
  }
  
  let formHtml = `<p style="margin-bottom: 20px; color: var(--gray-600);">${tool.description}</p>`;
  
  fields.forEach(field => {
    formHtml += `<div class="form-group">`;
    formHtml += `<label class="form-label">${field.label}${field.required ? ' *' : ''}</label>`;
    
    if (field.type === 'textarea') {
      formHtml += `<textarea class="form-input tool-field" data-field="${field.name}" rows="4" placeholder="${field.placeholder || ''}">${field.default || ''}</textarea>`;
    } else if (field.type === 'select') {
      formHtml += `<select class="form-select tool-field" data-field="${field.name}">`;
      field.options.forEach(opt => {
        formHtml += `<option value="${opt}" ${opt === field.default ? 'selected' : ''}>${opt}</option>`;
      });
      formHtml += `</select>`;
    } else if (field.type === 'number') {
      formHtml += `<input type="number" class="form-input tool-field" data-field="${field.name}" placeholder="${field.placeholder || ''}" value="${field.default || ''}">`;
    } else {
      formHtml += `<input type="text" class="form-input tool-field" data-field="${field.name}" placeholder="${field.placeholder || ''}" value="${field.default || ''}">`;
    }
    
    formHtml += `</div>`;
  });
  
  return formHtml;
}

async function showToolModal(toolName) {
  const tool = state.tools.find(t => t.name === toolName);
  if (!tool) return;
  
  const modal = document.getElementById('tool-modal');
  document.getElementById('tool-modal-title').textContent = tool.name;
  document.getElementById('tool-modal-content').innerHTML = `
    ${renderToolForm(tool)}
    <div id="tool-result" style="display: none; margin-top: 20px;">
      <label class="form-label">Result</label>
      <pre style="background: var(--gray-100); padding: 16px; border-radius: var(--radius); overflow-x: auto; max-height: 300px;"></pre>
    </div>
  `;
  
  modal.classList.add('active');
}

async function executeCurrentTool() {
  const toolName = document.getElementById('tool-modal-title').textContent;
  const resultEl = document.getElementById('tool-result');
  
  const args = {};
  document.querySelectorAll('.tool-field').forEach(field => {
    const fieldName = field.dataset.field;
    let value = field.value;
    
    if (field.type === 'number' && value) {
      value = parseInt(value, 10);
    }
    
    if (value) {
      args[fieldName] = value;
    }
  });
  
  try {
    showNotification('Executing tool...', 'info');
    const result = await executeTool(toolName, args);
    resultEl.style.display = 'block';
    resultEl.querySelector('pre').textContent = JSON.stringify(result, null, 2);
    showNotification('Tool executed successfully!', 'success');
  } catch (error) {
    resultEl.style.display = 'block';
    resultEl.querySelector('pre').textContent = `Error: ${error.message}`;
    showNotification(`Tool failed: ${error.message}`, 'error');
  }
}

function handleSearch(query) {
  const searchResults = document.getElementById('search-results');
  const searchGrid = document.getElementById('search-results-grid');
  
  if (!query || query.length < 2) {
    if (searchResults) searchResults.style.display = 'none';
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  
  const matchingTools = state.tools.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) || 
    t.description.toLowerCase().includes(lowerQuery) ||
    (t.category && t.category.toLowerCase().includes(lowerQuery))
  );
  
  const matchingResources = state.resources.filter(r =>
    r.name.toLowerCase().includes(lowerQuery) ||
    r.description.toLowerCase().includes(lowerQuery)
  );
  
  if (matchingTools.length === 0 && matchingResources.length === 0) {
    if (searchResults) searchResults.style.display = 'none';
    return;
  }
  
  if (searchResults && searchGrid) {
    searchResults.style.display = 'block';
    
    const categoryIcons = { ai: '🤖', search: '🔍', code: '💻', utility: '🔧' };
    
    let html = matchingTools.map(tool => `
      <div class="tool-card" onclick="showToolModal('${tool.name}')">
        <div class="tool-card-header">
          <div class="tool-card-icon">${categoryIcons[tool.category] || '⚡'}</div>
          <div class="tool-card-info">
            <h3>${tool.name}</h3>
            <span class="tool-card-category">${tool.category} tool</span>
          </div>
        </div>
        <p class="tool-card-description">${tool.description}</p>
      </div>
    `).join('');
    
    html += matchingResources.map(resource => `
      <div class="tool-card" onclick="showResourceModal('${resource.uri}')">
        <div class="tool-card-header">
          <div class="tool-card-icon">📦</div>
          <div class="tool-card-info">
            <h3>${resource.name}</h3>
            <span class="tool-card-category">Resource</span>
          </div>
        </div>
        <p class="tool-card-description">${resource.description}</p>
      </div>
    `).join('');
    
    searchGrid.innerHTML = html;
    
    if (state.currentPage !== 'tools') {
      navigate('tools');
    }
  }
}

function clearSearch() {
  const searchInput = document.getElementById('global-search');
  const searchResults = document.getElementById('search-results');
  
  if (searchInput) searchInput.value = '';
  if (searchResults) searchResults.style.display = 'none';
}

async function sendPlaygroundMessage() {
  const input = document.getElementById('playground-input');
  const provider = document.getElementById('playground-provider')?.value || 'openai';
  const messagesContainer = document.getElementById('playground-messages');
  
  const message = input.value.trim();
  if (!message) return;
  
  input.value = '';
  
  messagesContainer.innerHTML += `
    <div class="chat-message user">
      <strong>You:</strong> ${message}
    </div>
  `;
  
  state.chatMessages.push({ role: 'user', content: message });
  
  try {
    await apiRequest('/api/settings/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: state.chatSessionId,
        provider,
        role: 'user',
        content: message
      })
    });
  } catch (e) {
    console.warn('Failed to save user message:', e);
  }
  
  messagesContainer.innerHTML += `
    <div class="chat-message assistant thinking" id="thinking-indicator">
      <strong>AI:</strong> Thinking...
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    const result = await apiRequest('/mcp/sampling/create', {
      method: 'POST',
      body: JSON.stringify({
        messages: state.chatMessages,
        provider
      })
    });
    
    document.getElementById('thinking-indicator')?.remove();
    
    const assistantMessage = result.content?.text || result.content || 'No response';
    state.chatMessages.push({ role: 'assistant', content: assistantMessage });
    
    messagesContainer.innerHTML += `
      <div class="chat-message assistant">
        <strong>AI (${result.model || provider}):</strong> ${assistantMessage}
      </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
      await apiRequest('/api/settings/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: state.chatSessionId,
          provider,
          model: result.model,
          role: 'assistant',
          content: assistantMessage
        })
      });
    } catch (e) {
      console.warn('Failed to save assistant message:', e);
    }
    
    addLog('success', `AI response received from ${provider}`);
  } catch (error) {
    document.getElementById('thinking-indicator')?.remove();
    messagesContainer.innerHTML += `
      <div class="chat-message error">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
    addLog('error', `AI request failed: ${error.message}`);
  }
}

function clearPlayground() {
  state.chatMessages = [];
  state.chatSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const container = document.getElementById('playground-messages');
  if (container) {
    container.innerHTML = '<p style="color: var(--gray-500); text-align: center;">Start a conversation...</p>';
  }
  addLog('info', 'Chat cleared');
}

async function saveServerSettings() {
  const rateLimit = parseInt(document.getElementById('server-rate-limit')?.value) || 100;
  const cors = document.getElementById('server-cors')?.value || '*';
  
  try {
    await apiRequest('/api/settings/server', {
      method: 'PATCH',
      body: JSON.stringify({
        rateLimit: { max: rateLimit },
        security: { corsOrigins: cors }
      })
    });
    
    showNotification('Server settings saved successfully!', 'success');
    addLog('success', 'Server settings updated');
  } catch (error) {
    showNotification(`Failed to save settings: ${error.message}`, 'error');
    addLog('error', 'Failed to save server settings');
  }
}

function showSettingsTab(tab) {
  document.querySelectorAll('#page-settings .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-settings .settings-section').forEach(s => s.style.display = 'none');
  
  event.target.classList.add('active');
  document.getElementById(`settings-${tab}`).style.display = 'block';
  
  if (tab === 'api') {
    loadApiKeys();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
  
  const playgroundInput = document.getElementById('playground-input');
  if (playgroundInput) {
    playgroundInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPlaygroundMessage();
      }
    });
  }
  
  addLog('info', 'Application initialized');
  addLog('info', 'Connected to MCP server');
  
  loadTools().then(() => updateToolCount());
  
  navigate('home');
});

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  .chat-message {
    padding: 12px 16px;
    margin-bottom: 12px;
    border-radius: var(--radius);
    background: var(--gray-100);
  }
  .chat-message.user {
    background: var(--primary);
    color: white;
    margin-left: 20%;
  }
  .chat-message.assistant {
    background: var(--gray-100);
    margin-right: 20%;
  }
  .chat-message.error {
    background: var(--danger);
    color: white;
  }
  .chat-message.thinking {
    opacity: 0.7;
    font-style: italic;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  .badge-api_key { background: #e0f2fe; color: #0369a1; }
  .badge-settings { background: #fef3c7; color: #92400e; }
  .badge-test { background: #d1fae5; color: #065f46; }
  .badge-error { background: #fee2e2; color: #b91c1c; }
`;
document.head.appendChild(style);
