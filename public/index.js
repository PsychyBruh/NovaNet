"use strict";

// Global state
let currentTabId = 'home';
let tabCounter = 1;
let tabs = new Map();
let history = new Map();
let currentHistoryIndex = new Map();

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
			
			// Update address bar
			const tab = this.tabs.get(tabId);
			if (tab && tab.url) {
				address.value = tab.url;
			} else {
				address.value = '';
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
	
	// Set up iframe load handler
	iframe.onload = () => {
		tabManager.updateTabTitle(targetTabId, iframe.contentDocument?.title || url);
		const tab = tabManager.tabs.get(targetTabId);
		if (tab) {
			tab.loading = false;
		}
	};
	
	// Configure connection and load URL
	let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
	if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
	}
	
	const sjEncode = scramjet.encodeUrl.bind(scramjet);
	iframe.src = sjEncode(searchUrl);
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
});
