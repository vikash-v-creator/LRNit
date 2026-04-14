// load-events.js — Events loader with init.js integration
import { supabase } from "./supabase-client.js";
import { resolveDataSource } from "./init.js";

const SKELETON_EVENT = `
    <div class="event-full-card skeleton-card" aria-hidden="true" style="display:flex;min-height:200px;">
        <div class="event-card-img-panel skeleton-block" style="min-height:200px;border-radius:0;"></div>
        <div class="event-card-body" style="display:flex;flex-direction:column;gap:0.75rem;">
            <div style="display:flex;gap:0.5rem;">
                <div class="skeleton-line" style="height:20px;width:80px;border-radius:20px;"></div>
                <div class="skeleton-line" style="height:20px;width:90px;border-radius:20px;"></div>
            </div>
            <div class="skeleton-line" style="height:26px;width:55%;"></div>
            <div class="skeleton-line" style="height:14px;width:90%;"></div>
            <div class="skeleton-line" style="height:14px;width:75%;"></div>
            <div style="display:flex;gap:1.5rem;margin-top:auto;">
                <div class="skeleton-line" style="height:14px;width:110px;"></div>
                <div class="skeleton-line" style="height:14px;width:90px;"></div>
            </div>
            <div class="skeleton-line" style="height:36px;width:160px;border-radius:8px;margin-top:0.25rem;"></div>
        </div>
    </div>`;

