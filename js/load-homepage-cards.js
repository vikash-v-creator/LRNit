// load-homepage-cards.js — Fetches dynamic homepage cards from Supabase
import { supabase } from "./supabase-client.js";
import { resolveDataSource } from "./init.js";
import { state } from "./state.js";

const SKELETON_PHILOSOPHY = `
    <div class="philosophy-card skeleton-card" aria-hidden="true">
        <div class="skeleton-circle" style="width:64px;height:64px;margin:0 auto 1rem;border-radius:50%;"></div>
        <div class="skeleton-line" style="height:22px;width:55%;margin:0 auto 0.75rem;"></div>
        <div class="skeleton-line" style="height:14px;width:88%;margin:0 auto 0.4rem;"></div>
        <div class="skeleton-line" style="height:14px;width:74%;margin:0 auto;"></div>
    </div>`;

const SKELETON_ABOUT = `
    <div class="about-card skeleton-card" aria-hidden="true">
        <div class="skeleton-circle" style="width:56px;height:56px;margin:0 auto 1rem;border-radius:50%;"></div>
        <div class="skeleton-line" style="height:20px;width:50%;margin:0 auto 0.75rem;"></div>
        <div class="skeleton-line" style="height:14px;width:90%;margin:0 auto 0.4rem;"></div>
        <div class="skeleton-line" style="height:14px;width:78%;margin:0 auto;"></div>
    </div>`;

async function loadHomepageCards() {
    const pillarsGrid = document.getElementById("pillars-grid");
    const clubGrid    = document.getElementById("club-grid");

    // Show skeletons
    if (pillarsGrid) pillarsGrid.innerHTML = SKELETON_PHILOSOPHY.repeat(3);
    if (clubGrid)    clubGrid.innerHTML    = SKELETON_ABOUT.repeat(3);

    try {
        const { data, error } = await supabase
            .from("homepage_cards")
            .select("id, section, title, description, icon, order_index")
            .order("order_index", { ascending: true });

        if (error) throw error;

        const pillars  = data.filter(c => c.section === "pillars");
        const clubInfo = data.filter(c => c.section === "club");

        if (pillarsGrid) {
            if (pillars.length === 0) {
                pillarsGrid.innerHTML = "<p style='text-align:center;color:#aaa;width:100%;'>No pillars found.</p>";
            } else {
                const cardsHtml = pillars.map((card, i) => `
                    <div class="philosophy-card face-${i}">
                        <div class="philo-icon"><i data-lucide="${card.icon}"></i></div>
                        <h3>${sanitize(card.title)}</h3>
                        <p>${sanitize(card.description)}</p>
                    </div>`).join("");
                
                pillarsGrid.innerHTML = `
                    <div class="philo-side-btn left" id="philo-prev" aria-label="Rotate Left">
                        <i class="bx bx-chevron-left"></i>
                    </div>
                    <div class="philo-scene" id="philo-scene">
                        <div class="philo-cylinder" id="philo-cylinder">
                            ${cardsHtml}
                        </div>
                    </div>
                    <div class="philo-side-btn right" id="philo-next" aria-label="Rotate Right">
                        <i class="bx bx-chevron-right"></i>
                    </div>
                `;
                
                initCylinderRotation("philo-scene", "philo-cylinder", "philo-prev", "philo-next", ".philosophy-card");
            }
        }

        if (clubGrid) {
            if (clubInfo.length === 0) {
                clubGrid.innerHTML = "<p style='text-align:center;color:#aaa;width:100%;'>No club info found.</p>";
            } else {
                const clubCardsHtml = clubInfo.map((card, i) => `
                    <div class="about-card face-${i}">
                        <div class="card-icon" style="display:flex;justify-content:center;align-items:center;"><i data-lucide="${card.icon}" style="width:2.5rem;height:2.5rem;color:#fff;"></i></div>
                        <h3>${sanitize(card.title)}</h3>
                        <p>${sanitize(card.description)}</p>
                    </div>`).join("");

                clubGrid.innerHTML = `
                    <div class="philo-side-btn left" id="club-prev" aria-label="Rotate Left">
                        <i class="bx bx-chevron-left"></i>
                    </div>
                    <div class="philo-scene" id="club-scene">
                        <div class="philo-cylinder" id="club-cylinder">
                            ${clubCardsHtml}
                        </div>
                    </div>
                    <div class="philo-side-btn right" id="club-next" aria-label="Rotate Right">
                        <i class="bx bx-chevron-right"></i>
                    </div>
                `;

                initCylinderRotation("club-scene", "club-cylinder", "club-prev", "club-next", ".about-card");
            }
        }

        if (window.lucide) lucide.createIcons();

        // Notify scroll reveals to re-observe new cards
        document.dispatchEvent(new CustomEvent('lrnit:dataLoaded'));

    } catch (err) {
        console.error("Error loading homepage cards:", err);
        if (pillarsGrid) pillarsGrid.innerHTML = "<p style='text-align:center;color:#e53030;grid-column:1/-1;'>Failed to load pillars.</p>";
        if (clubGrid)    clubGrid.innerHTML    = "<p style='text-align:center;color:#e53030;grid-column:1/-1;'>Failed to load club info.</p>";
    } finally {
        resolveDataSource('homepage_cards');
    }
}

function sanitize(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function initCylinderRotation(sceneId, cylinderId, prevId, nextId, cardSelector) {
    const scene = document.getElementById(sceneId);
    const cylinder = document.getElementById(cylinderId);
    const prevBtn = document.getElementById(prevId);
    const nextBtn = document.getElementById(nextId);
    const cards = cylinder ? cylinder.querySelectorAll(cardSelector) : [];
    
    if (!cylinder || cards.length === 0) return;

    let selectedIndex = 0;
    const totalFaces = cards.length;
    let isDragging = false;
    let startX = 0;
    
    function updateRotation() {
        // Rotate container
        const degrees = selectedIndex * -120;
        cylinder.style.transform = `rotateY(${degrees}deg)`;
        
        // Active focus state handling
        const normalizedIndex = ((selectedIndex % totalFaces) + totalFaces) % totalFaces;
        cards.forEach((card, i) => {
            if (i === normalizedIndex) {
                card.classList.add("active");
            } else {
                card.classList.remove("active");
            }
        });
    }

    updateRotation(); // Trigger initial state

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            selectedIndex--;
            updateRotation();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            selectedIndex++;
            updateRotation();
        });
    }

    function handleDragStart(e) {
        isDragging = true;
        startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    }
    
    function handleDragEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        
        const endX = e.type === "touchend" ? e.changedTouches[0].clientX : e.clientX;
        const diff = endX - startX;
        
        // Threshold check to step rotation
        if (diff > 50) {
            selectedIndex--; // Swipe right, rotate prev
        } else if (diff < -50) {
            selectedIndex++; // Swipe left, rotate next
        }
        
        updateRotation();
    }

    if (scene) {
        scene.addEventListener("mousedown", handleDragStart);
        scene.addEventListener("touchstart", handleDragStart, { passive: true });
    }
    
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchend", handleDragEnd);
}

document.addEventListener("DOMContentLoaded", loadHomepageCards);
