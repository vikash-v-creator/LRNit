// motion.js — LRNit Cinematic Motion System
// Loaded lazily after lrnit:ready fires from init.js
import { state } from './state.js';

// ─────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT — called by init.js after loader exits
// ─────────────────────────────────────────────────────────────────────
export function initMotion() {
    if (state.prefersReducedMotion) {
        // Still run non-visual helpers
        initFloatingLabels();
        initToastSystem();
        initScrollProgress();
        return;
    }
    initScrollProgress();
    initCursor();
    initSpotlight();
    initPageTransition();
    initToastSystem();
    initNavbar();
    initHeroCanvas();
    initHeroEntrance();
    initTypewriter();
    initScrollSystem();
    initScrollReveals();
    initCardTilt();
    initMagneticButtons();
    initTextScramble();
    initFloatingLabels();
    initConfetti();
    initPerformanceGuards();
}

// ─────────────────────────────────────────────────────────────────────
// 1. SCROLL PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────
function initScrollProgress() {
    const bar = document.getElementById('scroll-progress-bar');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        document.documentElement.style.setProperty('--scroll-progress', Math.min(1, pct));
        state.scrollY = window.scrollY;
    }, { passive: true });
}

// ─────────────────────────────────────────────────────────────────────
// 2. CUSTOM CURSOR + TRAIL + CONTEXT DETECTION
// ─────────────────────────────────────────────────────────────────────
function initCursor() {
    if (state.isMobile || !state.hasHover) return;

    // Create cursor dot
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    // Create 3 ghost trails
    const trails = [1, 2, 3].map(() => {
        const t = document.createElement('div');
        t.className = 'cursor-trail';
        t.setAttribute('aria-hidden', 'true');
        document.body.appendChild(t);
        return t;
    });

    let mx = -100, my = -100;
    let cx = -100, cy = -100;
    const trailPos = trails.map(() => ({ x: -100, y: -100 }));
    const trailLerp = [0.28, 0.16, 0.10];

    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        state.mouseX = mx; state.mouseY = my;
        dot.style.opacity = '1';
    });
    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; });
    document.addEventListener('mousedown', () => dot.classList.add('cursor--filled'));
    document.addEventListener('mouseup',   () => dot.classList.remove('cursor--filled'));

    // Context-based cursor morphing
    const ringTargets = 'a, button, [role="button"], label, select, .btn-primary, .btn-secondary, .btn-tertiary, .filter-btn';
    const textTargets = 'p, h1, h2, h3, h4, h5, h6, li, span';
    document.querySelectorAll(ringTargets).forEach(el => {
        el.addEventListener('mouseenter', () => {
            dot.classList.remove('cursor--text');
            dot.classList.add('cursor--ring');
        });
        el.addEventListener('mouseleave', () => dot.classList.remove('cursor--ring'));
    });
    document.querySelectorAll(textTargets).forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (!dot.classList.contains('cursor--ring')) dot.classList.add('cursor--text');
        });
        el.addEventListener('mouseleave', () => dot.classList.remove('cursor--text'));
    });

    function rafCursor() {
        cx += (mx - cx) * 0.14;
        cy += (my - cy) * 0.14;
        dot.style.left = cx + 'px';
        dot.style.top  = cy + 'px';

        trails.forEach((t, i) => {
            const prev = i === 0 ? { x: cx, y: cy } : trailPos[i - 1];
            trailPos[i].x += (prev.x - trailPos[i].x) * trailLerp[i];
            trailPos[i].y += (prev.y - trailPos[i].y) * trailLerp[i];
            t.style.left = trailPos[i].x + 'px';
            t.style.top  = trailPos[i].y + 'px';
        });
        requestAnimationFrame(rafCursor);
    }
    rafCursor();
}

