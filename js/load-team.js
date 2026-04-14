import { supabase } from "./supabase-client.js";
import { resolveDataSource } from "./init.js";
import { initTeamModal, openTeamModal, getSocialsHtml } from "./team-modal.js";

const SKELETON_TEAM = `
    <div class="team-card skeleton-card" aria-hidden="true">
        <div class="team-avatar">
            <div class="skeleton-circle" style="width:90px;height:90px;margin:0 auto 1rem;border-radius:50%;"></div>
        </div>
        <div class="skeleton-line" style="height:18px;width:60%;margin:0 auto 0.5rem;"></div>
        <div class="skeleton-line" style="height:14px;width:45%;margin:0 auto;"></div>
    </div>`;

async function loadTeam() {
    const grid = document.getElementById("team-grid");
    if (!grid) { resolveDataSource('team'); return; }

    grid.innerHTML = SKELETON_TEAM.repeat(4);

    try {
        const { data, error } = await supabase
            .from("team")
            .select("*")
            .order("display_order", { ascending: true })
            .limit(4);

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `<p class="text-center" style="color:var(--text-muted,#aaa);grid-column:1/-1;">No team members found.</p>`;
            return;
        }

        initTeamModal();
        grid.innerHTML = "";
        data.forEach((d) => {
            const initials = (d.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
            const imgUrl = d.image_url;
            const initialsPlaceholder = `<div class="team-avatar-placeholder">${initials}</div>`;
            const avatar = imgUrl
                ? `<img src="${imgUrl}" alt="${d.name}" class="team-avatar-img" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='${initialsPlaceholder.replace(/"/g, "&quot;")}'">` 
                : initialsPlaceholder;

            const card = document.createElement("div");
            card.className = "team-card";
            card.setAttribute('data-reveal', 'scale-center');
            card.innerHTML = `
                <div class="team-avatar">${avatar}</div>
                <h3 class="team-name">${d.name || ""}</h3>
                <p class="team-role">${d.role || ""}</p>
                ${getSocialsHtml(d, false)}
            `;
            card.addEventListener('click', () => openTeamModal(d));
            grid.appendChild(card);
        });

        document.dispatchEvent(new CustomEvent('lrnit:dataLoaded'));
    } catch (err) {
        console.error("Error loading team:", err);
        grid.innerHTML = `<p class="text-center" style="color:#ff3366;grid-column:1/-1;">Could not load team.</p>`;
    } finally {
        resolveDataSource('team');
    }
}

loadTeam();
