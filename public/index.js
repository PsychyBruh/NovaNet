"use strict";

// Global state
let currentTabId = 'home';
let tabCounter = 1;
let tabs = new Map();
let history = new Map();
let currentHistoryIndex = new Map();

// Cookie Management System
class CookieManager {
	constructor() {
		this.cookieStore = new Map();
		this.loadCookies();
	}

	// Load cookies from localStorage
	loadCookies() {
		try {
			const stored = localStorage.getItem('novanet_cookies');
			if (stored) {
				const parsed = JSON.parse(stored);
				this.cookieStore = new Map(Object.entries(parsed));
			}
		} catch (error) {
			console.warn('Failed to load cookies:', error);
		}
	}

	// Save cookies to localStorage
	saveCookies() {
		try {
			const obj = Object.fromEntries(this.cookieStore);
			localStorage.setItem('novanet_cookies', JSON.stringify(obj));
		} catch (error) {
			console.warn('Failed to save cookies:', error);
		}
	}

	// Set a cookie
	setCookie(domain, name, value, options = {}) {
		if (!this.cookieStore.has(domain)) {
			this.cookieStore.set(domain, new Map());
		}
		
		const domainCookies = this.cookieStore.get(domain);
		domainCookies.set(name, {
			value: value,
			domain: domain,
			path: options.path || '/',
			expires: options.expires,
			secure: options.secure || false,
			httpOnly: options.httpOnly || false,
			sameSite: options.sameSite || 'Lax'
		});
		
		this.saveCookies();
	}

	// Get a cookie
	getCookie(domain, name) {
		const domainCookies = this.cookieStore.get(domain);
		if (!domainCookies) return null;
		
		const cookie = domainCookies.get(name);
		if (!cookie) return null;
		
		// Check if cookie has expired
		if (cookie.expires && new Date() > new Date(cookie.expires)) {
			domainCookies.delete(name);
			this.saveCookies();
			return null;
		}
		
		return cookie.value;
	}

	// Get all cookies for a domain
	getCookiesForDomain(domain) {
		const domainCookies = this.cookieStore.get(domain);
		if (!domainCookies || !domainCookies.entries) return {};
		
		const cookies = {};
		try {
			for (const [name, cookie] of domainCookies) {
				// Check if cookie has expired
				if (cookie.expires && new Date() > new Date(cookie.expires)) {
					domainCookies.delete(name);
					continue;
				}
				cookies[name] = cookie.value;
			}
		} catch (error) {
			console.warn('Error iterating cookies for domain:', domain, error);
			return {};
		}
		
		this.saveCookies();
		return cookies;
	}

	// Delete a cookie
	deleteCookie(domain, name) {
		const domainCookies = this.cookieStore.get(domain);
		if (domainCookies) {
			domainCookies.delete(name);
			this.saveCookies();
		}
	}

	// Clear all cookies
	clearAllCookies() {
		this.cookieStore.clear();
		this.saveCookies();
	}

	// Get cookie string for requests
	getCookieString(domain) {
		try {
			const cookies = this.getCookiesForDomain(domain);
			if (!cookies || typeof cookies !== 'object') return '';
			
			return Object.entries(cookies)
				.map(([name, value]) => `${name}=${value}`)
				.join('; ');
		} catch (error) {
			console.warn('Error generating cookie string for domain:', domain, error);
			return '';
		}
	}

	// Parse cookies from response headers
	parseSetCookieHeaders(domain, setCookieHeaders) {
		if (!setCookieHeaders) return;
		
		const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
		
		headers.forEach(header => {
			const parts = header.split(';');
			const [nameValue] = parts;
			const [name, value] = nameValue.split('=');
			
			if (!name || !value) return;
			
			const options = {};
			parts.slice(1).forEach(part => {
				const [key, val] = part.trim().split('=');
				const keyLower = key.toLowerCase();
				
				switch (keyLower) {
					case 'domain':
						options.domain = val;
						break;
					case 'path':
						options.path = val;
						break;
					case 'expires':
						options.expires = val;
						break;
					case 'max-age':
						options.expires = new Date(Date.now() + parseInt(val) * 1000).toUTCString();
						break;
					case 'secure':
						options.secure = true;
						break;
					case 'httponly':
						options.httpOnly = true;
						break;
					case 'samesite':
						options.sameSite = val;
						break;
				}
			});
			
			this.setCookie(domain, name.trim(), value.trim(), options);
		});
	}
}