function buildEventCard(ev) {
    const dateStr = ev.date
        ? new Date(ev.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'TBD';
    const registrationOpen = ev.registration_deadline ? new Date(ev.registration_deadline) > new Date() : true;
    const isFeatured = ev.featured === true;

    // Calculate Status
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let statusLabel = "Upcoming";
    let statusColor = "#fff";
    let statusBg = "rgba(255,255,255,0.1)";
    let statusBorder = "rgba(255,255,255,0.2)";

    if (ev.date) {
        const evDate = new Date(ev.date);
        if (!isNaN(evDate)) {
            const eventDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
            const diffTime = eventDay.getTime() - today.getTime();
            if (diffTime === 0) {
                statusLabel = "Live Now";
                statusColor = "#00e6b8"; // Accent green
                statusBg = "rgba(0,204,170,0.15)";
                statusBorder = "rgba(0,204,170,0.3)";
            } else if (diffTime > 0) {
                statusLabel = "Upcoming";
            } else {
                statusLabel = "Completed";
                statusColor = "#aaa";
                statusBg = "rgba(255,255,255,0.05)";
                statusBorder = "rgba(255,255,255,0.1)";
            }
        }
    }

    const imgSide = ev.image_url
        ? `<img src="${ev.image_url}" alt="${ev.title || 'Event banner'}"
               style="width:100%;height:100%;object-fit:cover;display:block;"
               loading="lazy"
               onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,rgba(108,99,255,0.3),rgba(0,204,170,0.2))';">`
        : '';   /* no image — gradient fallback */

    const overlayColor = ev.overlay_color || '#02040a';

    return `
        <div class="event-full-card" data-reveal="scale-center" data-type="${ev.type || 'other'}"
             style="background:${overlayColor};">

            <!-- Left: image panel fades smoothly into background -->
            <div class="event-card-img-panel" style="
                background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(0,204,170,0.05));
            ">
                ${ev.image_url ? `<img src="${ev.image_url}" alt="${ev.title || 'Event banner'}"
               style="width:100%;height:100%;object-fit:cover;display:block;"
               loading="lazy"
               onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,204,170,0.05))';">` : ''}
                <!-- Fade overlay from transparent to background color on the right -->
                <div class="event-card-img-gradient" style="background:linear-gradient(to right, transparent 50%, ${overlayColor} 100%);"></div>
            </div>

            <!-- Right: details -->
            <div class="event-card-body">

                <!-- Badges -->
                <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;">
                    ${isFeatured ? `<span style="
                        background: rgba(255,215,0,0.1);
                        border: 1px solid rgba(255,215,0,0.2);
                        color: #ffd700;
                        font-size: 0.7rem;
                        font-weight: 700;
                        padding: 0.35rem 0.8rem;
                        border-radius: 20px;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                    ">⭐ Featured</span>` : ''}
                    <span style="
                        background: ${statusBg};
                        border: 1px solid ${statusBorder};
                        color: ${statusColor};
                        font-size: 0.7rem;
                        font-weight: 600;
                        padding: 0.35rem 0.8rem;
                        border-radius: 20px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">${statusLabel}</span>
                    ${ev.type ? `<span style="
                        background: transparent;
                        border: 1px solid rgba(255,255,255,0.1);
                        color: #fff;
                        font-size: 0.7rem;
                        font-weight: 600;
                        padding: 0.35rem 0.8rem;
                        border-radius: 20px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">${ev.type}</span>` : ''}
                </div>

                <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1.85rem;margin:0;color:#fff;line-height:1.2;font-weight:700;">${ev.title || 'Event'}</h3>

                ${ev.description ? `<p style="color:#aaa;font-size:0.95rem;line-height:1.6;margin:0;">${ev.description.slice(0, 150)}${ev.description.length > 150 ? '…' : ''}</p>` : ''}

                <!-- Meta row -->
                <div class="event-card-meta" style="margin-top:auto;padding-top:1rem;color:#ccc;font-size:0.85rem;display:flex;gap:1.5rem;align-items:center;">
                    <span style="display:flex;align-items:center;gap:0.4rem;">📅 ${dateStr}</span>
                    ${ev.location ? `<span style="display:flex;align-items:center;gap:0.4rem;">📍 ${ev.location}</span>` : ''}
                </div>

                <!-- CTA -->
                ${registrationOpen
                    ? `<a href="./register.html?event_id=${ev.id}" class="event-register-btn" style="
                        display:inline-block;
                        padding:0.6rem 1.5rem;
                        border-radius:8px;
                        background:rgba(255,255,255,0.1);
                        border:1px solid rgba(255,255,255,0.15);
                        color:#fff;
                        font-size:0.9rem;
                        font-weight:600;
                        text-decoration:none;
                        width:fit-content;
                        backdrop-filter:blur(4px);
                        margin-top:0.5rem;
                        transition:all 0.2s;
                      " onmouseover="this.style.background='rgba(255,255,255,0.2)';this.style.borderColor='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.1)';this.style.borderColor='rgba(255,255,255,0.15)'">Register Now</a>`
                    : `<span style="
                        display:inline-block;
                        padding:0.6rem 1.5rem;
                        border-radius:8px;
                        background:rgba(255,255,255,0.03);
                        border:1px solid rgba(255,255,255,0.05);
                        color:#777;
                        font-size:0.9rem;
                        font-weight:500;
                        width:fit-content;
                        margin-top:0.5rem;
                      ">Registration Closed</span>`
                }
            </div>
        </div>`;
}

// ─── keep original load-events logic but wrap it ─────────────────────
async function loadEventsPreview() {
    const container = document.getElementById('home-flagship-container');
    if (!container) { resolveDataSource('events'); return; }

    // show skeleton
    container.innerHTML = `<div class="event-poster-container">
        ${SKELETON_EVENT}</div>`;

    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('date', { ascending: false }); // Fetch recent to fallback if no featured

        if (error) {
            console.error('Supabase fetch error (preview):', error);
            throw error;
        }



        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#aaa;">No upcoming events.</p>';
            return;
        }

        // Helper: check if registration is open
        const isRegOpen = (ev) => ev.registration_deadline ? new Date(ev.registration_deadline) > new Date() : true;

        // Priority: 1. Featured + registration open
        //           2. Any event with registration open (nearest date first)
        //           3. Featured (even if closed)
        //           4. Most recent event
        const openEvents = data.filter(isRegOpen);
        const selectedEvent =
            openEvents.find(ev => ev.featured) ||
            openEvents[0] ||
            data.find(ev => ev.featured) ||
            data[0];

        // Ensure badge gets set properly if we picked it because it's featured
        if (selectedEvent === data.find(ev => ev.featured)) {
            selectedEvent.featured = true;
        }

        container.innerHTML = `<div class="event-poster-container">
        ${buildEventCard(selectedEvent)}</div>`;

        document.dispatchEvent(new CustomEvent('lrnit:dataLoaded'));
    } catch (err) {
        console.error('Error loading events preview:', err);
        container.innerHTML = '<p style="text-align:center;color:#ff3366;">Could not load events.</p>';
    } finally {
        resolveDataSource('events');
    }
}

async function loadAllEvents() {
    const grid = document.getElementById('events-full-grid');
    if (!grid) { resolveDataSource('events'); return; }

    grid.innerHTML = '';

    try {
        const { data, error } = await supabase
            .from('events')
            .select('*');

        if (error) {
            console.error('Supabase fetch error (all):', error);
            throw error;
        }



        if (!data || data.length === 0) {
            // Render empty state BEFORE hiding loader
            grid.innerHTML = '<div class="events-state"><p>No events available.</p></div>';
        } else {
            // --- Advanced Sorting Logic ---
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const featured = [];
            const currentEvents = [];
            const upcomingEvents = [];
            const pastEvents = [];
            const edgeCases = [];

            data.forEach(ev => {
                if (ev.featured) {
                    featured.push(ev);
                    return;
                }
                
                if (!ev.date) {
                    edgeCases.push(ev);
                    return;
                }

                const evDate = new Date(ev.date);
                if (isNaN(evDate)) {
                    edgeCases.push(ev);
                    return;
                }

                const eventDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
                const diffTime = eventDay.getTime() - today.getTime();

                if (diffTime === 0) {
                    currentEvents.push(ev);
                } else if (diffTime > 0) {
                    upcomingEvents.push(ev);
                } else {
                    pastEvents.push(ev);
                }
            });

            // Sub-Sorting rules
            upcomingEvents.sort((a, b) => new Date(a.date) - new Date(b.date)); // Nearest first
            pastEvents.sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent past first
            
            const finalEvents = [
                ...featured,
                ...currentEvents,
                ...upcomingEvents,
                ...pastEvents,
                ...edgeCases
            ];

            // Render cards to DOM first (hidden via cl-reveal), THEN animate loader out
            const cards = finalEvents.map(ev => buildEventCard(ev));
            grid.innerHTML = cards.join('');
            grid.className = 'events-poster-list event-poster-container';

            // Mark all cards for reveal animation (start hidden)
            grid.querySelectorAll('.event-full-card').forEach(card => {
                card.classList.add('cl-reveal');
            });

            // Set up filter buttons
            const filters = document.querySelectorAll('.filter-btn');
            filters.forEach(btn => {
                btn.addEventListener('click', () => {
                    filters.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const f = btn.dataset.filter;
                    grid.querySelectorAll('.event-full-card').forEach(card => {
                        card.style.display = (f === 'all' || card.dataset.type === f) ? '' : 'none';
                    });
                });
            });

            document.dispatchEvent(new CustomEvent('lrnit:dataLoaded'));
        }

    } catch (err) {
        console.error('Error loading all events:', err);
        // Keep fallback in grid so UI never breaks
        grid.innerHTML = '<div class="events-state"><p style="color:#ff3366;">Could not load events. Please try again later.</p></div>';
    } finally {
        resolveDataSource('events');
    }
}

function initEvents() {
    if (document.getElementById('home-flagship-container')) loadEventsPreview();
    if (document.getElementById('events-full-grid')) loadAllEvents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEvents);
} else {
    initEvents();
}
