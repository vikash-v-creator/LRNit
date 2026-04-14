// load-team-full.js — Team page with leadership hierarchy & department navigation
import { supabase } from "./supabase-client.js";
import { state } from "./state.js";
import { initTeamModal, openTeamModal, getSocialsHtml } from "./team-modal.js";

// Department display name mapping
const DEPT_LABELS = {
    event_planning: "Event Planning",
    tech: "Tech",
    sponsorship: "Sponsorship",
    marketing: "Marketing",
    hr: "HR",
    pr: "PR",
};

// Helper: get initials from name
function getInitials(name) {
    return (name || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// Helper: build avatar HTML
function buildAvatar(member, className) {
    const initials = getInitials(member.name);
    if (member.image_url) {
        return `<div class="${className}"><img src="${member.image_url}" alt="${member.name}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<span class=\\'initials\\'>${initials}</span>'"></div>`;
    }
    return `<div class="${className}"><span class="initials">${initials}</span></div>`;
}

// Main loader
async function loadTeamPage() {
    const loading = document.getElementById("team-loading");
    const leadershipSection = document.getElementById("team-leadership");
    const departmentsSection = document.getElementById("team-departments");
    const deptViewSection = document.getElementById("team-department-view");

    if (!leadershipSection || !departmentsSection || !deptViewSection) return;

    try {
        // Fetch ALL team data once
        const { data: teamData, error } = await supabase
            .from("team")
            .select("*")
            .order("display_order", { ascending: true });

        if (error) throw error;



        // Hide loading
        if (loading) loading.style.display = "none";

        if (!teamData || teamData.length === 0) {
            leadershipSection.style.display = "block";
            document.getElementById("team-leadership-grid").innerHTML =
                '<div class="team-state"><p>No team members found.</p></div>';
            return;
        }

        initTeamModal();
        


        // Check if we're in department view
        const params = new URLSearchParams(window.location.search);
        const selectedDept = params.get("department");

        if (selectedDept && DEPT_LABELS[selectedDept]) {
            renderDepartmentView(teamData, selectedDept, deptViewSection);
        } else {
            renderMainView(teamData, leadershipSection, departmentsSection);
        }

        // Trigger reveal animations
        document.dispatchEvent(new CustomEvent("lrnit:dataLoaded"));

    } catch (err) {
        console.error("Error loading team:", err);
        if (loading) loading.style.display = "none";
        const grid = document.getElementById("team-leadership");
        if (grid) {
            grid.style.display = "block";
            document.getElementById("team-leadership-grid").innerHTML =
                '<div class="team-state"><p style="color:#ff3366;">Could not load team data.</p></div>';
        }
    }
}

// ═══════════════════════════════════════════════
//  MAIN VIEW — Leadership + Departments
// ═══════════════════════════════════════════════
function renderMainView(teamData, leadershipSection, departmentsSection) {
    // Filter leadership
    const ceo = teamData.filter((m) => m.role_level === "ceo");
    const managers = teamData.filter((m) => m.role_level === "manager");
    const deptHeads = teamData.filter((m) => m.is_head === true && m.department);



    // ── Leadership Section ──
    const leadershipGrid = document.getElementById("team-leadership-grid");
    leadershipGrid.innerHTML = "";

    // CEO cards
    ceo.forEach((member) => {
        const card = document.createElement("div");
        card.className = `team-leader-card ceo-card cl-reveal ${state.loaderDone ? "cl-reveal--visible" : ""}`;
        card.innerHTML = `
            ${buildAvatar(member, "leader-avatar")}
            <h3>${member.name || ""}</h3>
            <div class="role">${member.role || "CEO"}</div>
            ${getSocialsHtml(member, false)}
        `;
        card.addEventListener('click', () => openTeamModal(member));
        leadershipGrid.appendChild(card);
    });

    // Manager cards
    managers.forEach((member) => {
        const card = document.createElement("div");
        card.className = `team-leader-card cl-reveal ${state.loaderDone ? "cl-reveal--visible" : ""}`;
        card.innerHTML = `
            ${buildAvatar(member, "leader-avatar")}
            <h3>${member.name || ""}</h3>
            <div class="role">${member.role || "Manager"}</div>
            ${getSocialsHtml(member, false)}
        `;
        card.addEventListener('click', () => openTeamModal(member));
        leadershipGrid.appendChild(card);
    });

    leadershipSection.style.display = "block";

    // ── Departments Section ──
    if (deptHeads.length > 0) {
        const deptGrid = document.getElementById("team-departments-grid");
        deptGrid.innerHTML = "";

        // Group heads by department
        const deptMap = new Map();
        deptHeads.forEach((head) => {
            if (!deptMap.has(head.department)) {
                deptMap.set(head.department, []);
            }
            deptMap.get(head.department).push(head);
        });

        // Build one block per department showing independent head cards
        deptMap.forEach((heads, dept) => {
            const deptLabel = DEPT_LABELS[dept] || dept;

            let headsHtml = '';
            heads.forEach(h => {
                const initials = getInitials(h.name);
                const avatarImg = h.image_url 
                    ? `<img src="${h.image_url}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<span class=\\'initials\\'>${initials}</span>'">`
                    : `<span class="initials">${initials}</span>`;
                
                headsHtml += `
                    <div class="head-card" data-id="${h.id}">
                        <div class="avatar">${avatarImg}</div>
                        <h4>${h.name || ""}</h4>
                        <p>${h.role || ""}</p>
                    </div>
                `;
            });

            const block = document.createElement("div");
            block.className = `department-block cl-reveal ${state.loaderDone ? "cl-reveal--visible" : ""}`;
            block.setAttribute("data-department", dept);
            block.innerHTML = `
                <div class="dept-header" title="View all members of ${deptLabel}">
                    <h3>${deptLabel} <span class="view-all-icon">→</span></h3>
                    <p class="dept-sub">Heads of Department</p>
                </div>
                <div class="dept-heads">${headsHtml}</div>
                <div style="margin-top: 2.5rem;">
                    <button class="team-view-more-btn" data-dept="${dept}">View Rest of ${deptLabel} Team</button>
                </div>
            `;

            // Click routing for the department label to see all members
            const header = block.querySelector('.dept-header');
            header.addEventListener('click', () => {
                window.location.href = `team.html?department=${dept}`;
            });

            // Click routing for the View More button
            const viewMoreBtn = block.querySelector('.team-view-more-btn');
            if (viewMoreBtn) {
                viewMoreBtn.addEventListener('click', () => {
                    window.location.href = `team.html?department=${dept}`;
                });
            }

            // Re-bind Profile modal clicks for independent head cards
            const headCards = block.querySelectorAll('.head-card');
            headCards.forEach(card => {
                 card.addEventListener('click', (e) => {
                     e.stopPropagation(); // Avoid triggering anything above
                     const id = card.getAttribute('data-id');
                     const member = teamData.find(m => String(m.id) === id);
                     if (member) openTeamModal(member);
                 });
            });

            deptGrid.appendChild(block);
        });

        departmentsSection.style.display = "block";
    }
}

// ═══════════════════════════════════════════════
//  DEPARTMENT VIEW — Full member list
// ═══════════════════════════════════════════════
function renderDepartmentView(teamData, selectedDept, deptViewSection) {
    const deptLabel = DEPT_LABELS[selectedDept] || selectedDept;

    // Update page title & subtitle
    document.getElementById("team-subtitle").textContent = `All members of the ${deptLabel} department.`;
    document.querySelector(".team-page-hero h1").innerHTML = `<span class="gradient-text">${deptLabel}</span> Team`;
    document.title = `${deptLabel} Team | LRNit`;

    // Update dept view title
    document.getElementById("dept-view-title").innerHTML = `<span class="accent">${deptLabel}</span> Members`;

    // Filter members for this department
    const deptMembers = teamData.filter((m) => m.department === selectedDept);



    // Sort: head first, then others
    deptMembers.sort((a, b) => {
        if (a.is_head && !b.is_head) return -1;
        if (!a.is_head && b.is_head) return 1;
        return (a.display_order || 0) - (b.display_order || 0);
    });

    const grid = document.getElementById("team-dept-view-grid");
    grid.innerHTML = "";

    if (deptMembers.length === 0) {
        grid.innerHTML = '<div class="team-state"><p>No members in this department yet.</p></div>';
    } else {
        deptMembers.forEach((member) => {
            const card = document.createElement("div");
            const headClass = member.is_head ? " is-head" : "";
            card.className = `team-member-card${headClass} cl-reveal ${state.loaderDone ? "cl-reveal--visible" : ""}`;
            card.innerHTML = `
                ${member.is_head ? '<span class="head-badge">Department Head</span>' : ""}
                ${buildAvatar(member, "member-avatar")}
                <h3>${member.name || ""}</h3>
                <div class="role">${member.role || ""}</div>
                ${getSocialsHtml(member, false)}
            `;
            card.addEventListener('click', () => openTeamModal(member));
            grid.appendChild(card);
        });
    }

    deptViewSection.style.display = "block";
}



// Start
document.addEventListener("DOMContentLoaded", loadTeamPage);