// Initialize cookie manager
const cookieManager = new CookieManager();

// DOM elements
const form = document.getElementById("nn-form");
const address = document.getElementById("nn-address");
const searchEngine = document.getElementById("nn-search-engine");
const error = document.getElementById("nn-error");
const errorCode = document.getElementById("nn-error-code");
const errorContainer = document.getElementById("nn-error-container");

// Initialize Scramjet
const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: '/scram/scramjet.wasm.wasm',
		all: '/scram/scramjet.all.js',
		sync: '/scram/scramjet.sync.js',
	},
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// Tab Management
class TabManager {
	constructor() {
		this.tabs = new Map();
		this.currentTabId = 'home';
		this.tabCounter = 1;
		this.history = new Map();
		this.currentHistoryIndex = new Map();
	}

	createTab(url = null, title = 'New Tab') {
		const tabId = `tab-${this.tabCounter++}`;
		const tabElement = this.createTabElement(tabId, title);
		
		// Add tab to DOM
		const tabsContainer = document.querySelector('.tabs-container');
		const newTabBtn = document.querySelector('.new-tab-btn');
		tabsContainer.insertBefore(tabElement, newTabBtn);
		
		// Create tab content
		const tabContent = this.createTabContent(tabId, url);
		document.querySelector('.main-content').appendChild(tabContent);
		
		// Initialize history for this tab
		this.history.set(tabId, []);
		this.currentHistoryIndex.set(tabId, -1);
		
		// Store tab data
		this.tabs.set(tabId, {
			element: tabElement,
			content: tabContent,
			title: title,
			url: url,
			loading: false
		});
		
		// Switch to new tab
		this.switchToTab(tabId);
		
		return tabId;
	}

	createTabElement(tabId, title) {
		const tab = document.createElement('div');
		tab.className = 'tab';
		tab.setAttribute('data-tab-id', tabId);
		
		tab.innerHTML = `
			<span class="tab-title">${title}</span>
			<button class="tab-close" onclick="closeTab(event, '${tabId}')">×</button>
		`;
		
		tab.addEventListener('click', (e) => {
			if (!e.target.classList.contains('tab-close')) {
				this.switchToTab(tabId);
			}
		});
		
		return tab;
	}

	createTabContent(tabId, url) {
		const content = document.createElement('div');
		content.id = `tab-${tabId}`;
		content.className = 'tab-panel';
		
		if (url) {
			// Create iframe for web content
			const iframe = document.createElement('iframe');
			iframe.id = `nn-frame-${tabId}`;
			iframe.style.cssText = `
				border: none;
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: var(--background);
			`;
			content.appendChild(iframe);
		} else {
			// Create welcome screen for new tabs
			content.innerHTML = `
				<div class="welcome-screen">
					<div class="logo-section">
						<div class="logo-container">
							<h1>NovaNet</h1>
							<p class="tagline">Secure Web Proxy</p>
						</div>
					</div>
					<div class="description">
						<p>Enter a URL or search term to start browsing securely.</p>
					</div>
				</div>
			`;
		}
		
		return content;
	}

