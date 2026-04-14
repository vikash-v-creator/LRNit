// load-announcements.js — Public-facing announcements loader from Supabase
import { supabase } from "./supabase-client.js";
import { resolveDataSource } from "./init.js";

const priorityRank = { urgent: 1, important: 2, normal: 3 };
const priorityBadgeConfig = {
    urgent:    { label: "URGENT",    cssClass: "urgent" },
    important: { label: "IMPORTANT", cssClass: "important" },
    normal:    { label: "UPDATE",    cssClass: "normal" },
};

const SKELETON_ANNOUNCEMENT = `
    <div class="announcement-card skeleton-card" aria-hidden="true">
        <div class="skeleton-line" style="height:20px;width:30%;margin-bottom:0.75rem;"></div>
        <div class="skeleton-line" style="height:18px;width:70%;margin-bottom:0.5rem;"></div>
        <div class="skeleton-line" style="height:14px;width:90%;margin-bottom:0.3rem;"></div>
        <div class="skeleton-line" style="height:14px;width:75%;margin-bottom:0.75rem;"></div>
        <div class="skeleton-line" style="height:12px;width:25%;"></div>
    </div>`;

async function loadAnnouncements() {
    const grid = document.querySelector(".announcement-grid");
    if (!grid) { resolveDataSource('announcements'); return; }

    grid.innerHTML = SKELETON_ANNOUNCEMENT.repeat(3);

    try {
        const { data, error } = await supabase
            .from("announcements")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(3);

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:#aaa;grid-column:1/-1;">No announcements right now.</p>';
            return;
        }

        data.sort((a, b) => {
            const rankA = priorityRank[a.priority] ?? 3;
            const rankB = priorityRank[b.priority] ?? 3;
            if (rankA !== rankB) return rankA - rankB;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        grid.innerHTML = "";
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
            card.className = `announcement-card ${priority}`;
            card.setAttribute('data-reveal', 'slide-left');
            card.innerHTML = `
                <span class="announcement-badge ${badge.cssClass}">${badge.label}</span>
                <h3>${item.title || "Announcement"}</h3>
                <p>${item.description || ""}</p>
                <div class="announcement-date">${dateStr}</div>
            `;
            grid.appendChild(card);
        });

        document.dispatchEvent(new CustomEvent('lrnit:dataLoaded'));
    } catch (err) {
        console.error("Error loading announcements:", err);
        grid.innerHTML = '<p style="text-align:center;color:#ff3366;grid-column:1/-1;">Could not load announcements.</p>';
    } finally {
        resolveDataSource('announcements');
    }
}

document.addEventListener("DOMContentLoaded", loadAnnouncements);
