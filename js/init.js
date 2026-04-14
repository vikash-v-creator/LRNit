// init.js — LRNit Instant Boot (No Loader)
import { state } from './state.js';

// ─── Data Source Progress (kept for Supabase loaders) ─────────────────────────
const DATA_SOURCES = ['homepage_cards', 'team', 'events', 'announcements', 'gallery', 'register'];
const resolvedSources = new Set();

export function registerDataSource(name) {
    if (!DATA_SOURCES.includes(name)) return;
    state.pendingDataSources.add(name);
}

export function resolveDataSource(name) {
    if (!state.pendingDataSources.has(name)) return;
    resolvedSources.add(name);
    state.pendingDataSources.delete(name);
}

// ─── DOMContentLoaded — Instant Boot ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Attach listener FIRST so we don't miss the event
    document.addEventListener('lrnit:ready', () => {
        import('./motion.js').then(mod => {
            if (mod.initMotion) mod.initMotion();
        }).catch(err => console.warn('motion.js load failed:', err));
    }, { once: true });

    // 2. Fire ready immediately
    state.loaderDone = true;
    document.dispatchEvent(new CustomEvent('lrnit:ready'));

    // 3. Stagger-reveal any items globally that have .cl-reveal
    const triggerReveals = () => {
        const revealItems = document.querySelectorAll('.cl-reveal:not(.cl-reveal--visible)');
        revealItems.forEach((card, i) => {
            setTimeout(() => {
                card.classList.add('cl-reveal--visible');
            }, i * 80);
        });
    };

    triggerReveals();

    // Reveal newly added items when data loads (e.g., Supabase async fetches)
    document.addEventListener('lrnit:dataLoaded', triggerReveals);

    // Register data sources (still needed for loaders to resolve)
    DATA_SOURCES.forEach(name => registerDataSource(name));

    // Fallback: resolve any unresolved data sources on full page load
    window.addEventListener('load', () => {
        [...state.pendingDataSources].forEach(name => resolveDataSource(name));
    });
});