	switchToTab(tabId) {
		// Update active tab
		document.querySelectorAll('.tab').forEach(tab => {
			tab.classList.remove('active');
		});
		document.querySelectorAll('.tab-panel').forEach(content => {
			content.classList.remove('active');
		});
		
		const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
		const tabContent = document.getElementById(`tab-${tabId}`);
		
		if (tabElement && tabContent) {
			tabElement.classList.add('active');
			tabContent.classList.add('active');
			this.currentTabId = tabId;
			
			// Update address bar with current URL
			const tab = this.tabs.get(tabId);
			if (tab && tab.url) {
				address.value = tab.url;
			} else {
				address.value = '';
			}
			
			// Try to get the current URL from the iframe if available
			try {
				const iframe = document.getElementById(`nn-frame-${tabId}`);
				if (iframe && iframe.contentDocument) {
					let currentUrl = iframe.contentDocument.location.href;
					if (currentUrl && currentUrl !== 'about:blank') {
						// Clean up the URL - remove proxy encoding if present
						try {
							if (currentUrl.includes('/scramjet/')) {
								const urlMatch = currentUrl.match(/\/scramjet\/(.+)$/);
								if (urlMatch) {
									currentUrl = decodeURIComponent(urlMatch[1]);
									if (currentUrl.includes('%')) {
										currentUrl = decodeURIComponent(currentUrl);
									}
								}
							}
						} catch (error) {
							console.warn('Error cleaning URL in switchToTab:', error);
						}
						address.value = currentUrl;
					}
				}
			} catch (error) {
				// Cross-origin restrictions - use stored URL
			}
		}
	}

	closeTab(event, tabId) {
		event.stopPropagation();
		
		if (this.tabs.size <= 1) {
			return; // Don't close the last tab
		}
		
		const tab = this.tabs.get(tabId);
		if (tab) {
			// Remove from DOM
			tab.element.remove();
			tab.content.remove();
			
			// Remove from state
			this.tabs.delete(tabId);
			this.history.delete(tabId);
			this.currentHistoryIndex.delete(tabId);
			
			// Switch to another tab if this was active
			if (this.currentTabId === tabId) {
				const remainingTabs = Array.from(this.tabs.keys());
				this.switchToTab(remainingTabs[0]);
			}
		}
	}

	updateTabTitle(tabId, title) {
		const tab = this.tabs.get(tabId);
		if (tab) {
			tab.title = title;
			const titleElement = tab.element.querySelector('.tab-title');
			if (titleElement) {
				titleElement.textContent = title;
			}
		}
	}

	updateTabUrl(tabId, url) {
		const tab = this.tabs.get(tabId);
		if (tab) {
			tab.url = url;
		}
	}

	addToHistory(tabId, url) {
		if (!this.history.has(tabId)) {
			this.history.set(tabId, []);
			this.currentHistoryIndex.set(tabId, -1);
		}
		
		const history = this.history.get(tabId);
		const currentIndex = this.currentHistoryIndex.get(tabId);
		
		// Remove any forward history
		history.splice(currentIndex + 1);
		
		// Add new URL
		history.push(url);
		this.currentHistoryIndex.set(tabId, history.length - 1);
	}
}

// Initialize tab manager
const tabManager = new TabManager();

// Navigation functions
function goBack() {
	const history = tabManager.history.get(tabManager.currentTabId);
	const currentIndex = tabManager.currentHistoryIndex.get(tabManager.currentTabId);
	
	if (currentIndex > 0) {
		const newIndex = currentIndex - 1;
		const url = history[newIndex];
		tabManager.currentHistoryIndex.set(tabManager.currentTabId, newIndex);
		navigateToUrl(url);
	}
}

function goForward() {
	const history = tabManager.history.get(tabManager.currentTabId);
	const currentIndex = tabManager.currentHistoryIndex.get(tabManager.currentTabId);
	
	if (currentIndex < history.length - 1) {
		const newIndex = currentIndex + 1;
		const url = history[newIndex];
		tabManager.currentHistoryIndex.set(tabManager.currentTabId, newIndex);
		navigateToUrl(url);
	}
}

function refresh() {
	const tab = tabManager.tabs.get(tabManager.currentTabId);
	if (tab && tab.url) {
		navigateToUrl(tab.url);
	}
}

function createNewTab() {
	tabManager.createTab();
}

function closeTab(event, tabId) {
	tabManager.closeTab(event, tabId);
}

function navigateTo(url) {
	// If we're on the home tab, create a new tab for navigation
	if (tabManager.currentTabId === 'home') {
		const newTabId = tabManager.createTab(url, 'Loading...');
		navigateToUrl(url, newTabId);
	} else {
		navigateToUrl(url);
	}
}

