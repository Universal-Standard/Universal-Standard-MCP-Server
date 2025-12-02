const API_BASE = '';
const API_KEY = 'demo-api-key';

const state = {
  currentPage: 'home',
  tools: [],
  prompts: [],
  resources: [],
  providers: [],
  settings: {
    openai: { enabled: true, model: 'gpt-4o-mini' },
    anthropic: { enabled: false, apiKey: '' },
    gemini: { enabled: false, apiKey: '' }
  },
  logs: []
};

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
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

async function loadCapabilities() {
  try {
    return await apiRequest('/mcp/capabilities');
  } catch (error) {
    console.error('Failed to load capabilities:', error);
    return null;
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

async function testAIProvider(provider) {
  try {
    const result = await apiRequest('/mcp/sampling/create', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say "Hello from ' + provider + '!" in exactly those words.' }],
        provider: provider
      })
    });
    addLog('success', `${provider} provider test successful`);
    return result;
  } catch (error) {
    addLog('error', `${provider} provider test failed: ${error.message}`);
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
  if (page === 'services') loadServices();
  if (page === 'settings') loadSettings();
}

function getPageTitle(page) {
  const titles = {
    home: 'Welcome',
    dashboard: 'Dashboard',
    services: 'Services',
    settings: 'Settings',
    about: 'About'
  };
  return titles[page] || 'US-SPURS MCP Server';
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
    const [tools, prompts, resources] = await Promise.all([
      loadTools(),
      loadPrompts(),
      loadResources()
    ]);
    
    document.getElementById('stat-tools').textContent = tools.length;
    document.getElementById('stat-prompts').textContent = prompts.length;
    document.getElementById('stat-resources').textContent = resources.length;
  }
}

async function loadServices() {
  const [tools, prompts, resources] = await Promise.all([
    loadTools(),
    loadPrompts(),
    loadResources()
  ]);
  
  renderToolsGrid(tools);
  renderPromptsGrid(prompts);
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

function loadSettings() {
  updateProviderCards();
}

function updateProviderCards() {
  const providers = [
    { id: 'openai', name: 'OpenAI', logo: 'O', configured: true },
    { id: 'anthropic', name: 'Anthropic Claude', logo: 'A', configured: state.settings.anthropic.apiKey !== '' },
    { id: 'gemini', name: 'Google Gemini', logo: 'G', configured: state.settings.gemini.apiKey !== '' }
  ];
  
  const container = document.getElementById('providers-list');
  if (!container) return;
  
  container.innerHTML = providers.map(provider => `
    <div class="provider-card">
      <div class="provider-header">
        <div class="provider-info">
          <div class="provider-logo ${provider.id}">${provider.logo}</div>
          <span class="provider-name">${provider.name}</span>
        </div>
        <div class="provider-status ${provider.configured ? 'active' : 'inactive'}">
          <span class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: currentColor;"></span>
          ${provider.configured ? 'Configured' : 'Not Configured'}
        </div>
      </div>
      <div class="provider-actions" style="display: flex; gap: 12px;">
        <button class="btn btn-secondary" onclick="configureProvider('${provider.id}')">Configure</button>
        <button class="btn btn-primary" onclick="testProvider('${provider.id}')" ${!provider.configured ? 'disabled' : ''}>Test Connection</button>
      </div>
    </div>
  `).join('');
}

function configureProvider(providerId) {
  const modal = document.getElementById('provider-modal');
  const title = document.getElementById('provider-modal-title');
  const content = document.getElementById('provider-modal-content');
  
  title.textContent = `Configure ${providerId.charAt(0).toUpperCase() + providerId.slice(1)}`;
  
  if (providerId === 'openai') {
    content.innerHTML = `
      <p style="color: var(--gray-600); margin-bottom: 20px;">
        OpenAI is configured automatically through Replit AI Integrations. No API key required!
      </p>
      <div class="form-group">
        <label class="form-label">Default Model</label>
        <select class="form-select" id="openai-model">
          <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
          <option value="gpt-4o">GPT-4o (Powerful)</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
        </select>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="form-group">
        <label class="form-label">API Key</label>
        <input type="password" class="form-input" id="${providerId}-apikey" placeholder="Enter your API key">
      </div>
      <p style="color: var(--gray-500); font-size: 0.875rem;">
        Your API key is stored securely and never shared.
      </p>
    `;
  }
  
  modal.classList.add('active');
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

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
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
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

async function showToolModal(toolName) {
  const tool = state.tools.find(t => t.name === toolName);
  if (!tool) return;
  
  const modal = document.getElementById('tool-modal');
  document.getElementById('tool-modal-title').textContent = tool.name;
  document.getElementById('tool-modal-content').innerHTML = `
    <p style="margin-bottom: 20px; color: var(--gray-600);">${tool.description}</p>
    <div class="form-group">
      <label class="form-label">Input Parameters (JSON)</label>
      <textarea class="form-input" id="tool-input" rows="5" placeholder='{"key": "value"}'></textarea>
    </div>
    <div id="tool-result" style="display: none;">
      <label class="form-label">Result</label>
      <pre style="background: var(--gray-100); padding: 16px; border-radius: var(--radius); overflow-x: auto;"></pre>
    </div>
  `;
  
  modal.classList.add('active');
}

async function executeCurrentTool() {
  const toolName = document.getElementById('tool-modal-title').textContent;
  const inputEl = document.getElementById('tool-input');
  const resultEl = document.getElementById('tool-result');
  
  let args = {};
  try {
    if (inputEl.value.trim()) {
      args = JSON.parse(inputEl.value);
    }
  } catch (e) {
    showNotification('Invalid JSON input', 'error');
    return;
  }
  
  try {
    const result = await executeTool(toolName, args);
    resultEl.style.display = 'block';
    resultEl.querySelector('pre').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultEl.style.display = 'block';
    resultEl.querySelector('pre').textContent = `Error: ${error.message}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
  
  addLog('info', 'Application initialized');
  addLog('info', 'Connected to MCP server');
  
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
`;
document.head.appendChild(style);
