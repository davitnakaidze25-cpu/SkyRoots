// components/themeManager.js
// Handles parsing theme_tokens.json, injecting CSS variables, and toggling backgrounds.

const THEME_KEY = 'skyroots_theme_preference';
let activeTheme = 'space'; // default
let tokens = null;

// Initialize the theme engine
export async function initThemeManager() {
    try {
        const response = await fetch('theme_tokens.json');
        tokens = await response.json();
    } catch (err) {
        console.error('Failed to load theme tokens', err);
        return;
    }

    // Load saved preference or default
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && tokens[saved]) {
        activeTheme = saved;
    }

    applyTheme(activeTheme, false); // initial load, no transition
}

export function setTheme(themeName) {
    if (!tokens || !tokens[themeName]) return;
    activeTheme = themeName;
    localStorage.setItem(THEME_KEY, activeTheme);
    applyTheme(activeTheme, true);
}

function applyTheme(themeName, animate) {
    const rootStyle = document.documentElement.style;
    const themeParams = tokens[themeName];

    if (animate) {
        document.body.classList.add('theme-transitioning');
        // cross-fade takes 600ms
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 600);
    }

    // Apply tokens directly to CSS root
    for (const [key, value] of Object.entries(themeParams)) {
        rootStyle.setProperty(key, value);
    }

    // Toggle data attribute on body for specific overrides if needed
    document.body.setAttribute('data-theme', themeName);

    // Toggle background containers visibility
    toggleBackgrounds(themeName);
    
    // Dispatch custom event for UI components to optionally react
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: themeName } }));
}

function toggleBackgrounds(themeName) {
    const spaceEl = document.getElementById('starfield');
    const nebulas = document.querySelectorAll('.nebula-layer');
    const oceanEl = document.getElementById('oceanBg');
    const verdantEl = document.getElementById('verdantBg');

    // Space Logic
    if (themeName === 'space') {
        if (spaceEl) spaceEl.style.opacity = '1';
        nebulas.forEach(n => n.style.opacity = '0.4'); // Back to original opacity
    } else {
        if (spaceEl) spaceEl.style.opacity = '0';
        nebulas.forEach(n => n.style.opacity = '0');
    }

    // Ocean Logic
    if (themeName === 'ocean') {
        if (oceanEl) oceanEl.style.opacity = '1';
    } else {
        if (oceanEl) oceanEl.style.opacity = '0';
    }

    // Verdant Logic
    if (themeName === 'verdant') {
        if (verdantEl) verdantEl.style.opacity = '1';
    } else {
        if (verdantEl) verdantEl.style.opacity = '0';
    }
}