async function navigateToUrl(url, tabId = null) {
	const targetTabId = tabId || tabManager.currentTabId;

	try {
		await registerSW();
	} catch (err) {
		showError("Failed to register service worker.", err.toString());
		return;
	}

	const searchUrl = search(url, searchEngine.value);
	const domain = new URL(searchUrl).hostname;
	
	// Add to history
	tabManager.addToHistory(targetTabId, url);
	
	// Update tab
	tabManager.updateTabUrl(targetTabId, url);
	tabManager.updateTabTitle(targetTabId, 'Loading...');
	
	// Show loading state
	const tab = tabManager.tabs.get(targetTabId);
	if (tab) {
		tab.loading = true;
	}
	
	// Create iframe if it doesn't exist
	let iframe = document.getElementById(`nn-frame-${targetTabId}`);
	if (!iframe) {
		const tabContent = document.getElementById(`tab-${targetTabId}`);
		if (tabContent) {
			tabContent.innerHTML = '';
			iframe = document.createElement('iframe');
			iframe.id = `nn-frame-${targetTabId}`;
			iframe.style.cssText = `
				border: none;
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: var(--background);
			`;
			tabContent.appendChild(iframe);
		}
	}
	
	// Set up iframe load handler with cookie management and URL monitoring
	iframe.onload = () => {
		tabManager.updateTabTitle(targetTabId, iframe.contentDocument?.title || url);
		const tab = tabManager.tabs.get(targetTabId);
		if (tab) {
			tab.loading = false;
		}
		
		// Try to inject cookies into the iframe
		try {
			const cookies = cookieManager.getCookieString(domain);
			if (cookies && iframe.contentDocument) {
				// Set cookies in the iframe's document
				document.cookie = cookies;
			}
		} catch (error) {
			console.warn('Could not inject cookies into iframe:', error);
		}
		
		// Inject URL monitoring script into iframe
		try {
			if (iframe.contentDocument) {
				const script = iframe.contentDocument.createElement('script');
				script.textContent = `
					(function() {
						let lastUrl = window.location.href;
						let lastTitle = document.title;
						
						// Suppress Instagram WebSocket errors and hide proxy origin
						if (window.location.hostname.includes('instagram.com')) {
							// Hide the proxy origin from Instagram
							Object.defineProperty(window, 'location', {
								value: {
									...window.location,
									hostname: 'www.instagram.com',
									host: 'www.instagram.com',
									origin: 'https://www.instagram.com',
									protocol: 'https:',
									port: ''
								},
								writable: false,
								configurable: false
							});
							
							// Override document.domain to hide proxy
							Object.defineProperty(document, 'domain', {
								value: 'instagram.com',
								writable: false,
								configurable: false
							});
							
							const originalConsoleError = console.error;
							console.error = function(...args) {
								const message = args.join(' ');
								// Suppress specific Instagram WebSocket errors
								if (message.includes('LSPlatformRealtimeTransport.Timeout') ||
									message.includes('IGDThreadDetailMainViewOffMsysQuery') ||
									message.includes('RE_EXN_ID') ||
									message.includes('CAUGHT ERROR') ||
									message.includes('attempted to fetch from same origin')) {
									return; // Suppress these errors
								}
								originalConsoleError.apply(console, args);
							};
							
							// Override fetch to handle requests better
							const originalFetch = window.fetch;
							window.fetch = function(url, options) {
								// Handle Instagram's MQTT endpoints
								if (url.includes('edge-chat.instagram.com/mqtt')) {
									return Promise.resolve(new Response('', {
										status: 200,
										statusText: 'OK',
										headers: new Headers({
											'Content-Type': 'text/plain'
										})
									}));
								}
								
								// Prevent requests to localhost/proxy origin
								if (url.includes('localhost:8080') || url.includes('127.0.0.1:8080')) {
									console.warn('Blocked request to proxy origin:', url);
									return Promise.resolve(new Response('', {
										status: 200,
										statusText: 'OK',
										headers: new Headers({
											'Content-Type': 'application/json'
										})
									}));
								}
								
								return originalFetch.apply(this, arguments);
							};
							
							// Override XMLHttpRequest to prevent same-origin detection
							const originalXHROpen = XMLHttpRequest.prototype.open;
							XMLHttpRequest.prototype.open = function(method, url, ...args) {
								// Block requests to localhost/proxy origin
								if (url.includes('localhost:8080') || url.includes('127.0.0.1:8080')) {
									console.warn('Blocked XHR request to proxy origin:', url);
									this._blocked = true;
									return;
								}
								return originalXHROpen.call(this, method, url, ...args);
							};
							
							const originalXHRSend = XMLHttpRequest.prototype.send;
							XMLHttpRequest.prototype.send = function(data) {
								if (this._blocked) {
									// Simulate successful response
									setTimeout(() => {
										if (this.onreadystatechange) {
											this.readyState = 4;
											this.status = 200;
											this.responseText = '{}';
											this.onreadystatechange();
										}
									}, 100);
									return;
								}
								return originalXHRSend.call(this, data);
							};
						}
						
						function checkUrlChange() {
							const currentUrl = window.location.href;
							const currentTitle = document.title;
							
							if (currentUrl !== lastUrl || currentTitle !== lastTitle) {
								lastUrl = currentUrl;
								lastTitle = currentTitle;
								
								// Send message to parent window
								window.parent.postMessage({
									type: 'urlChange',
									url: currentUrl,
									title: currentTitle
								}, '*');
							}
						}
						
						// Check for URL changes periodically
						setInterval(checkUrlChange, 500);
						
						// Also listen for navigation events
						window.addEventListener('popstate', checkUrlChange);
						window.addEventListener('pushstate', checkUrlChange);
						window.addEventListener('replacestate', checkUrlChange);
						
						// Override history methods to catch programmatic navigation
						const originalPushState = history.pushState;
						const originalReplaceState = history.replaceState;
						
						history.pushState = function() {
							originalPushState.apply(history, arguments);
							setTimeout(checkUrlChange, 100);
						};
						
						history.replaceState = function() {
							originalReplaceState.apply(history, arguments);
							setTimeout(checkUrlChange, 100);
						};
					})();
				`;
				iframe.contentDocument.head.appendChild(script);
			}
		} catch (error) {
			console.warn('Could not inject scripts into iframe:', error);
		}
		
		// Set up URL monitoring for this iframe
		setupUrlMonitoring(iframe, targetTabId, domain);
		
		// Add iframe error handling for better connection stability
		iframe.onerror = () => {
			console.warn('Iframe load error, attempting to reload...');
			if (connectionRetries < maxRetries) {
				connectionRetries++;
				setTimeout(() => {
					if (iframe.src) {
						iframe.src = iframe.src; // Reload the iframe
					}
				}, 2000);
			} else {
				showError("Connection failed after multiple attempts. Please try again.", "");
			}
		};
		
		// Monitor iframe connection health
		const healthCheck = setInterval(() => {
			try {
				if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
					// Iframe is healthy
					return;
				}
			} catch (error) {
				// Cross-origin or other issues - this is normal for some sites
			}
		}, 5000);
		
		// Set a timeout for iframe loading
		const loadTimeout = setTimeout(() => {
			if (iframe.contentDocument && iframe.contentDocument.readyState !== 'complete') {
				console.warn('Iframe loading timeout, attempting to reload...');
				if (connectionRetries < maxRetries) {
					connectionRetries++;
					iframe.src = iframe.src; // Reload the iframe
				} else {
					showError("Page took too long to load. Please try again.", "");
				}
			}
		}, 30000); // 30 second timeout
		
		// Clean up health check and timeout when iframe loads or is unloaded
		iframe.addEventListener('load', () => {
			clearTimeout(loadTimeout);
		});
		
		iframe.addEventListener('unload', () => {
			clearInterval(healthCheck);
			clearTimeout(loadTimeout);
		});
	};
	
	// Set up postMessage listener for URL updates from iframe
	window.addEventListener('message', (event) => {
		// Check if message is from our iframe
		if (event.source === iframe.contentWindow) {
			if (event.data.type === 'urlChange') {
				let newUrl = event.data.url;
				const newTitle = event.data.title;
				
				// Clean up the URL - remove proxy encoding if present
				try {
					// If the URL contains our proxy encoding, extract the original URL
					if (newUrl.includes('/scramjet/')) {
						const urlMatch = newUrl.match(/\/scramjet\/(.+)$/);
						if (urlMatch) {
							// Decode the URL
							newUrl = decodeURIComponent(urlMatch[1]);
							// If it's still encoded, decode again
							if (newUrl.includes('%')) {
								newUrl = decodeURIComponent(newUrl);
							}
						}
					}
				} catch (error) {
					console.warn('Error cleaning URL:', error);
				}
				
				// Update tab URL and title
				tabManager.updateTabUrl(targetTabId, newUrl);
				tabManager.updateTabTitle(targetTabId, newTitle || 'Loading...');
				
				// Update address bar if this is the active tab
				if (tabManager.currentTabId === targetTabId) {
					address.value = newUrl;
				}
				
				// Add to history
				tabManager.addToHistory(targetTabId, newUrl);
			}
		}
	});
	
	// Set up connection retry mechanism for better stability
	let connectionRetries = 0;
	const maxRetries = 3;
	
	const establishConnection = async () => {
		try {
			let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
	if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
	}
			
			// Enhanced connection settings for Instagram and social media
			if (domain.includes('instagram.com')) {
				// Set up better WebSocket handling for Instagram
				try {
					// Override WebSocket constructor to handle Instagram's MQTT connections
					const originalWebSocket = window.WebSocket;
					window.WebSocket = function(url, protocols) {
						// If it's Instagram's MQTT WebSocket, use a mock connection
						if (url.includes('edge-chat.instagram.com') || url.includes('mqtt')) {
							const mockSocket = {
								readyState: 1, // OPEN
								url: url,
								protocol: protocols,
								extensions: '',
								bufferedAmount: 0,
								onopen: null,
								onclose: null,
								onmessage: null,
								onerror: null,
								close: function() {},
								send: function() {},
								addEventListener: function() {},
								removeEventListener: function() {},
								dispatchEvent: function() { return true; }
							};
							// Simulate connection opening
							setTimeout(() => {
								if (mockSocket.onopen) mockSocket.onopen({ type: 'open' });
							}, 100);
							return mockSocket;
						}
						return new originalWebSocket(url, protocols);
					};
				} catch (error) {
					console.warn('Could not override WebSocket for Instagram:', error);
				}
			}
			
			// Connection health check will be handled by iframe error events
			
			// Special handling for social media sites
			const socialMediaSites = ['instagram.com', 'facebook.com', 'twitter.com', 'discord.com', 'reddit.com'];
			const isSocialMedia = socialMediaSites.some(site => domain.includes(site));
			
			if (isSocialMedia) {
				// Add extra headers and settings for social media sites
				iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation');
				iframe.setAttribute('allow', 'camera; microphone; geolocation; autoplay; encrypted-media');
				
				// Add referrer policy for better compatibility
				iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
				
				// Instagram-specific settings (CSP removed to prevent iframe rejection)
				if (domain.includes('instagram.com')) {
					// Additional Instagram-specific iframe settings can go here
				}
			}
			
			// Load the URL
	const sjEncode = scramjet.encodeUrl.bind(scramjet);
			iframe.src = sjEncode(searchUrl);
			
			// Add connection monitoring for social media sites
			if (isSocialMedia) {
				const connectionMonitor = setInterval(() => {
					try {
						if (iframe.contentDocument && iframe.contentDocument.readyState === 'loading') {
							// Still loading, check for network errors
							setTimeout(() => {
								if (iframe.contentDocument && iframe.contentDocument.readyState === 'loading') {
									console.warn('Slow loading detected, checking connection...');
									// Try to refresh the connection
									if (connectionRetries < maxRetries) {
										connectionRetries++;
										iframe.src = sjEncode(searchUrl);
									}
								}
							}, 10000); // Wait 10 seconds before checking
						}
					} catch (error) {
						// Cross-origin restrictions - this is normal
					}
				}, 5000);
				
				// Clean up monitor when iframe loads
				iframe.addEventListener('load', () => {
					clearInterval(connectionMonitor);
				});
			}
			
		} catch (error) {
			console.error('Connection failed:', error);
			if (connectionRetries < maxRetries) {
				connectionRetries++;
				setTimeout(establishConnection, 2000);
			} else {
				showError("Connection failed. Please try again.", error.toString());
			}
		}
	};
	
	// Start connection
	establishConnection();
	
	// Set up message listener for cookie updates from iframe
	iframe.addEventListener('load', () => {
		try {
			// Listen for cookie changes from the iframe
			const iframeDoc = iframe.contentDocument;
			if (iframeDoc) {
				// Monitor cookie changes
				const originalSetCookie = iframeDoc.cookie;
				const checkCookies = () => {
					if (iframeDoc.cookie !== originalSetCookie) {
						// Cookies have changed, update our storage
						const newCookies = iframeDoc.cookie;
						if (newCookies) {
							const cookiePairs = newCookies.split(';');
							cookiePairs.forEach(pair => {
								const [name, value] = pair.trim().split('=');
								if (name && value) {
									cookieManager.setCookie(domain, name, value);
								}
							});
						}
					}
				};
				
				// Check for cookie changes periodically
				const cookieInterval = setInterval(checkCookies, 1000);
				
				// Clean up interval when iframe is unloaded
				iframe.addEventListener('unload', () => {
					clearInterval(cookieInterval);
				});
			}
		} catch (error) {
			console.warn('Could not monitor cookies in iframe:', error);
		}
	});
}

