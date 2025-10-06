const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
	flags: {
		rewriterLogs: false,
		scramitize: false,
		cleanErrors: true,
		sourcemaps: true,
	},
});

scramjet.init();
navigator.serviceWorker.register("./sw.js");

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const flex = css`
	display: flex;
`;
const col = css`
	flex-direction: column;
`;

// Centralized transport application helper
function applyTransport(transport) {
	let args = [];
	switch (transport) {
		case "/baremod/index.mjs":
			args = [store.bareurl];
			break;
		case "/libcurl/index.mjs":
			args = [{ wisp: store.wispurl }];
			break;
		case "/epoxy/index.mjs":
			args = [{ wisp: store.wispurl }];
			break;
		default:
			args = [{ wisp: store.wispurl }];
	}
	connection.setTransport(transport, args);
	store.transport = transport;

	// Ensure frames start using the new transport immediately
	try {
		for (const tab of window.novaTabs.tabs) {
			const frame = window.novaTabs.frames[tab.id];
			if (!frame) continue;
			if (tab.url && tab.url.length > 0) {
				// Re-navigate to current URL so subsequent requests use the new transport
				frame.go(tab.url);
			}
		}
	} catch {}
}

// Initialize selected transport with Epoxy as default
const supportedTransports = [
	"/baremod/index.mjs",
	"/libcurl/index.mjs",
	"/epoxy/index.mjs",
];
const defaultTransport = "/epoxy/index.mjs";
if (!store.transport || !supportedTransports.includes(store.transport)) {
	store.transport = defaultTransport;
}
applyTransport(store.transport);

// Simple global state for tabs
window.novaTabs = {
	tabs: [
		{
			id: 'tab-1',
			title: 'NovaNet',
			url: '',
			active: true,
				favicon: '🌌',
				initialized: false
		}
	],
	activeTabId: 'tab-1',
	nextTabId: 2,
	frames: {} // Store frames separately
};

