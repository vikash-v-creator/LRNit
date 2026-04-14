// load-announcements-full.js — Full announcements page loader from Supabase
// Sorted by priority (urgent → important → normal), then by date descending
import { supabase } from "./supabase-client.js";
import { state } from "./state.js";

const priorityRank = { urgent: 1, important: 2, normal: 3 };

const priorityBadgeConfig = {
    urgent:    { label: "URGENT",    cssClass: "urgent" },
    important: { label: "IMPORTANT", cssClass: "important" },
    normal:    { label: "UPDATE",    cssClass: "normal" },
};

let allAnnouncements = [];

async function loadAnnouncementsFull() {
    const grid = document.getElementById("announcements-full-grid");
    if (!grid) return;

    try {
        const { data, error } = await supabase
            .from("announcements")
            .select("*");

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = '<div class="announcements-state"><p>No announcements right now.</p></div>';
            return;
        }

        // Client-side sort: priority first, then newest first
        data.sort((a, b) => {
            const rankA = priorityRank[a.priority] ?? 3;
            const rankB = priorityRank[b.priority] ?? 3;
            if (rankA !== rankB) return rankA - rankB;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        allAnnouncements = data;
        renderAnnouncements(data, grid);
        setupFilters(grid);

    } catch (err) {
        console.error("Error loading announcements:", err);
        grid.innerHTML = '<div class="announcements-state"><p style="color:#ff3366;">Could not load announcements.</p></div>';
    }
}

function renderAnnouncements(data, grid) {
    grid.innerHTML = "";

    if (data.length === 0) {
        grid.innerHTML = '<div class="announcements-state"><p>No announcements match this filter.</p></div>';
        return;
    }

    data.forEach((item) => {
        const priority = item.priority || "normal";
        const badge = priorityBadgeConfig[priority] || priorityBadgeConfig.normal;

        let dateStr = "Recently";
        if (item.created_at) {
            dateStr = new Date(item.created_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric"
            });
        }

        const card = document.createElement("div");
        card.className = `announcement-card ${priority} cl-reveal ${state.loaderDone ? 'cl-reveal--visible' : ''}`;
        card.innerHTML = `
            <span class="announcement-badge ${badge.cssClass}">${badge.label}</span>
            <h3>${item.title || "Announcement"}</h3>
            <p>${item.description || ""}</p>
            <div class="announcement-date">${dateStr}</div>
        `;
        grid.appendChild(card);
    });
}

function setupFilters(grid) {
    const filterContainer = document.getElementById("announcements-filters");
    if (!filterContainer) return;

    filterContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".filter-btn");
        if (!btn) return;

        // Toggle active
        filterContainer.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const filter = btn.dataset.filter;
        if (filter === "all") {
            renderAnnouncements(allAnnouncements, grid);
        } else {
            const filtered = allAnnouncements.filter(a => (a.priority || "normal") === filter);
            renderAnnouncements(filtered, grid);
        }
    });
}

document.addEventListener("DOMContentLoaded", loadAnnouncementsFull);