// URL Monitoring System
function setupUrlMonitoring(iframe, tabId, domain) {
	let lastUrl = '';
	let lastTitle = '';
	
	// Function to update URL and title
	const updateUrlAndTitle = () => {
		try {
			const iframeDoc = iframe.contentDocument;
			if (!iframeDoc) return;
			
			let currentUrl = iframeDoc.location.href;
			const currentTitle = iframeDoc.title;
			
			// Clean up the URL - remove proxy encoding if present
			try {
				// If the URL contains our proxy encoding, extract the original URL
				if (currentUrl.includes('/scramjet/')) {
					const urlMatch = currentUrl.match(/\/scramjet\/(.+)$/);
					if (urlMatch) {
						// Decode the URL
						currentUrl = decodeURIComponent(urlMatch[1]);
						// If it's still encoded, decode again
						if (currentUrl.includes('%')) {
							currentUrl = decodeURIComponent(currentUrl);
						}
					}
				}
			} catch (error) {
				console.warn('Error cleaning URL in updateUrlAndTitle:', error);
			}
			
			// Only update if URL or title has changed
			if (currentUrl !== lastUrl || currentTitle !== lastTitle) {
				lastUrl = currentUrl;
				lastTitle = currentTitle;
				
				// Update tab URL and title
				tabManager.updateTabUrl(tabId, currentUrl);
				tabManager.updateTabTitle(tabId, currentTitle || 'Loading...');
				
				// Update address bar if this is the active tab
				if (tabManager.currentTabId === tabId) {
					address.value = currentUrl;
				}
				
				// Add to history if URL changed
				if (currentUrl !== lastUrl) {
					tabManager.addToHistory(tabId, currentUrl);
				}
			}
		} catch (error) {
			// Cross-origin restrictions - this is expected for some sites
			// We'll use a fallback method
		}
	};
	
	// Monitor URL changes using multiple methods
	const urlMonitor = setInterval(() => {
		updateUrlAndTitle();
	}, 500); // Check every 500ms
	
	// Also listen for iframe navigation events
	iframe.addEventListener('load', () => {
		setTimeout(updateUrlAndTitle, 100); // Small delay to ensure content is loaded
	});
	
	// Clean up when iframe is removed
	const cleanup = () => {
		clearInterval(urlMonitor);
	};
	
	// Store cleanup function for later use
	iframe._urlMonitorCleanup = cleanup;
}