function Config() {
	this.css = `
    transition: all var(--transition-normal);
    :modal[open] {
        animation: fadeIn 0.4s ease normal;
    }

    :modal::backdrop {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        background: rgba(0, 0, 0, 0.7);
    }

    .modal-content {
        background: var(--bg-elevated);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-primary);
        box-shadow: var(--shadow-lg);
        padding: var(--spacing-xl);
        max-width: 500px;
        width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-lg);
        padding-bottom: var(--spacing-md);
        border-bottom: 1px solid var(--border-primary);
    }

    .modal-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.5rem;
        cursor: pointer;
        padding: var(--spacing-sm);
        border-radius: var(--radius-sm);
        transition: all var(--transition-fast);
    }

    .close-btn:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .section {
        margin-bottom: var(--spacing-lg);
    }

    .section-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: var(--spacing-md);
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
    }

    .transport-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
    }

    .transport-btn {
        background: var(--bg-tertiary);
        border: 2px solid var(--border-primary);
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        padding: var(--spacing-md);
        cursor: pointer;
        transition: all var(--transition-fast);
        text-align: center;
        font-size: 0.9rem;
        font-weight: 500;
    }

    .transport-btn:hover {
        border-color: var(--accent-primary);
        color: var(--text-primary);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
    }

    .transport-btn.active {
        border-color: var(--accent-primary);
        background: var(--accent-primary);
        color: var(--bg-primary);
        box-shadow: var(--shadow-glow);
    }

    .input-group {
        margin-bottom: var(--spacing-md);
    }

    .input-label {
        display: block;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: var(--spacing-sm);
    }

    .input-field {
        width: 100%;
        background: var(--bg-tertiary);
        border: 2px solid var(--border-primary);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        padding: var(--spacing-md);
        font-size: 0.9rem;
        transition: all var(--transition-fast);
        outline: none;
    }

    .input-field:focus {
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
    }

    .status-indicator {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-md);
        background: var(--bg-tertiary);
        border-radius: var(--radius-md);
        margin-top: var(--spacing-md);
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent-primary);
        animation: pulse 2s infinite;
    }

    .status-text {
        font-size: 0.9rem;
        color: var(--text-secondary);
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-md);
        margin-top: var(--spacing-xl);
        padding-top: var(--spacing-md);
        border-top: 1px solid var(--border-primary);
    }

    .btn {
        padding: var(--spacing-md) var(--spacing-lg);
        border-radius: var(--radius-md);
        font-weight: 500;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all var(--transition-fast);
        border: none;
      outline: none;
    }

    .btn-primary {
        background: var(--accent-gradient);
        color: var(--bg-primary);
        box-shadow: var(--shadow-sm);
    }

    .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
    }

    .btn-secondary {
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border: 1px solid var(--border-primary);
    }

    .btn-secondary:hover {
        background: var(--bg-elevated);
        border-color: var(--border-secondary);
    }
  `;

	function handleModalClose(modal) {
		modal.style.opacity = 0;
		modal.style.transform = 'scale(0.95)';
		setTimeout(() => {
			modal.close();
			modal.style.opacity = 1;
			modal.style.transform = 'scale(1)';
		}, 200);
	}

	const getTransportName = (transport) => {
		const names = {
			"/baremod/index.mjs": "Bare Server 3",
			"/libcurl/index.mjs": "LibCurl.js",
			"/epoxy/index.mjs": "Epoxy"
		};
		return names[transport] || transport;
	};

	return html`
      <dialog class="cfg">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">⚙️ Settings</h2>
            <button class="close-btn" on:click=${() => handleModalClose(this.root)}>×</button>
          </div>

          <div class="section">
            <h3 class="section-title">🌐 Transport Method</h3>
            <div class="transport-grid">
              <button class="transport-btn ${use(store.transport) === "/baremod/index.mjs" ? "active" : ""}" 
                      on:click=${() => applyTransport("/baremod/index.mjs")}>
                Bare Server 3
              </button>
              <button class="transport-btn ${use(store.transport) === "/libcurl/index.mjs" ? "active" : ""}" 
                      on:click=${() => applyTransport("/libcurl/index.mjs")}>
                LibCurl.js
              </button>
              <button class="transport-btn ${use(store.transport) === "/epoxy/index.mjs" ? "active" : ""}" 
                      on:click=${() => applyTransport("/epoxy/index.mjs")}>
                Epoxy
              </button>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">🔗 Connection URLs</h3>
            <div class="input-group">
              <label class="input-label" for="wisp_url_input">Wisp URL</label>
              <input class="input-field" id="wisp_url_input" bind:value=${use(store.wispurl)} spellcheck="false" placeholder="wss://example.com"></input>
            </div>
            <div class="input-group">
              <label class="input-label" for="bare_url_input">Bare URL</label>
              <input class="input-field" id="bare_url_input" bind:value=${use(store.bareurl)} spellcheck="false" placeholder="https://example.com"></input>
          </div>
        </div>

          <div class="status-indicator">
            <div class="status-dot"></div>
            <span class="status-text">Active: ${getTransportName(store.transport)}</span>
        </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" on:click=${() => handleModalClose(this.root)}>Close</button>
        </div>
        </div>
      </dialog>
  `;
}

