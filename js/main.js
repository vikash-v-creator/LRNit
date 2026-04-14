// main.js — LRNit legacy helpers
// Loader + cursor + scroll-reveals + card-tilt are now handled by init.js + motion.js.
// This file only keeps: gear animation, smooth scroll, hamburger fallback.

document.addEventListener('DOMContentLoaded', () => {

    /* --- Navbar Scroll Class (motion.js does hide/show; main.js keeps .scrolled class for CSS) --- */
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    /* --- Mobile Hamburger Fallback (motion.js also handles this; no-op if already bound) --- */
    const hamburger = document.querySelector('.hamburger');
    const navLinks  = document.querySelector('.nav-links');
    if (hamburger && navLinks && !hamburger._motionBound) {
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

    /* --- Smooth Scroll Anchor Links --- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) {
                const offset = navbar ? navbar.offsetHeight : 80;
                window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
            }
        });
    });

    /* --- Parallax CSS variable (motion.js now handles this — skip if motion is loaded) --- */
    // motion.js sets --scroll-y in its navbar handler. Only set here as fallback.
    if (!window._motionInitDone) {
        let parallaxTicking = false;
        window.addEventListener('scroll', () => {
            if (parallaxTicking) return;
            parallaxTicking = true;
            requestAnimationFrame(() => {
                document.documentElement.style.setProperty('--scroll-y', `${window.scrollY}px`);
                parallaxTicking = false;
            });
        }, { passive: true });
    }

    /* --- Mechanical Gear Animation (Hero SVG) --- */
    // Gate by performance mode: skip on LOW tier
    const perfMode = (window.lrnit && window.lrnit.getPerformanceMode)
        ? window.lrnit.getPerformanceMode()
        : 'high'; // fallback to high if state not loaded yet

    const gears         = document.querySelectorAll('.gear');
    const gearsContainer = document.getElementById('gears-container');
    const gearsWrapper  = document.getElementById('gears-wrapper');
    const gearsSvg      = document.querySelector('.gears-svg');

    if (gears.length > 0 && gearsContainer && window.innerWidth > 768 && perfMode !== 'low') {
        let speedMultiplier = 1;
        let targetSpeedMultiplier = 1;
        const PROXIMITY_RADIUS = 300;
        let gearAnimRunning = true;

        // Only add mousemove for gear proximity on HIGH and MEDIUM
        if (perfMode !== 'low') {
            document.addEventListener('mousemove', (e) => {
                const rect = gearsContainer.getBoundingClientRect();
                const dist = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
                const isNear = dist < PROXIMITY_RADIUS;

                if (gearsSvg) gearsSvg.classList.toggle('near-cursor', isNear);

                targetSpeedMultiplier = isNear ? 1 + (1 - dist / PROXIMITY_RADIUS) * 1.5 : 1;

                // Mouse-nudge parallax (unless motion.js already handles it via initScrollSystem)
                if (gearsWrapper && !window._motionInitDone) {
                    const nudgeX = ((e.clientX / window.innerWidth)  - 0.5) * 12;
                    const nudgeY = ((e.clientY / window.innerHeight) - 0.5) * 8;
                    gearsWrapper.style.transform = `translate(${nudgeX}px, ${nudgeY}px)`;
                }
            }, { passive: true });
        }

        // Pause gear animation when tab is hidden
        document.addEventListener('visibilitychange', () => {
            gearAnimRunning = !document.hidden;
        });

        let lastTime = performance.now();
        function animateGears(time) {
            if (!gearAnimRunning) {
                requestAnimationFrame(animateGears);
                lastTime = time;
                return;
            }
            const delta = time - lastTime;
            lastTime = time;

            // On MEDIUM, reduce speed multiplier range
            const speedCap = perfMode === 'medium' ? 1.5 : 2.5;
            speedMultiplier += (targetSpeedMultiplier - speedMultiplier) * 0.05;
            speedMultiplier = Math.min(speedMultiplier, speedCap);

            gears.forEach(gear => {
                const ratio     = parseFloat(gear.getAttribute('data-ratio'));
                const direction = parseFloat(gear.getAttribute('data-direction'));
                const cx = parseFloat(gear.getAttribute('data-cx'));
                const cy = parseFloat(gear.getAttribute('data-cy'));
                let rot = parseFloat(gear.getAttribute('data-currentrotation') || 0);
                rot = (rot + direction * ratio * 0.08 * delta * speedMultiplier) % 360;
                gear.setAttribute('data-currentrotation', rot);
                gear.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
            });
            requestAnimationFrame(animateGears);
        }
        requestAnimationFrame(animateGears);
    }
});
