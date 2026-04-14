// load-gallery.js — Public-facing gallery loader from Supabase
import { supabase } from "./supabase-client.js";
import { resolveDataSource } from "./init.js";

const SKELETON_GALLERY = `
    <div class="gallery-item skeleton-card" aria-hidden="true">
        <div class="skeleton-block" style="width:100%;height:100%;border-radius:12px;"></div>
    </div>`;

async function loadGallery() {
    const grid = document.querySelector(".gallery-grid");
    if (!grid) { resolveDataSource('gallery'); return; }

    grid.innerHTML = SKELETON_GALLERY.repeat(6);

    try {
        const { data, error } = await supabase
            .from("gallery")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(6);

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:#aaa;grid-column:1/-1;">No photos in gallery yet.</p>';
            return;
        }

        grid.innerHTML = "";
        const fallbackImg = "./assets/placeholder.webp";
        data.forEach((item) => {
            const el = document.createElement("div");
            el.className = "gallery-item";
            el.setAttribute('data-reveal', 'clip-wipe');
            el.innerHTML = `
                <img src="${item.image_url || fallbackImg}" alt="${item.title || 'Gallery Image'}" class="gallery-img" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}'" style="width:100%;height:100%;display:block;object-fit:cover;">
                <div class="gallery-overlay">
                    <h4>${item.title || ""}</h4>
                    ${item.description ? `<p style="font-size:0.85rem;padding:0.5rem 1rem;">${item.description}</p>` : ""}
                </div>
            `;
            grid.appendChild(el);
        });

        document.dispatchEvent(new CustomEvent('lrnit:dataLoaded'));
    } catch (err) {
        console.error("Error loading gallery:", err);
        grid.innerHTML = '<p style="text-align:center;color:#ff3366;grid-column:1/-1;">Could not load gallery.</p>';
    } finally {
        resolveDataSource('gallery');
    }
}

document.addEventListener("DOMContentLoaded", loadGallery);