function BrowserApp() {
	// Simple tab management
	this.tabs = window.novaTabs.tabs;
	this.activeTabId = window.novaTabs.activeTabId;
	
	// Get or create frame for active tab
	if (!window.novaTabs.frames[this.activeTabId]) {
		window.novaTabs.frames[this.activeTabId] = scramjet.createFrame();
	}
	this.frame = window.novaTabs.frames[this.activeTabId];

	// Pretty-print proxied URLs in the input; ignore internal proxied endpoints
	const extractDisplayUrl = (rawUrl) => {
		if (!rawUrl) return '';
		try {
			if (rawUrl.startsWith('data:')) return '';
			let candidate = rawUrl;
			const marker = '/scramjet/';
			const idx = rawUrl.indexOf(marker);
			if (idx !== -1) {
				const enc = rawUrl.slice(idx + marker.length);
				try { candidate = decodeURIComponent(enc); } catch { candidate = enc; }
			}
			const u = new URL(candidate);
			// If candidate resolves to our deployment host, it's an internal proxied fetch; don't show
			if (u.host === location.host) return '';
			return u.href;
		} catch {
			return '';
		}
	};

	// Helper to attach urlchange listeners per frame/tab (once)
	const attachFrameListeners = (tabId, frame) => {
		if (frame.__novaAttached) return;
		frame.addEventListener("urlchange", (e) => {
			if (!e.url) return;
        const tab = window.novaTabs.tabs.find(t => t.id === tabId);
        if (!tab) return;
        const display = extractDisplayUrl(e.url);
        if (display) {
            tab.url = display; // store destination URL for future navigations
        }
        tab.initialized = true;
			if (display) {
				try { tab.title = new URL(display).hostname || 'NovaNet'; } catch { tab.title = 'NovaNet'; }
				if (window.novaTabs.activeTabId === tabId) {
					this.url = display;
					const input = this.root?.querySelector('.url-bar');
					if (input) input.value = this.url;
				}
			}
		});
		frame.__novaAttached = true;
	};

	attachFrameListeners(this.activeTabId, this.frame);

	// Initialize visible URL from active tab
	try {
    const active = window.novaTabs.tabs.find(t => t.id === this.activeTabId);
    this.url = active?.url ? extractDisplayUrl(active.url) : '';
	} catch { this.url = ''; }

	this.css = `
    width: 100%;
    height: 100%;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    box-sizing: border-box;

    a {
      color: var(--accent-primary);
      text-decoration: none;
      transition: all var(--transition-fast);
    }

    a:hover {
      color: var(--accent-secondary);
    }

    input, button {
      font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .browser-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-primary);
    }

    .tab-bar {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-primary);
      display: flex;
      align-items: center;
      padding: 0 var(--spacing-sm);
      min-height: 40px;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-primary);
      border-bottom: none;
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
      min-width: 120px;
      max-width: 200px;
      position: relative;
      margin-right: 2px;
    }

    .tab:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }

    .tab.active {
      background: var(--bg-primary);
      color: var(--text-primary);
      border-color: var(--accent-primary);
      box-shadow: 0 -2px 0 var(--accent-primary);
    }

    .tab-favicon {
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .tab-title {
      font-size: 0.85rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .tab-close {
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      padding: 2px;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      opacity: 0;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .tab:hover .tab-close {
      opacity: 1;
    }

    .tab-close:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }

    .new-tab-btn {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      padding: var(--spacing-sm) var(--spacing-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: 1.2rem;
      margin-left: var(--spacing-sm);
      flex-shrink: 0;
    }

    .new-tab-btn:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
      border-color: var(--accent-primary);
    }

    .tab-dropdown {
      position: relative;
      margin-left: var(--spacing-sm);
    }

    .tab-dropdown-btn {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      padding: var(--spacing-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: 0.9rem;
    }

    .tab-dropdown-btn:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }

    .tab-dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      min-width: 200px;
      z-index: 1000;
      display: none;
    }

    .tab-dropdown-menu.show {
      display: block;
    }

    .tab-dropdown-item {
      padding: var(--spacing-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      border-bottom: 1px solid var(--border-primary);
    }

    .tab-dropdown-item:last-child {
      border-bottom: none;
    }

    .tab-dropdown-item:hover {
      background: var(--bg-tertiary);
    }

    .navbar {
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-primary);
      padding: var(--spacing-md) var(--spacing-lg);
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      position: relative;
      z-index: 10;
    }

    .nav-group {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .nav-btn {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      padding: var(--spacing-sm) var(--spacing-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: 0.9rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      min-width: 40px;
      justify-content: center;
    }

    .nav-btn:hover {
      background: var(--bg-elevated);
      border-color: var(--border-secondary);
      color: var(--text-primary);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .nav-btn:active {
      transform: translateY(0);
    }

    .nav-btn.primary {
      background: var(--accent-gradient);
      border-color: var(--accent-primary);
      color: var(--bg-primary);
      box-shadow: var(--shadow-sm);
    }

    .nav-btn.primary:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    .url-bar-container {
      flex: 1;
      position: relative;
      margin: 0 var(--spacing-md);
    }

    .url-bar {
      width: 100%;
      background: var(--bg-tertiary);
      border: 2px solid var(--border-primary);
      border-radius: var(--radius-lg);
      color: var(--text-primary);
      padding: var(--spacing-md) var(--spacing-lg);
      font-size: 0.95rem;
      font-weight: 400;
      transition: all var(--transition-fast);
      outline: none;
      box-shadow: var(--shadow-sm);
    }

    .url-bar:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1), var(--shadow-md);
      background: var(--bg-elevated);
    }

    .url-bar::placeholder {
      color: var(--text-tertiary);
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-primary);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-primary);
      animation: pulse 2s infinite;
    }

    .version-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
    }

    .version-badge {
      background: var(--accent-gradient);
      color: var(--bg-primary);
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .browser-frame {
      flex: 1;
      background: var(--bg-primary);
      border: none;
      border-radius: 0;
      position: relative;
      overflow: hidden;
    }

    .frame-layer {
      position: absolute;
      inset: 0;
    }

    .frame-layer.hidden {
      visibility: hidden;
      pointer-events: none;
    }

    .browser-frame iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
      border-radius: 0;
    }

    .welcome-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
      padding: var(--spacing-2xl);
      text-align: center;
    }

    .welcome-logo {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: var(--spacing-lg);
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .welcome-subtitle {
      font-size: 1.2rem;
      color: var(--text-secondary);
      margin-bottom: var(--spacing-xl);
      max-width: 500px;
      line-height: 1.6;
    }

    .welcome-features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-lg);
      margin-top: var(--spacing-xl);
      max-width: 600px;
    }

    .feature-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-lg);
      padding: var(--spacing-lg);
      text-align: center;
      transition: all var(--transition-normal);
    }

    .feature-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: var(--accent-primary);
    }

    .feature-icon {
      font-size: 2rem;
      margin-bottom: var(--spacing-md);
    }

    .feature-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--spacing-sm);
    }

    .feature-description {
      font-size: 0.9rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md);
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--border-primary);
      border-top: 2px solid var(--accent-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .navbar {
        padding: var(--spacing-sm) var(--spacing-md);
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      .url-bar-container {
        order: 3;
        flex-basis: 100%;
        margin: var(--spacing-sm) 0 0 0;
      }

      .welcome-features {
        grid-template-columns: 1fr;
        gap: var(--spacing-md);
      }

      .welcome-logo {
        font-size: 2rem;
      }

      .welcome-subtitle {
        font-size: 1rem;
      }
    }
  `;
	this.url = store.url;

	// Simple tab management methods
	this.createTab = (url = '') => {
		const newTab = {
			id: `tab-${window.novaTabs.nextTabId++}`,
			title: 'New Tab',
			url: url,
			active: false,
			favicon: '🌌',
			initialized: false
		};
		window.novaTabs.tabs.push(newTab);
		window.novaTabs.activeTabId = newTab.id;
		window.novaTabs.tabs.forEach(tab => tab.active = false);
		newTab.active = true;
		// Create frame for new tab and mount welcome screen if no URL
		const newFrame = scramjet.createFrame();
		window.novaTabs.frames[newTab.id] = newFrame;
		// attach listeners for this frame/tab
		try { (function(tabId, frame, self){
			if (frame.__novaAttached) return;
			frame.addEventListener("urlchange", (e) => {
				if (!e.url) return;
				const tab = window.novaTabs.tabs.find(t => t.id === tabId);
				if (!tab) return;
				tab.url = e.url;
				tab.initialized = true;
				try { tab.title = new URL((()=>{try{const m='/scramjet/';const i=e.url.indexOf(m);if(i!==-1){const enc=e.url.slice(i+m.length);return decodeURIComponent(enc)}return e.url}catch{return e.url}})()).hostname || 'NovaNet'; } catch { tab.title = 'NovaNet'; }
				if (window.novaTabs.activeTabId === tabId) {
					self.url = (()=>{try{const m='/scramjet/';const i=e.url.indexOf(m);if(i!==-1){const enc=e.url.slice(i+m.length);return decodeURIComponent(enc)}return e.url}catch{return e.url}})();
					const input = self.root?.querySelector('.url-bar');
					if (input) input.value = self.url;
				}
			});
			frame.__novaAttached = true;
		})(newTab.id, newFrame, this);} catch {}
		if (!newTab.url) {
			// Use full NovaNet welcome screen for brand consistency
			const welcomeHTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to NovaNet</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#0a0a0a 0%,#111 100%);color:#fff;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem}.logo{font-size:3rem;font-weight:700;margin-bottom:1.5rem;background:linear-gradient(135deg,#00d4ff 0%,#0099cc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.subtitle{font-size:1.2rem;color:#a0a0a0;margin-bottom:2rem;max-width:500px;line-height:1.6}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;margin-top:2rem;max-width:600px}.feature{background:#1e1e1e;border:1px solid #333;border-radius:16px;padding:1.5rem;transition:all .3s ease}.feature:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.2);border-color:#00d4ff}.feature-icon{font-size:2rem;margin-bottom:1rem}.feature-title{font-size:1.1rem;font-weight:600;margin-bottom:.5rem}.feature-desc{font-size:.9rem;color:#a0a0a0;line-height:1.5}</style></head><body><div class="logo">NovaNet</div><div class="subtitle">Your gateway to the unrestricted web. Browse freely with advanced proxy technology and cutting-edge design.</div><div class="features"><div class="feature"><div class="feature-icon">⚡</div><div class="feature-title">Nova Speed</div><div class="feature-desc">Lightning-fast browsing with next-gen proxy technology</div></div><div class="feature"><div class="feature-icon">🛡️</div><div class="feature-title">Secure Network</div><div class="feature-desc">Advanced encryption keeps your data completely private</div></div><div class="feature"><div class="feature-icon">🌌</div><div class="feature-title">Infinite Access</div><div class="feature-desc">Explore the entire web without restrictions or barriers</div></div></div></body></html>`;
			const encoded = btoa(unescape(encodeURIComponent(welcomeHTML)));
			newFrame.go(`data:text/html;base64,${encoded}`);
			newTab.initialized = true;
		}
		// Force re-render by replacing this component's root
		if (this.root && this.root.parentElement) {
			this.root.replaceWith(h(BrowserApp));
		}
	};

	this.switchToTab = (tabId) => {
		// Update state
		window.novaTabs.tabs.forEach(tab => tab.active = false);
		const tab = window.novaTabs.tabs.find(tab => tab.id === tabId);
		if (tab) {
			tab.active = true;
			window.novaTabs.activeTabId = tabId;
		}
		// Toggle frame layers without re-rendering and update URL bar
		const container = this.root?.querySelector('.browser-frame');
		if (container) {
			for (const layer of container.querySelectorAll('.frame-layer')) {
				const isActive = layer.getAttribute('data-tab-id') === tabId;
				layer.classList.toggle('hidden', !isActive);
			}
		}
		// Update active frame reference and input value
		const newFrame = window.novaTabs.frames[tabId];
		if (newFrame) {
			this.frame = newFrame;
		}
		const active = window.novaTabs.tabs.find(t => t.id === tabId);
		if (active) {
			// pretty display
			(function(self){
				try {
					if (!active.url) { self.url = ''; }
					else {
						const m = '/scramjet/';
						const i = active.url.indexOf(m);
						self.url = i !== -1 ? decodeURIComponent(active.url.slice(i + m.length)) : active.url;
					}
				} catch { self.url = active.url || ''; }
			})(this);
			const input = this.root?.querySelector('.url-bar');
			if (input) input.value = this.url;
		}
	};

	this.closeTab = (tabId) => {
		if (window.novaTabs.tabs.length <= 1) return;
		
		const tabIndex = window.novaTabs.tabs.findIndex(tab => tab.id === tabId);
		if (tabIndex === -1) return;
		
		const wasActive = window.novaTabs.tabs[tabIndex].active;
		window.novaTabs.tabs.splice(tabIndex, 1);
		delete window.novaTabs.frames[tabId];
		
		if (wasActive) {
			const nextTab = window.novaTabs.tabs[Math.min(tabIndex, window.novaTabs.tabs.length - 1)];
			if (nextTab) {
				nextTab.active = true;
				window.novaTabs.activeTabId = nextTab.id;
			}
		}
		// Force re-render by replacing this component's root
		if (this.root && this.root.parentElement) {
			this.root.replaceWith(h(BrowserApp));
		}
	};

	this.mount = () => {
		// Only show welcome screen for tabs that haven't navigated yet
		const activeTab = window.novaTabs.tabs.find(tab => tab.id === this.activeTabId);
		if (!activeTab || activeTab.initialized || (activeTab.url && activeTab.url.length > 0)) {
			return;
		}
		const welcomeHTML = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Welcome to NovaNet</title>
				<style>
					* { margin: 0; padding: 0; box-sizing: border-box; }
					body {
						font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
						background: linear-gradient(135deg, #0a0a0a 0%, #111111 100%);
						color: #ffffff;
						height: 100vh;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						text-align: center;
						padding: 2rem;
					}
					.logo {
						font-size: 3rem;
						font-weight: 700;
						margin-bottom: 1.5rem;
						background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
						background-clip: text;
					}
					.subtitle {
						font-size: 1.2rem;
						color: #a0a0a0;
						margin-bottom: 2rem;
						max-width: 500px;
						line-height: 1.6;
					}
					.features {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
						gap: 1.5rem;
						margin-top: 2rem;
						max-width: 600px;
					}
					.feature {
						background: #1e1e1e;
						border: 1px solid #333333;
						border-radius: 16px;
						padding: 1.5rem;
						text-align: center;
						transition: all 0.3s ease;
					}
					.feature:hover {
						transform: translateY(-4px);
						box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
						border-color: #00d4ff;
					}
					.feature-icon {
						font-size: 2rem;
						margin-bottom: 1rem;
					}
					.feature-title {
						font-size: 1.1rem;
						font-weight: 600;
						margin-bottom: 0.5rem;
					}
					.feature-desc {
						font-size: 0.9rem;
						color: #a0a0a0;
						line-height: 1.5;
					}
					.cta {
						margin-top: 2rem;
						padding: 1rem 2rem;
						background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
						color: #0a0a0a;
						border: none;
						border-radius: 12px;
						font-size: 1rem;
						font-weight: 600;
						cursor: pointer;
						transition: all 0.3s ease;
					}
					.cta:hover {
						transform: translateY(-2px);
						box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
					}
				</style>
			</head>
			<body>
				<div class="logo">NovaNet</div>
				<div class="subtitle">
					Your gateway to the unrestricted web. Browse freely with advanced proxy technology and cutting-edge design.
				</div>
				<div class="features">
					<div class="feature">
						<div class="feature-icon">⚡</div>
						<div class="feature-title">Nova Speed</div>
						<div class="feature-desc">Lightning-fast browsing with next-gen proxy technology</div>
					</div>
					<div class="feature">
						<div class="feature-icon">🛡️</div>
						<div class="feature-title">Secure Network</div>
						<div class="feature-desc">Advanced encryption keeps your data completely private</div>
					</div>
					<div class="feature">
						<div class="feature-icon">🌌</div>
						<div class="feature-title">Infinite Access</div>
						<div class="feature-desc">Explore the entire web without restrictions or barriers</div>
					</div>
				</div>
				<button class="cta" onclick="parent.focus()">Start Browsing</button>
			</body>
			</html>
		`;
		
		// Use encodeURIComponent to handle Unicode characters properly
		const encodedHTML = btoa(unescape(encodeURIComponent(welcomeHTML)));
		this.frame.go(`data:text/html;base64,${encodedHTML}`);
	};

	const handleSubmit = () => {
		this.url = this.url.trim();
		if (!this.url.startsWith("http")) {
			this.url = "https://" + this.url;
		}

		// Update the active tab (store raw proxied URL after navigation via listener)
		const activeTab = window.novaTabs.tabs.find(tab => tab.id === this.activeTabId);
		if (activeTab) {
			activeTab.title = 'Loading...';
			activeTab.initialized = true;
		}
		
		return this.frame.go(this.url);
	};

	// Per-frame listeners already update state and input; no duplicate listener here

	const cfg = h(Config);
	document.body.appendChild(cfg);
	this.githubURL = `https://github.com/MercuryWorkshop/scramjet/commit/${$scramjetVersion.build}`;

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey || e.metaKey) {
			switch(e.key) {
				case 't':
					e.preventDefault();
					this.createTab();
					break;
				case 'w':
					e.preventDefault();
					if (window.novaTabs.tabs.length > 1) {
						this.closeTab(this.activeTabId);
					}
					break;
				case 'Tab':
					e.preventDefault();
					const currentIndex = window.novaTabs.tabs.findIndex(tab => tab.id === this.activeTabId);
					const nextIndex = e.shiftKey 
						? (currentIndex - 1 + window.novaTabs.tabs.length) % window.novaTabs.tabs.length
						: (currentIndex + 1) % window.novaTabs.tabs.length;
					this.switchToTab(window.novaTabs.tabs[nextIndex].id);
					break;
			}
		}
	});

	// Close dropdown when clicking outside
	document.addEventListener('click', (e) => {
		const dropdown = this.root?.querySelector('.tab-dropdown');
		if (dropdown && !dropdown.contains(e.target)) {
			const menu = dropdown.querySelector('.tab-dropdown-menu');
			menu?.classList.remove('show');
		}
	});

	return html`
      <div class="browser-container">
        <div class="tab-bar">
          ${window.novaTabs.tabs.map(tab => html`
            <div class="tab ${tab.active ? 'active' : ''}" 
                 on:click=${() => this.switchToTab(tab.id)}>
              <span class="tab-favicon">${tab.favicon}</span>
              <span class="tab-title">${tab.title}</span>
              <button class="tab-close" 
                      on:click=${(e) => {
                        e.stopPropagation();
                        this.closeTab(tab.id);
                      }}>×</button>
            </div>
          `)}
          <button class="new-tab-btn" on:click=${() => this.createTab()} title="New Tab">
            +
          </button>
          <div class="tab-dropdown">
            <button class="tab-dropdown-btn" on:click=${(e) => {
              e.stopPropagation();
              const menu = e.target.parentElement.querySelector('.tab-dropdown-menu');
              menu.classList.toggle('show');
            }}>⋯</button>
            <div class="tab-dropdown-menu">
              ${window.novaTabs.tabs.map(tab => html`
                <div class="tab-dropdown-item" on:click=${() => this.switchToTab(tab.id)}>
                  ${tab.favicon} ${tab.title}
                </div>
              `)}
            </div>
          </div>
        </div>

        <div class="navbar">
          <div class="nav-group">
            <button class="nav-btn" on:click=${() => cfg.showModal()} title="Settings">
              ⚙️
            </button>
            <button class="nav-btn" on:click=${() => this.frame.back()} title="Go Back">
              ←
            </button>
            <button class="nav-btn" on:click=${() => this.frame.forward()} title="Go Forward">
              →
            </button>
            <button class="nav-btn" on:click=${() => this.frame.reload()} title="Reload">
              ↻
            </button>
          </div>

          <div class="url-bar-container">
            <input 
              class="url-bar" 
              autocomplete="off" 
              autocapitalize="off" 
              autocorrect="off" 
              spellcheck="false"
              placeholder="Enter a URL to browse..."
              bind:value=${use(this.url)} 
              on:input=${(e) => {
					this.url = e.target.value;
              }} 
              on:keyup=${(e) => e.keyCode == 13 && (store.url = this.url) && handleSubmit()}
            />
          </div>

          <div class="nav-group">
            <button class="nav-btn primary" on:click=${() => window.open(scramjet.encodeUrl(this.url))} title="Open in New Tab">
              🔗
            </button>
          </div>

          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Connected</span>
          </div>

          <div class="version-info">
            <span class="version-badge">NovaNet v${$scramjetVersion.version}</span>
            <a href=${use(this.githubURL)} target="_blank" title="View on GitHub">
              ${$scramjetVersion.build.substring(0, 7)}
            </a>
          </div>
      </div>

        <div class="browser-frame">
          ${window.novaTabs.tabs.map(tab => html` 
            <div class="frame-layer ${tab.id === this.activeTabId ? '' : 'hidden'}" data-tab-id="${tab.id}">
              ${window.novaTabs.frames[tab.id]?.frame || ''}
            </div>
          `)}
        </div>
    </div>
    `;
}
window.addEventListener("load", async () => {
	const root = document.getElementById("app");
	try {
		root.replaceWith(h(BrowserApp));
	} catch (e) {
		root.replaceWith(document.createTextNode("" + e));
		throw e;
	}
	function b64(buffer) {
		let binary = "";
		const bytes = new Uint8Array(buffer);
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}

		return btoa(binary);
	}
	const arraybuffer = await (await fetch("/assets/scramjet.png")).arrayBuffer();
	console.log(
		"%cNovaNet",
		`
      background-image: url(data:image/png;base64,${b64(arraybuffer)});
      color: transparent;
      padding-left: 200px;
      padding-bottom: 100px;
      background-size: contain;
      background-position: center center;
      background-repeat: no-repeat;
      font-size: 24px;
      font-weight: bold;
  `
	);
});
