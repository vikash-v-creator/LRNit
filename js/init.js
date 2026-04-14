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
    
    // Performance class is already set by state.js synchronously.
    // Log the detected mode for debugging
    console.log(`[LRNit] Performance mode: ${state.performanceMode}`);

    // 1. Attach listener FIRST so we don't miss the event
    document.addEventListener('lrnit:ready', () => {
        import('./motion.js').then(mod => {
            if (mod.initMotion) mod.initMotion();
            window._motionInitDone = true;
        }).catch(err => console.warn('motion.js load failed:', err));
    }, { once: true });

    // 2. Fire ready immediately
    state.loaderDone = true;
    document.dispatchEvent(new CustomEvent('lrnit:ready'));

    // 3. Stagger-reveal any items globally that have .cl-reveal
    const triggerReveals = () => {
        const revealItems = document.querySelectorAll('.cl-reveal:not(.cl-reveal--visible)');
        const stagger = state.performanceMode === 'low' ? 40 : 80;
        revealItems.forEach((card, i) => {
            setTimeout(() => {
                card.classList.add('cl-reveal--visible');
            }, i * stagger);
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

    // ─── Performance Toggle UI ────────────────────────────────────────────────
    // Auto-inject toggle into footer if it exists
    const footer = document.querySelector('.footer-brand') || document.querySelector('footer');
    if (footer) {
        const toggle = document.createElement('div');
        toggle.className = 'perf-toggle';
        toggle.id = 'perf-toggle';

        // Determine current saved value
        let savedMode = 'auto';
        try { savedMode = localStorage.getItem('lrnit-perf-mode') || 'auto'; } catch(e) {}

        toggle.innerHTML = `
            <span class="perf-toggle-label">Performance</span>
            <select id="perf-mode-select" aria-label="Performance mode">
                <option value="auto"${savedMode === 'auto' ? ' selected' : ''}>Auto (${state.performanceMode})</option>
                <option value="high"${savedMode === 'high' ? ' selected' : ''}>High</option>
                <option value="medium"${savedMode === 'medium' ? ' selected' : ''}>Medium</option>
                <option value="low"${savedMode === 'low' ? ' selected' : ''}>Low</option>
            </select>
        `;
        footer.appendChild(toggle);

        document.getElementById('perf-mode-select').addEventListener('change', (e) => {
            const mode = e.target.value;
            if (window.lrnit && window.lrnit.setPerformanceMode) {
                window.lrnit.setPerformanceMode(mode);
            }
            // Update the "Auto" label to show current detected mode
            if (mode === 'auto') {
                const autoOption = e.target.querySelector('option[value="auto"]');
                autoOption.textContent = `Auto (${state.performanceMode})`;
            }
            // Notify user
            if (window.lrnit && window.lrnit.toast) {
                window.lrnit.toast(`Performance mode: ${state.performanceMode.toUpperCase()}`, 'info', 2500);
            }
            // Some changes require page reload to take full effect
            if (mode !== 'auto') {
                setTimeout(() => location.reload(), 300);
            }
        });
    }
});
