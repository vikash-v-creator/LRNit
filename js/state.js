// state.js — Shared global state singleton for LRNit motion system
// All modules import this so they share a single source of truth.

// ─── Performance Mode Detection ──────────────────────────────────────────────
// Detects device capability and returns 'high' | 'medium' | 'low'.
// Uses a scoring system combining multiple signals.
function detectPerformanceMode() {
    // Check for manual override first
    try {
        const saved = localStorage.getItem('lrnit-perf-mode');
        if (saved && saved !== 'auto' && ['high', 'medium', 'low'].includes(saved)) {
            return saved;
        }
    } catch (e) { /* localStorage may be blocked */ }

    // prefers-reduced-motion → force low
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return 'low';
    }

    // Scoring: start at 0, positive = capable, negative = weak
    let score = 0;

    // 1. Device Memory (navigator.deviceMemory)
    const memory = navigator.deviceMemory || 4; // fallback 4GB
    if (memory >= 8) score += 2;
    else if (memory >= 4) score += 1;
    else if (memory >= 2) score -= 1;
    else score -= 2; // < 2GB

    // 2. CPU cores (navigator.hardwareConcurrency)
    const cores = navigator.hardwareConcurrency || 4; // fallback 4
    if (cores >= 8) score += 2;
    else if (cores >= 4) score += 1;
    else if (cores >= 2) score -= 1;
    else score -= 2;

    // 3. Screen size (proxy for device class)
    const screenW = window.screen.width || window.innerWidth;
    if (screenW <= 480) score -= 1;       // small phone
    else if (screenW <= 768) score -= 0;  // tablet/large phone — neutral
    else if (screenW >= 1440) score += 1; // large desktop

    // 4. Touch-primary device (phones/tablets tend to be less powerful)
    if (window.matchMedia('(pointer: coarse)').matches && screenW <= 768) {
        score -= 1;
    }

    // 5. Connection quality (if available)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        const ect = conn.effectiveType;
        if (ect === 'slow-2g' || ect === '2g') score -= 1;
        if (conn.saveData) score -= 1;
    }

    // Map score to tier
    if (score >= 3) return 'high';
    if (score >= 0) return 'medium';
    return 'low';
}

// ─── State Object ─────────────────────────────────────────────────────────────
export const state = {
    // Boot state
    loaderDone: false,
    supabaseReady: false,
    pendingDataSources: new Set(), // names of pending Supabase fetches

    // Environment
    isMobile: window.innerWidth <= 768,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hasHover: window.matchMedia('(hover: hover)').matches,

    // Performance
    performanceMode: detectPerformanceMode(), // 'high' | 'medium' | 'low'

    // Scroll
    scrollY: 0,
    lastScrollY: 0,
    scrollDirection: 'down', // 'up' | 'down'

    // Performance metrics
    fps: 60,
    batteryLow: false,
    canvasVisible: true,

    // Mouse
    mouseX: 0,
    mouseY: 0,
};

// ─── Apply CSS class to <html> ────────────────────────────────────────────────
function applyPerfClass(mode) {
    const html = document.documentElement;
    html.classList.remove('perf-high', 'perf-medium', 'perf-low');
    html.classList.add(`perf-${mode}`);
}

// Apply immediately on load
applyPerfClass(state.performanceMode);

// ─── Public API: Change performance mode ──────────────────────────────────────
export function setPerformanceMode(mode) {
    if (!['auto', 'high', 'medium', 'low'].includes(mode)) return;

    try {
        localStorage.setItem('lrnit-perf-mode', mode);
    } catch (e) { /* ignore */ }

    if (mode === 'auto') {
        // Re-detect
        state.performanceMode = detectPerformanceMode();
    } else {
        state.performanceMode = mode;
    }

    applyPerfClass(state.performanceMode);

    // Dispatch event so motion.js and other systems can react
    document.dispatchEvent(new CustomEvent('lrnit:perfChanged', {
        detail: { mode: state.performanceMode }
    }));
}

// Expose for non-module scripts
window.lrnit = window.lrnit || {};
window.lrnit.setPerformanceMode = setPerformanceMode;
window.lrnit.getPerformanceMode = () => state.performanceMode;

// ─── Keep isMobile updated on resize ──────────────────────────────────────────
const resizeObserver = new ResizeObserver(() => {
    state.isMobile = window.innerWidth <= 768;
});
resizeObserver.observe(document.documentElement);

// ─── Battery API check (non-blocking) ─────────────────────────────────────────
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        const update = () => {
            state.batteryLow = battery.level < 0.2 && !battery.charging;
            // If battery drops low mid-session, clamp to medium max
            if (state.batteryLow && state.performanceMode === 'high') {
                state.performanceMode = 'medium';
                applyPerfClass('medium');
            }
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
    }).catch(() => {});
}
