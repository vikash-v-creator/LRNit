// load-gallery-full.js — Full gallery page loader with split-screen detail panel
import { supabase } from "./supabase-client.js";
import { state } from "./state.js";

async function loadGalleryFull() {
    const grid = document.getElementById("gallery-masonry");
    if (!grid) return;

    try {
        const { data, error } = await supabase
            .from("gallery")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = '<div class="gallery-state"><p>No photos in gallery yet.</p></div>';
            return;
        }

        grid.innerHTML = "";
        const fallbackImg = "./assets/placeholder.webp";

        data.forEach((item) => {
            const el = document.createElement("div");
            el.className = `masonry-item cl-reveal ${state.loaderDone ? 'cl-reveal--visible' : ''}`;
            el.setAttribute("data-src", item.image_url || fallbackImg);
            el.setAttribute("data-title", item.title || "");
            el.setAttribute("data-description", item.description || "");
            el.innerHTML = `
                <img src="${item.image_url || fallbackImg}" alt="${item.title || 'Gallery Image'}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}'">
                <div class="masonry-overlay">
                    <h4>${item.title || ""}</h4>
                    ${item.description ? `<p>${item.description}</p>` : ""}
                </div>
            `;
            el.addEventListener("click", () => openDetailPanel(
                item.image_url || fallbackImg,
                item.title || "",
                item.description || ""
            ));
            grid.appendChild(el);
        });

    } catch (err) {
        console.error("Error loading gallery:", err);
        grid.innerHTML = '<div class="gallery-state"><p style="color:#ff3366;">Could not load gallery.</p></div>';
    }
}

// ── Split-Screen Detail Panel ─────────────────────────────────────────────────

function openDetailPanel(src, title, description) {
    const panel       = document.getElementById("img-detail-panel");
    const img         = document.getElementById("panel-img");
    const titleEl     = document.getElementById("panel-title");
    const descEl      = document.getElementById("panel-description");

    if (!panel || !img) return;

    // Reset animation so it replays every time
    panel.classList.remove("active");
    void panel.offsetWidth; // reflow trigger

    img.src = src;
    img.alt = title || "Gallery Image";

    titleEl.textContent = title || "Untitled";

    if (description && description.trim()) {
        descEl.textContent = description;
        descEl.classList.remove("panel-no-desc");
    } else {
        descEl.textContent = "No description available.";
        descEl.classList.add("panel-no-desc");
    }

    panel.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeDetailPanel() {
    const panel = document.getElementById("img-detail-panel");
    if (!panel) return;
    panel.classList.remove("active");
    document.body.style.overflow = "";
}

// Wire up close handlers
document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("panel-close");
    const panel    = document.getElementById("img-detail-panel");

    if (closeBtn) closeBtn.addEventListener("click", closeDetailPanel);

    // Click dark background (outside the modal container) to close
    if (panel) {
        panel.addEventListener("click", (e) => {
            if (e.target === panel) {
                closeDetailPanel();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDetailPanel();
    });
});

document.addEventListener("DOMContentLoaded", loadGalleryFull);