// ─────────────────────────────────────────────────────────────────────
// 3. SPOTLIGHT VIGNETTE
// ─────────────────────────────────────────────────────────────────────
function initSpotlight() {
    if (state.isMobile) return;
    const el = document.getElementById('spotlight');
    if (!el) return;
    document.addEventListener('mousemove', e => {
        el.style.setProperty('--cx', e.clientX + 'px');
        el.style.setProperty('--cy', e.clientY + 'px');
    }, { passive: true });
}

// ─────────────────────────────────────────────────────────────────────
// 4. PAGE TRANSITION OVERLAY
// ─────────────────────────────────────────────────────────────────────
function initPageTransition() {
    const overlay = document.getElementById('page-transition');
    if (!overlay) return;

    // Animate in on arrival
    overlay.classList.add('transitioning-in');
    overlay.addEventListener('animationend', () => {
        overlay.classList.remove('transitioning-in');
    }, { once: true });

    // Intercept internal link clicks
    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
        link.addEventListener('click', e => {
            e.preventDefault();
            overlay.classList.add('transitioning-out');
            overlay.addEventListener('animationend', () => {
                window.location.href = href;
            }, { once: true });
        });
    });
}

// ─────────────────────────────────────────────────────────────────────
// 5. TOAST NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────────────────
function initToastSystem() {
    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    if (!document.getElementById('toast-live')) {
        const live = document.createElement('div');
        live.id = 'toast-live';
        live.setAttribute('aria-live', 'polite');
        live.setAttribute('aria-atomic', 'true');
        document.body.appendChild(live);
    }

    const iconMap = { success: '✓', error: '✕', info: 'ℹ' };

    window.lrnit = window.lrnit || {};
    window.lrnit.toast = function(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        const live = document.getElementById('toast-live');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="toast-icon" aria-hidden="true">${iconMap[type] || 'ℹ'}</span>
            <span class="toast-msg">${message}</span>
            <button class="toast-close" aria-label="Dismiss notification">×</button>
        `;
        container.appendChild(toast);

        // Announce to screen reader
        if (live) { live.textContent = ''; setTimeout(() => { live.textContent = message; }, 100); }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('toast--visible'));
        });

        const dismiss = () => {
            toast.classList.remove('toast--visible');
            toast.classList.add('toast--exit');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        };

        toast.querySelector('.toast-close').addEventListener('click', dismiss);
        setTimeout(dismiss, duration);
    };
}

// ─────────────────────────────────────────────────────────────────────
// 6. NAVBAR — Scroll-aware hide/show + Magnetic links + Sliding indicator
// ─────────────────────────────────────────────────────────────────────
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // Scroll-aware hide/show
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const current = window.scrollY;
        const diff = current - lastScroll;

        if (current > 80) {
            navbar.classList.add('scrolled');
            if (diff > 4) {
                navbar.classList.add('nav--hidden');
                navbar.classList.remove('nav--visible');
            } else if (diff < -4) {
                navbar.classList.remove('nav--hidden');
                navbar.classList.add('nav--visible');
            }
        } else {
            navbar.classList.remove('scrolled', 'nav--hidden');
        }
        lastScroll = current;

        // Update --scroll-y for CSS parallax blobs
        document.documentElement.style.setProperty('--scroll-y', current + 'px');
        state.scrollY = current;
        state.scrollDirection = diff > 0 ? 'down' : 'up';
    }, { passive: true });

    // Magnetic nav links
    if (!state.isMobile) {
        const links = navbar.querySelectorAll('.nav-links a');
        links.forEach(link => {
            link.addEventListener('mousemove', e => {
                const r = link.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2);
                const dy = e.clientY - (r.top + r.height / 2);
                link.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
            });
            link.addEventListener('mouseleave', () => {
                link.style.transform = '';
            });
        });

        // Sliding indicator
        const navLinksWrapper = navbar.querySelector('.nav-links');
        if (navLinksWrapper) {
            navLinksWrapper.style.position = 'relative';
            const indicator = document.createElement('div');
            indicator.className = 'nav-indicator';
            indicator.setAttribute('aria-hidden', 'true');
            navLinksWrapper.appendChild(indicator);

            function moveIndicator(el) {
                const wrapRect = navLinksWrapper.getBoundingClientRect();
                const elRect   = el.getBoundingClientRect();
                indicator.style.left  = (elRect.left - wrapRect.left) + 'px';
                indicator.style.width = elRect.width + 'px';
                indicator.style.opacity = '1';
            }

            links.forEach(link => {
                link.addEventListener('mouseenter', () => moveIndicator(link));
            });
            navLinksWrapper.addEventListener('mouseleave', () => {
                const active = navLinksWrapper.querySelector('.active');
                if (active) moveIndicator(active);
                else indicator.style.opacity = '0';
            });

            // Set on active link initially
            const active = navLinksWrapper.querySelector('.active');
            if (active) {
                setTimeout(() => moveIndicator(active), 100);
            } else {
                indicator.style.opacity = '0';
            }
        }
    }

    // Mobile hamburger — staggered link entrance
    const hamburger = document.querySelector('.hamburger');
    const navLinks  = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }
}

// ─────────────────────────────────────────────────────────────────────
// 7. HERO CANVAS — Neural Particles connected to gear points
// ─────────────────────────────────────────────────────────────────────
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || state.isMobile || state.batteryLow) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Gear anchor points (from SVG viewport, normalized to canvas space)
    const GEAR_ANCHORS_NORM = [
        { x: 145/420, y: 240/420 },
        { x: 244/420, y: 170/420 },
        { x: 325/420, y: 195/420 },
        { x: 155/420, y: 355/420 },
        { x: 280/420, y: 320/420 },
    ];

    let W, H, particles = [], heroContentRect = null, animRunning = true;
    const MAX_PARTICLES = 80;
    const CONNECTION_DIST = 130;
    const FPS_SAMPLES = [];
    let lastFrame = performance.now();
    let lowPerfMode = false;

    function resize() {
        // Global background is position:fixed inset:0, so use window dimensions
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
        ctx.scale(dpr, dpr);
        initParticles();
        // Update hero text exclusion zone (only on home page)
        const content = document.querySelector('.hero-content');
        if (content) heroContentRect = content.getBoundingClientRect();
    }

    function initParticles() {
        particles = [];
        const count = lowPerfMode ? 40 : MAX_PARTICLES;
        for (let i = 0; i < count; i++) {
            particles.push(createParticle());
        }
    }

    function createParticle() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            radius: Math.random() * 1.8 + 0.6,
            alpha: Math.random() * 0.5 + 0.2,
            hue: Math.random() < 0.6 ? 0 : 220, // red or blue
        };
    }

    function particleInExclusionZone(p) {
        if (!heroContentRect) return false;
        const canvasRect = canvas.getBoundingClientRect();
        const rx = heroContentRect.left - canvasRect.left;
        const ry = heroContentRect.top  - canvasRect.top;
        const rw = heroContentRect.width;
        const rh = heroContentRect.height;
        const pad = 30;
        return p.x > rx - pad && p.x < rx + rw + pad &&
               p.y > ry - pad && p.y < ry + rh + pad;
    }

    // Shockwave state
    let shockwave = null;

    canvas.style.pointerEvents = 'auto';
    canvas.addEventListener('click', e => {
        const rect = canvas.getBoundingClientRect();
        shockwave = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            r: 0, maxR: 200,
            alpha: 0.6,
        };
        // Scatter nearby particles
        particles.forEach(p => {
            const dx = p.x - shockwave.x;
            const dy = p.y - shockwave.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 200 && dist > 0) {
                const force = (1 - dist / 200) * 4;
                p.vx += (dx / dist) * force;
                p.vy += (dy / dist) * force;
            }
        });
    });

    // Get gear anchor positions in canvas px
    function getGearAnchors() {
        const gearContainer = document.getElementById('gears-container');
        if (!gearContainer) return [];
        const cr = canvas.getBoundingClientRect();
        const gr = gearContainer.getBoundingClientRect();
        return GEAR_ANCHORS_NORM.map(a => ({
            x: gr.left - cr.left + a.x * gr.width,
            y: gr.top  - cr.top  + a.y * gr.height,
        }));
    }

    function draw(ts) {
        if (!animRunning) return;
        requestAnimationFrame(draw);

        // FPS monitoring
        const delta = ts - lastFrame;
        lastFrame = ts;
        FPS_SAMPLES.push(1000 / delta);
        if (FPS_SAMPLES.length > 30) FPS_SAMPLES.shift();
        const avgFPS = FPS_SAMPLES.reduce((a,b) => a + b, 0) / FPS_SAMPLES.length;
        state.fps = Math.round(avgFPS);
        if (!lowPerfMode && avgFPS < 40 && FPS_SAMPLES.length === 30) {
            lowPerfMode = true;
            particles = particles.slice(0, 40);
        }

        ctx.clearRect(0, 0, W, H);

        const gearAnchors = getGearAnchors();

        // Draw gear connections (dimmer dedicated lines)
        if (!lowPerfMode) {
            gearAnchors.forEach(anchor => {
                particles.forEach(p => {
                    const dx = p.x - anchor.x;
                    const dy = p.y - anchor.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 180) {
                        const alpha = (1 - dist / 180) * 0.15;
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(176,4,4,${alpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(anchor.x, anchor.y);
                        ctx.lineTo(p.x, p.y);
                        ctx.stroke();
                    }
                });
            });
        }

        // Update + draw particles
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Bounce on edges
            if (p.x < 0 || p.x > W) { p.vx *= -1; p.x = Math.max(0, Math.min(W, p.x)); }
            if (p.y < 0 || p.y > H) { p.vy *= -1; p.y = Math.max(0, Math.min(H, p.y)); }

            // Steer away from exclusion zone
            if (particleInExclusionZone(p)) {
                p.vx += (Math.random() - 0.5) * 0.3;
                p.vy += (Math.random() - 0.5) * 0.3;
            }

            // Speed limit (damping after shockwave scatter)
            const speed = Math.hypot(p.vx, p.vy);
            if (speed > 2) { p.vx = (p.vx / speed) * 2; p.vy = (p.vy / speed) * 2; }
            // Gradual slow-down back to normal
            p.vx *= 0.99; p.vy *= 0.99;

            // Mouse attraction (subtle)
            if (!state.isMobile) {
                const mRect = canvas.getBoundingClientRect();
                const lmx = state.mouseX - mRect.left;
                const lmy = state.mouseY - mRect.top;
                const mdx = lmx - p.x;
                const mdy = lmy - p.y;
                const mdist = Math.hypot(mdx, mdy);
                if (mdist > 0 && mdist < 120) {
                    p.vx += (mdx / mdist) * 0.012;
                    p.vy += (mdy / mdist) * 0.012;
                }
            }

            // Draw particle
            ctx.beginPath();
            const col = p.hue === 0
                ? `rgba(220,${Math.round(20+p.alpha*30)},${Math.round(20)},${p.alpha})`
                : `rgba(${Math.round(59+p.alpha*20)},${Math.round(130)},246,${p.alpha * 0.8})`;
            ctx.fillStyle = col;
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw inter-particle connection lines
        if (!lowPerfMode) {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < CONNECTION_DIST) {
                        const alpha = (1 - dist / CONNECTION_DIST) * 0.18;
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(176,4,4,${alpha})`;
                        ctx.lineWidth = 0.6;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
        }

        // Shockwave ring
        if (shockwave) {
            shockwave.r += 6;
            shockwave.alpha *= 0.93;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(220,0,0,${shockwave.alpha})`;
            ctx.lineWidth = 2;
            ctx.arc(shockwave.x, shockwave.y, shockwave.r, 0, Math.PI * 2);
            ctx.stroke();
            if (shockwave.alpha < 0.01 || shockwave.r > shockwave.maxR) shockwave = null;
        }
    }

    // Global background is always visible (position:fixed), no need for IntersectionObserver
    state.canvasVisible = true;

    // Debounced resize on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    resize();
    requestAnimationFrame(draw);
}

// ─────────────────────────────────────────────────────────────────────
// 8. HERO ENTRANCE — Word-by-word reveal after loader exits
// ─────────────────────────────────────────────────────────────────────
function initHeroEntrance() {
    const heroTitle = document.querySelector('.hero-title');
    const heroSub   = document.querySelector('.hero-subtitle');
    const badge     = document.querySelector('.badge');
    const cta       = document.querySelector('.hero-cta');

    // Split title words into spans safely (preserves existing HTML like <span class="gradient-text">)
    if (heroTitle) {
        function wrapTextNodes(node) {
            if (node.nodeType === 3) { // Text node
                const words = node.nodeValue.trim().split(/(\s+)/);
                if (words.length === 0 || words[0] === '') return;
                
                const frag = document.createDocumentFragment();
                words.forEach(w => {
                    if (w.trim()) {
                        const span = document.createElement('span');
                        span.className = 'hero-word';
                        span.textContent = w;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(w));
                    }
                });
                node.parentNode.replaceChild(frag, node);
            } else if (node.nodeType === 1 && !node.classList.contains('hero-word')) {
                // If it's the gradient text, just animate the wrapper itself to preserve background-clip
                if (node.classList.contains('gradient-text')) {
                    node.classList.add('hero-word');
                } else {
                    // Element node
                    Array.from(node.childNodes).forEach(wrapTextNodes);
                }
            }
        }
        
        Array.from(heroTitle.childNodes).forEach(wrapTextNodes);

        const words = heroTitle.querySelectorAll('.hero-word');
        words.forEach((w, i) => {
            setTimeout(() => w.classList.add('word--visible'), i * 80 + 100);
        });
    }

    // Stagger subtitle + CTA
    if (badge) setTimeout(() => { badge.style.opacity = '1'; badge.style.transform = 'none'; }, 50);
    if (heroSub) setTimeout(() => { heroSub.style.opacity = '1'; heroSub.style.transform = 'none'; }, 350);
    if (cta) setTimeout(() => { cta.style.opacity = '1'; cta.style.transform = 'none'; }, 600);
}

// ─────────────────────────────────────────────────────────────────────
// 9. TYPEWRITER CYCLING
// ─────────────────────────────────────────────────────────────────────
function initTypewriter() {
    const el = document.querySelector('.hero-typewriter');
    if (!el) return;

    const words = ['Innovate', 'Build', 'Lead', 'Create', 'Solve'];
    let wordIdx = 0, charIdx = 0, deleting = false;

    function tick() {
        const word = words[wordIdx];
        if (!deleting) {
            charIdx++;
            el.textContent = word.slice(0, charIdx);
            if (charIdx === word.length) {
                deleting = true;
                setTimeout(tick, 1800);
            } else {
                setTimeout(tick, 80);
            }
        } else {
            charIdx--;
            el.textContent = word.slice(0, charIdx);
            if (charIdx === 0) {
                deleting = false;
                wordIdx = (wordIdx + 1) % words.length;
                setTimeout(tick, 300);
            } else {
                setTimeout(tick, 45);
            }
        }
    }
    setTimeout(tick, 800);
}

// ─────────────────────────────────────────────────────────────────────
// 10. SCROLL SYSTEM — Parallax on hero layers
// ─────────────────────────────────────────────────────────────────────
function initScrollSystem() {
    const heroContent     = document.querySelector('.hero-content');
    const heroGears       = document.getElementById('gears-container');
    const heroGearsWrap   = document.getElementById('gears-wrapper');

    window.addEventListener('scroll', () => {
        const sy = window.scrollY;
        // Hero parallax layers
        if (heroContent && sy < window.innerHeight) {
            heroContent.style.setProperty('--scroll-ty', `${sy * -0.08}px`);
        }
        if (heroGears && sy < window.innerHeight) {
            heroGears.style.setProperty('--scroll-ty', `${sy * 0.12}px`);
        }
    }, { passive: true });

    // Mouse-move parallax on hero elements
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.addEventListener('mousemove', e => {
            const cx = (e.clientX / window.innerWidth  - 0.5) * 2;
            const cy = (e.clientY / window.innerHeight - 0.5) * 2;
            if (heroContent) {
                heroContent.style.setProperty('--mouse-tx', `${cx * 8}px`);
                heroContent.style.setProperty('--mouse-ty', `${cy * 5}px`);
            }
            if (heroGearsWrap) {
                heroGearsWrap.style.setProperty('--mouse-tx', `${cx * 18}px`);
                heroGearsWrap.style.setProperty('--mouse-ty', `${cy * 12}px`);
            }
        });
        hero.addEventListener('mouseleave', () => {
            if (heroContent) {
                heroContent.style.setProperty('--mouse-tx', '0px');
                heroContent.style.setProperty('--mouse-ty', '0px');
            }
            if (heroGearsWrap) {
                heroGearsWrap.style.setProperty('--mouse-tx', '0px');
                heroGearsWrap.style.setProperty('--mouse-ty', '0px');
            }
        });
    }
}

// ─────────────────────────────────────────────────────────────────────
// 11. SCROLL REVEALS — Per-section personality via data-reveal attribute
// ─────────────────────────────────────────────────────────────────────
function initScrollReveals() {
    // Assign data-reveal variants to known selectors
    const variantMap = [
        { selector: '.philosophy-card',    variant: 'deal' },
        { selector: '.about-card',         variant: 'slide-right' },
        { selector: '.event-full-card',    variant: 'scale-center' },
        { selector: '.team-card',          variant: 'scale-center' },
        { selector: '.gallery-item',       variant: 'clip-wipe' },
        { selector: '.announcement-card',  variant: 'slide-left' },
        { selector: '.section-header',     variant: 'fade-up' },
        { selector: '.contact-card',       variant: 'scale-center' },
        { selector: '.events-page-hero',   variant: 'fade-up' },
        { selector: '.events-cta',         variant: 'fade-up' },
    ];

    variantMap.forEach(({ selector, variant }) => {
        document.querySelectorAll(selector).forEach(el => {
            if (!el.getAttribute('data-reveal')) {
                el.setAttribute('data-reveal', variant);
            }
        });
    });

    // IntersectionObserver for reveals
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;

            // Stagger siblings in same parent
            const siblings = Array.from(
                el.parentElement.querySelectorAll('[data-reveal]')
            );
            const idx = siblings.indexOf(el);
            el.style.transitionDelay = (idx * 60) + 'ms';
            el.classList.add('revealed');
            obs.unobserve(el);
        });
    }, { threshold: 0.12, rootMargin: '-40px 0px' });

    // Lazy init: only observe elements near or in viewport
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

    // Re-run for dynamically added cards (Supabase data)
    document.addEventListener('lrnit:dataLoaded', () => {
        document.querySelectorAll('[data-reveal]:not(.revealed)').forEach(el => {
            observer.observe(el);
        });
    });

    // Stats counter: count up when visible
    const countObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.getAttribute('data-count'), 10);
            let current = 0;
            const step = Math.ceil(target / 60);
            const timer = setInterval(() => {
                current = Math.min(current + step, target);
                el.textContent = current.toLocaleString();
                if (current >= target) clearInterval(timer);
            }, 16);
            countObserver.unobserve(el);
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));
}

// ─────────────────────────────────────────────────────────────────────
// 12. CARD 3D TILT + RADIAL GLOW + MOBILE TOUCH
// ─────────────────────────────────────────────────────────────────────
function initCardTilt() {
    const CARD_SELECTORS = [
        '.about-card', '.philosophy-card', '.team-card',
        '.event-full-card', '.announcement-card', '.contact-card',
    ].join(', ');

    const cards = document.querySelectorAll(CARD_SELECTORS);

    if (state.isMobile) {
        // Mobile: touch scale instead of tilt
        cards.forEach(card => {
            card.addEventListener('touchstart', () => {
                card.style.transform = 'scale(1.02)';
                card.style.transition = 'transform 0.2s ease';
            }, { passive: true });
            card.addEventListener('touchend', () => {
                card.style.transform = '';
            }, { passive: true });
        });
        return;
    }

    cards.forEach(card => {
        let currentRX = 0, currentRY = 0, targetRX = 0, targetRY = 0;
        let animating = false;

        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Set cursor glow position
            card.style.setProperty('--mouse-x', x + 'px');
            card.style.setProperty('--mouse-y', y + 'px');

            // Calculate tilt angles (max ±8°)
            const cx = rect.width  / 2;
            const cy = rect.height / 2;
            targetRX = ((y - cy) / cy) * -8;
            targetRY = ((x - cx) / cx) *  8;

            if (!animating) {
                animating = true;
                rafTilt();
            }
        });

        card.addEventListener('mouseleave', () => {
            targetRX = 0; targetRY = 0;
        });

        function rafTilt() {
            currentRX += (targetRX - currentRX) * 0.12;
            currentRY += (targetRY - currentRY) * 0.12;

            if (!card.matches(':hover') && Math.abs(currentRX) < 0.05 && Math.abs(currentRY) < 0.05) {
                card.style.transform = '';
                animating = false;
                return;
            }
            card.style.transform = `perspective(1200px) rotateX(${currentRX}deg) rotateY(${currentRY}deg)`;
            requestAnimationFrame(rafTilt);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────
// 13. MAGNETIC BUTTONS + RIPPLE
// ─────────────────────────────────────────────────────────────────────
function initMagneticButtons() {
    const BTN_SEL = '.btn-primary, .btn-secondary, .btn-tertiary, .btn-submit-animated, .filter-btn';
    const buttons = document.querySelectorAll(BTN_SEL);

    if (!state.isMobile) {
        buttons.forEach(btn => {
            btn.addEventListener('mousemove', e => {
                const r = btn.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width  / 2);
                const dy = e.clientY - (r.top  + r.height / 2);
                btn.style.transform = `translate(${dx * 0.35}px, ${dy * 0.35}px)`;
            });
            btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
        });
    }

    // Ripple on click (all devices)
    document.addEventListener('click', e => {
        const btn = e.target.closest(BTN_SEL);
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 2;
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.cssText = `
            width:${size}px; height:${size}px;
            left:${e.clientX - r.left - size/2}px;
            top:${e.clientY - r.top  - size/2}px;
        `;
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
}

// ─────────────────────────────────────────────────────────────────────
// 14. TEXT SCRAMBLE on section title hover
// ─────────────────────────────────────────────────────────────────────
function initTextScramble() {
    if (state.isMobile) return;
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&';

    document.querySelectorAll('.section-title').forEach(title => {
        const originalText = title.textContent;
        // Set aria-label so screen reader always announces real text
        title.setAttribute('aria-label', originalText);

        let scrambleRAF = null, scrambling = false;

        title.addEventListener('mouseenter', () => {
            if (scrambling) return;
            scrambling = true;

            // Wrap every char in a span
            title.innerHTML = [...originalText].map((c, i) =>
                c.trim() ? `<span class="scramble-char" data-final="${c}" data-idx="${i}">${c}</span>` : c
            ).join('');

            const spans = title.querySelectorAll('.scramble-char');
            let resolvedCount = 0;
            const startTime = performance.now();
            const DURATION = 600;

            function frame(now) {
                const elapsed = now - startTime;
                spans.forEach((span, i) => {
                    const resolveAt = (i / spans.length) * DURATION * 0.8;
                    if (elapsed < resolveAt) {
                        span.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
                        span.classList.add('scrambling');
                    } else if (!span.dataset.resolved) {
                        span.textContent = span.dataset.final;
                        span.classList.remove('scrambling');
                        span.dataset.resolved = '1';
                        resolvedCount++;
                    }
                });
                if (resolvedCount < spans.length) {
                    scrambleRAF = requestAnimationFrame(frame);
                } else {
                    title.innerHTML = originalText; // restore clean
                    scrambling = false;
                }
            }
            scrambleRAF = requestAnimationFrame(frame);
        });

        title.addEventListener('mouseleave', () => {
            if (scrambleRAF) cancelAnimationFrame(scrambleRAF);
            title.innerHTML = originalText;
            title.setAttribute('aria-label', originalText);
            scrambling = false;
        });
    });
}

// ─────────────────────────────────────────────────────────────────────
// 15. FLOATING LABELS
// ─────────────────────────────────────────────────────────────────────
function initFloatingLabels() {
    document.querySelectorAll('.floating-input').forEach(wrapper => {
        const field = wrapper.querySelector('input, select, textarea');
        if (!field) return;

        function update() {
            wrapper.classList.toggle('has-value', field.value.length > 0);
        }
        field.addEventListener('focus',  () => wrapper.classList.add('is-focused'));
        field.addEventListener('blur',   () => { wrapper.classList.remove('is-focused'); update(); });
        field.addEventListener('input',  update);
        field.addEventListener('change', update);
        update(); // set initial state
    });
}

// ─────────────────────────────────────────────────────────────────────
// 16. CONFETTI BURST (register + join success states)
// ─────────────────────────────────────────────────────────────────────
function initConfetti() {
    window.lrnit = window.lrnit || {};
    window.lrnit.confetti = function() {
        let canvas = document.getElementById('confetti-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'confetti-canvas';
            document.body.appendChild(canvas);
        }
        const ctx = canvas.getContext('2d');
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;

        const COLORS = ['#DC0000','#ff6b6b','#ffffff','#ffd700','#050E3C','#3b82f6'];
        const pieces = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * -canvas.height * 0.5,
            w: Math.random() * 10 + 4,
            h: Math.random() * 6 + 3,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 3 + 2,
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.15,
            alpha: 1,
        }));

        let alive = true;
        function frame() {
            if (!alive) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let allDone = true;
            pieces.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.08; // gravity
                p.rot += p.rotV;
                if (p.y > canvas.height) p.alpha -= 0.02;
                if (p.alpha > 0) allDone = false;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
                ctx.restore();
            });
            if (allDone) {
                alive = false;
                canvas.remove();
            } else {
                requestAnimationFrame(frame);
            }
        }
        requestAnimationFrame(frame);
    };
}

// ─────────────────────────────────────────────────────────────────────
// 17. GEAR SYSTEM ENHANCEMENT — increase parallax range
// ─────────────────────────────────────────────────────────────────────
// The base gear animation is in main.js; this just enhances the nudge range.
// (The existing mousemove handler in main.js uses 12px/8px — motion.js skips
//  duplicate; main.js will be cleaned up in Phase 7.)

// ─────────────────────────────────────────────────────────────────────
// 18. PERFORMANCE GUARDS
// ─────────────────────────────────────────────────────────────────────
function initPerformanceGuards() {
    // Lazy section init: re-observe data-reveal items when near viewport
    const lazyObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const section = entry.target;
            // Trigger tilt init for cards inside this section
            const cards = section.querySelectorAll('[data-reveal]');
            cards.forEach(el => {
                if (!el.classList.contains('revealed')) {
                    el.setAttribute('data-reveal', el.getAttribute('data-reveal') || 'fade-up');
                }
            });
            lazyObserver.unobserve(section);
        });
    }, { rootMargin: '200px' });
    document.querySelectorAll('section').forEach(s => lazyObserver.observe(s));

    // Battery-low mode: reduce further if battery drops mid-session
    if ('getBattery' in navigator) {
        navigator.getBattery().then(b => {
            b.addEventListener('levelchange', () => {
                if (b.level < 0.2 && !b.charging) {
                    state.batteryLow = true;
                    const canvas = document.getElementById('hero-canvas');
                    if (canvas) canvas.style.display = 'none';
                }
            });
        }).catch(() => {});
    }
}
