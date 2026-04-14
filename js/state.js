// state.js — Shared global state singleton for LRNit motion system
// All modules import this so they share a single source of truth.

export const state = {
    // Boot state
    loaderDone: false,
    supabaseReady: false,
    pendingDataSources: new Set(), // names of pending Supabase fetches

    // Environment
    isMobile: window.innerWidth <= 768,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hasHover: window.matchMedia('(hover: hover)').matches,

    // Scroll
    scrollY: 0,
    lastScrollY: 0,
    scrollDirection: 'down', // 'up' | 'down'

    // Performance
    fps: 60,
    batteryLow: false,
    canvasVisible: true,

    // Mouse
    mouseX: 0,
    mouseY: 0,
};

// Keep isMobile updated on resize
const resizeObserver = new ResizeObserver(() => {
    state.isMobile = window.innerWidth <= 768;
});
resizeObserver.observe(document.documentElement);

// Battery API check (non-blocking)
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        const update = () => {
            state.batteryLow = battery.level < 0.2 && !battery.charging;
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
    }).catch(() => {});
}