function showError(message, code = '') {
	error.textContent = message;
	errorCode.textContent = code;
	errorContainer.style.display = 'flex';
}

function hideError() {
	errorContainer.style.display = 'none';
}

// Event listeners
form.addEventListener("submit", async (event) => {
	event.preventDefault();
	const url = address.value.trim();
	
	if (url) {
		navigateTo(url);
	}
});

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
	if (event.ctrlKey || event.metaKey) {
		switch (event.key) {
			case 't':
				event.preventDefault();
				createNewTab();
				break;
			case 'w':
				event.preventDefault();
				if (tabManager.currentTabId !== 'home') {
					closeTab(event, tabManager.currentTabId);
				}
				break;
			case 'r':
				event.preventDefault();
				refresh();
				break;
		}
	}
});

// Settings Panel Functions
function toggleSettings() {
	const settingsPanel = document.getElementById('settings-panel');
	const isVisible = settingsPanel.style.display !== 'none';
	
	if (isVisible) {
		settingsPanel.style.display = 'none';
	} else {
		settingsPanel.style.display = 'block';
		updateCookieCount();
	}
}

function updateCookieCount() {
	const totalCookies = Array.from(cookieManager.cookieStore.values())
		.reduce((total, domainCookies) => total + domainCookies.size, 0);
	
	const cookieCountElement = document.getElementById('cookie-count');
	if (cookieCountElement) {
		cookieCountElement.textContent = `${totalCookies} cookies stored`;
	}
}

function viewCookies() {
	const cookieModal = document.getElementById('cookie-modal');
	const cookieList = document.getElementById('cookie-list');
	
	// Clear existing content
	cookieList.innerHTML = '';
	
	// Add cookies to the list
	for (const [domain, domainCookies] of cookieManager.cookieStore) {
		if (domainCookies.size === 0) continue;
		
		const domainDiv = document.createElement('div');
		domainDiv.className = 'cookie-item';
		
		const domainHeader = document.createElement('div');
		domainHeader.className = 'cookie-domain';
		domainHeader.textContent = domain;
		domainDiv.appendChild(domainHeader);
		
		for (const [name, cookie] of domainCookies) {
			const cookieDiv = document.createElement('div');
			cookieDiv.style.marginBottom = '10px';
			
			const cookieName = document.createElement('div');
			cookieName.style.fontWeight = '500';
			cookieName.style.color = 'var(--text-primary)';
			cookieName.style.marginBottom = '4px';
			cookieName.textContent = name;
			cookieDiv.appendChild(cookieName);
			
			const cookieDetails = document.createElement('div');
			cookieDetails.className = 'cookie-details';
			cookieDetails.textContent = `Path: ${cookie.path} | Secure: ${cookie.secure ? 'Yes' : 'No'}`;
			if (cookie.expires) {
				cookieDetails.textContent += ` | Expires: ${new Date(cookie.expires).toLocaleString()}`;
			}
			cookieDiv.appendChild(cookieDetails);
			
			const cookieValue = document.createElement('div');
			cookieValue.className = 'cookie-value';
			cookieValue.textContent = cookie.value;
			cookieDiv.appendChild(cookieValue);
			
			domainDiv.appendChild(cookieDiv);
		}
		
		cookieList.appendChild(domainDiv);
	}
	
	if (cookieList.children.length === 0) {
		cookieList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No cookies stored</p>';
	}
	
	cookieModal.style.display = 'flex';
}

function closeCookieModal() {
	const cookieModal = document.getElementById('cookie-modal');
	cookieModal.style.display = 'none';
}

function clearAllCookies() {
	if (confirm('Are you sure you want to clear all cookies? This will log you out of all websites.')) {
		cookieManager.clearAllCookies();
		updateCookieCount();
		alert('All cookies have been cleared.');
	}
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	// Set up initial home tab
	tabManager.tabs.set('home', {
		element: document.querySelector('[data-tab-id="home"]'),
		content: document.getElementById('tab-home'),
		title: 'Home',
		url: null,
		loading: false
	});
	
	// Initialize history for home tab
	tabManager.history.set('home', []);
	tabManager.currentHistoryIndex.set('home', -1);
	
	// Update cookie count on load
	updateCookieCount();
});
