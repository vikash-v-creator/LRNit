// admin.js — Admin Dashboard Logic (Supabase edition)
import { supabase } from "../js/supabase-client.js";

// ─── Auth Guard ──────────────────────────────────────────────────────────────
const adminEmail = document.getElementById("admin-email");
const logoutBtn  = document.getElementById("logout-btn");

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = "login.html";
        return;
    }
    if (adminEmail) adminEmail.textContent = session.user.email;
    initDashboard();
}

checkAuth();

// Refresh on auth change (e.g. token refresh or sign-out from another tab)
supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        window.location.href = "login.html";
    }
});

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
});

// ─── Tab Navigation ──────────────────────────────────────────────────────────
const tabs     = document.querySelectorAll(".nav-links li[data-tab]");
const tabPanes = document.querySelectorAll(".tab-pane");

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tabPanes.forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        const targetId = tab.getAttribute("data-tab");
        document.getElementById(targetId).classList.add("active");
        document.getElementById("page-title").textContent = tab.querySelector("span").textContent;
    });
});

// ─── Dashboard Initialization ─────────────────────────────────────────────────
function initDashboard() {
    listenToMembers();
    loadEvents();
    loadTeam();
    loadHeroContent();
    loadGallery();
    loadAnnouncements();
    loadHomepageContent();
    initEventRegistrations();
    loadApplications();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

async function uploadImage(file, bucket, statusEl) {
    function setStatus(msg, type) {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.className = `upload-status status-${type}`;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        const msg = `Invalid type "${file.type}". Only PNG, JPG, JPEG, WebP allowed.`;
        setStatus("✗ " + msg, "error");
        throw new Error(msg);
    }
    if (file.size > 8 * 1024 * 1024) {
        const msg = `File is ${(file.size / (1024 * 1024)).toFixed(1)}MB — exceeds 8MB limit.`;
        setStatus("✗ " + msg, "error");
        throw new Error(msg);
    }

    // Optional compression if library is loaded
    let uploadFile = file;
    const compress = window.browserImageCompression;
    if (typeof compress === "function") {
        try {
            setStatus("⏳ Compressing…", "compressing");
            uploadFile = await compress(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        } catch { /* skip compression, upload original */ }
    }

    const ext = uploadFile.name.split(".").pop().toLowerCase();
    const fileName = `${Date.now()}.${ext}`;

    setStatus("⬆ Uploading…", "uploading");
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, uploadFile);
    if (uploadError) {
        setStatus("✗ Upload failed. Check Storage policies.", "error");
        throw uploadError;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    setStatus("✓ Upload complete", "done");
    return urlData.publicUrl;
}

async function uploadFile(file, bucket, statusEl) {
    function setStatus(msg, type) {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.className = `upload-status status-${type}`;
    }
    if (file.size > 20 * 1024 * 1024) {
        const msg = `File is ${(file.size / (1024 * 1024)).toFixed(1)}MB — exceeds 20MB limit.`;
        setStatus("✗ " + msg, "error");
        throw new Error(msg);
    }
    const ext = file.name.split(".").pop().toLowerCase();
    const fileName = `${Date.now()}.${ext}`;
    setStatus("⬆ Uploading…", "uploading");
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
    if (uploadError) {
        setStatus("✗ Upload failed.", "error");
        throw uploadError;
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    setStatus("✓ Upload complete", "done");
    return urlData.publicUrl;
}

async function deleteImageFromStorage(imageUrl, bucket) {
    if (!imageUrl) return;
    try {
        // Extract file path from public URL
        const marker = `/storage/v1/object/public/${bucket}/`;
        const idx = imageUrl.indexOf(marker);
        if (idx === -1) return;
        const filePath = imageUrl.substring(idx + marker.length);
        await supabase.storage.from(bucket).remove([filePath]);
    } catch (err) {
        console.error("Failed to delete storage object:", err);
    }
}

function sanitize(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function closeAllModals() {
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
}

document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", closeAllModals);
});
window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) e.target.classList.remove("active");
});

// ─── Members ──────────────────────────────────────────────────────────────────
let membersData = [];

function listenToMembers() {
    const membersTbody = document.querySelector("#members-table tbody");
    const statMembers  = document.getElementById("stat-members");

    // Supabase realtime subscription
    supabase
        .channel("members-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => fetchMembers())
        .subscribe();

    fetchMembers();

    async function fetchMembers() {
        const { data, error } = await supabase
            .from("members")
            .select("*")
            .order("created_at", { ascending: false });

        membersTbody.innerHTML = "";
        membersData = [];

        if (error || !data || data.length === 0) {
            membersTbody.innerHTML = `<tr><td colspan="7" class="text-center">${error ? "Failed to load data." : "No members found."}</td></tr>`;
            if (statMembers) statMembers.textContent = "0";
            return;
        }

        membersData = data;
        if (statMembers) statMembers.textContent = data.length;

        data.forEach(m => {
            const dateStr = m.created_at ? new Date(m.created_at).toLocaleString() : "N/A";
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${sanitize(m.name)}</td>
                <td>${sanitize(m.email)}</td>
                <td>${sanitize(m.phone || "")}</td>
                <td>${sanitize(m.department || "")}</td>
                <td>${sanitize(m.year || "")}</td>
                <td>${dateStr}</td>
                <td class="actions">
                    <button class="btn-icon text-error remove-member" data-id="${m.id}" title="Remove">
                        <i class='bx bx-trash'></i>
                    </button>
                </td>
            `;
            membersTbody.appendChild(tr);
        });

        membersTbody.querySelectorAll(".remove-member").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (!confirm("Remove this registration?")) return;
                const id = btn.getAttribute("data-id");
                const { error } = await supabase.from("members").delete().eq("id", id);
                if (error) alert("Failed to remove: " + error.message);
                else fetchMembers();
            });
        });
    }
}

// Export CSV
document.getElementById("export-members-btn").addEventListener("click", () => {
    if (membersData.length === 0) { alert("No members to export."); return; }
    const headers = ["Name", "Email", "Phone", "Department", "Year", "Date"];
    const rows = membersData.map(m => [
        `"${m.name || ""}"`, `"${m.email || ""}"`, `"${m.phone || ""}"`,
        `"${m.department || ""}"`, `"${m.year || ""}"`,
        `"${m.created_at ? new Date(m.created_at).toLocaleString() : ""}"`
    ]);
    const csv = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `lrnit-members-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// ─── Events ───────────────────────────────────────────────────────────────────
const eventModal   = document.getElementById("event-modal");
const addEventBtn  = document.getElementById("add-event-btn");
const eventForm    = document.getElementById("event-form");

async function loadEvents() {
    const tbody     = document.querySelector("#events-table tbody");
    const statEl    = document.getElementById("stat-events");

    const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });
    tbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">${error ? "Failed to load." : "No events found."}</td></tr>`;
        if (statEl) statEl.textContent = "0";
        return;
    }
    if (statEl) statEl.textContent = data.length;

    data.forEach(ev => {
        const dateStr = ev.date ? new Date(ev.date).toLocaleString() : "N/A";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${sanitize(ev.title)}</strong></td>
            <td>${dateStr}</td>
            <td>${sanitize(ev.location || "")}</td>
            <td><span class="badge-tag">${sanitize(ev.type || "other")}</span></td>
            <td class="actions">
                <button class="btn-icon edit-event" data-id="${ev.id}" title="Edit"><i class='bx bx-edit'></i></button>
                <button class="btn-icon text-error delete-event" data-id="${ev.id}" title="Delete"><i class='bx bx-trash'></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".edit-event").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const ev = data.find(e => e.id === id);
            if (!ev) return;
            document.getElementById("event-id").value = id;
            document.getElementById("event-title").value = ev.title || "";
            document.getElementById("event-location").value = ev.location || "";
            document.getElementById("event-desc").value = ev.description || "";
            document.getElementById("event-type").value = ev.type || "other";
            document.getElementById("event-featured").checked = ev.featured || false;
            document.getElementById("event-color").value = ev.overlay_color || "#6c63ff";
            document.getElementById("event-min-team").value = ev.min_team_size || 1;
            document.getElementById("event-max-team").value = ev.max_team_size || 1;
            document.getElementById("event-deadline").value = ev.registration_deadline ? new Date(ev.registration_deadline).toISOString().slice(0, 16) : "";
            document.getElementById("event-scope").value = ev.participation_scope || "inter";
            if (ev.image_url) {
                document.getElementById("preview-image").src = ev.image_url;
            } else {
                document.getElementById("preview-image").src = "../assets/placeholder.webp";
            }
            if (ev.date) {
                const local = new Date(ev.date).toISOString().slice(0, 16);
                document.getElementById("event-date").value = local;
            }
            updateLivePreview();
            document.getElementById("event-modal-title").textContent = "Edit Event";
            eventModal.classList.add("active");
        });
    });

    tbody.querySelectorAll(".delete-event").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Delete this event?")) return;
            const id = btn.getAttribute("data-id");
            const ev = data.find(e => e.id === id);
            if (ev?.image_url) await deleteImageFromStorage(ev.image_url, "events");
            await supabase.from("events").delete().eq("id", id);
            loadEvents();
        });
    });
}

addEventBtn.addEventListener("click", () => {
    eventForm.reset();
    document.getElementById("event-id").value = "";
    document.getElementById("event-featured").checked = false;
    document.getElementById("event-color").value = "#6c63ff";
    document.getElementById("event-min-team").value = "1";
    document.getElementById("event-max-team").value = "1";
    document.getElementById("event-deadline").value = "";
    document.getElementById("event-scope").value = "inter";
    document.getElementById("preview-image").src = "../assets/placeholder.webp";
    updateLivePreview();
    document.getElementById("event-modal-title").textContent = "Add Event";
    eventModal.classList.add("active");
});

// Event Visual Builder Live Preview
function updateLivePreview() {
    document.getElementById("preview-title").textContent = document.getElementById("event-title").value || "Event Title";
    const typeValue = document.getElementById("event-type").value;
    document.getElementById("preview-type").textContent = typeValue.toUpperCase();
    const dateValue = document.getElementById("event-date").value;
    let dateStr = "TBD";
    if (dateValue) {
        dateStr = new Date(dateValue).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
    document.getElementById("preview-date").textContent = "📅 " + dateStr;
    const colorValue = document.getElementById("event-color").value;
    document.getElementById("preview-card").style.setProperty("--overlay-color", colorValue);
}

["event-title", "event-type", "event-date", "event-color"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateLivePreview);
});

const eventImageInput = document.getElementById("event-image-file");
if (eventImageInput) {
    eventImageInput.addEventListener("change", function() {
        if (this.files && this.files[0]) {
            const url = URL.createObjectURL(this.files[0]);
            document.getElementById("preview-image").src = url;
            // Note: browser will release object URL on document unload, but for admin preview this is fine
        } else {
            document.getElementById("preview-image").src = "../assets/placeholder.webp";
        }
    });
}

eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = eventForm.querySelector('button[type="submit"]');
    const statusEl = document.getElementById("event-upload-status");
    btn.disabled = true; btn.textContent = "Saving...";
    if (statusEl) { statusEl.textContent = ""; statusEl.className = "upload-status"; }

    const id        = document.getElementById("event-id").value;
    const title     = document.getElementById("event-title").value;
    const dateInput = document.getElementById("event-date").value;
    const location  = document.getElementById("event-location").value;
    const desc      = document.getElementById("event-desc").value;
    const type      = document.getElementById("event-type").value;
    const featured  = document.getElementById("event-featured").checked;
    const color     = document.getElementById("event-color").value;
    const minTeam   = parseInt(document.getElementById("event-min-team").value) || 1;
    const maxTeam   = parseInt(document.getElementById("event-max-team").value) || 1;
    const deadlineStr = document.getElementById("event-deadline").value;
    const scope     = document.getElementById("event-scope").value;
    const fileInput = document.getElementById("event-image-file");
    const payload   = { title, date: dateInput || null, location, description: desc, type, featured, overlay_color: color, min_team_size: minTeam, max_team_size: maxTeam, registration_deadline: deadlineStr ? new Date(deadlineStr).toISOString() : null, participation_scope: scope };

    try {
        if (fileInput.files.length > 0) {
            payload.image_url = await uploadImage(fileInput.files[0], "events", statusEl);
        } else if (!id) {
            throw new Error("Cover image is required for new events.");
        }

        // Upload rulebook / attachment if provided
        const attachStatusEl = document.getElementById("event-attachment-status");
        const rulebookInput = document.getElementById("event-rulebook-file");
        const attachInput = document.getElementById("event-attachment-file");
        if (rulebookInput && rulebookInput.files.length > 0) {
            payload.rulebook_url = await uploadFile(rulebookInput.files[0], "events", attachStatusEl);
        }
        if (attachInput && attachInput.files.length > 0) {
            payload.attachment_url = await uploadFile(attachInput.files[0], "events", attachStatusEl);
        }

        if (id) {
            await supabase.from("events").update(payload).eq("id", id);
        } else {
            await supabase.from("events").insert(payload);
        }
        closeAllModals();
        loadEvents();
    } catch (err) {
        console.error("Error saving event:", err);
        alert("Failed to save event. " + err.message);
    } finally {
        btn.disabled = false; btn.textContent = "Save Event";
    }
});

// ─── Team ────────────────────────────────────────────────────────────────────
const teamModal  = document.getElementById("team-modal");
const addTeamBtn = document.getElementById("add-team-btn");
const teamForm   = document.getElementById("team-form");

let allTeamData = [];

async function loadTeam() {
    const tbody  = document.querySelector("#team-table tbody");
    const statEl = document.getElementById("stat-team");
    const teamFilter = document.getElementById("team-filter");
    
    // add event listener for filter once
    if (teamFilter && !teamFilter.dataset.listener) {
        teamFilter.addEventListener("change", () => renderTeamTable(allTeamData));
        teamFilter.dataset.listener = "true";
    }

    const { data, error } = await supabase.from("team").select("*").order("display_order", { ascending: true });
    tbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">${error ? "Failed to load." : "No team members yet."}</td></tr>`;
        if (statEl) statEl.textContent = "0";
        return;
    }
    
    allTeamData = data;
    if (statEl) statEl.textContent = data.length;
    renderTeamTable(data);
}

function renderTeamTable(data) {
    const tbody = document.querySelector("#team-table tbody");
    tbody.innerHTML = "";
    
    const filter = document.getElementById("team-filter") ? document.getElementById("team-filter").value : "all";
    
    let filteredData = data;
    if (filter === "core") {
        filteredData = data.filter(m => m.role_level === "ceo" || m.role_level === "manager");
    } else if (filter !== "all") {
        filteredData = data.filter(m => m.department === filter);
    }
    
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No members match this filter.</td></tr>`;
        return;
    }

    filteredData.forEach(m => {
        let teamDept = "Core";
        if (m.department) teamDept = m.department;
        if (m.role_level === "ceo") teamDept += " (CEO)";
        else if (m.role_level === "manager") teamDept += " (Manager)";
        else if (m.is_head) teamDept += " (Head)";
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${sanitize(m.name)}</strong></td>
            <td>${sanitize(m.role || "")}</td>
            <td><span class="badge-tag" style="text-transform: capitalize;">${sanitize(teamDept.replace('_', ' '))}</span></td>
            <td>${sanitize((m.bio || "").slice(0, 60))}${(m.bio || "").length > 60 ? "…" : ""}</td>
            <td>${m.display_order ?? 0}</td>
            <td class="actions">
                <button class="btn-icon edit-team" data-id="${m.id}" title="Edit"><i class='bx bx-edit'></i></button>
                <button class="btn-icon text-error delete-team" data-id="${m.id}" title="Delete"><i class='bx bx-trash'></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".edit-team").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const m = data.find(x => x.id === id);
            if (!m) return;
            document.getElementById("team-id").value = id;
            document.getElementById("team-name").value = m.name || "";
            document.getElementById("team-role").value = m.role || "";
            document.getElementById("team-bio").value = m.bio || "";
            document.getElementById("team-linkedin").value = m.linkedin || "";
            document.getElementById("team-order").value = m.display_order ?? 0;
            document.getElementById("team-department").value = m.department || "";
            document.getElementById("team-role-level").value = m.role_level || "member";
            document.getElementById("team-is-head").checked = m.is_head || false;
            document.getElementById("team-modal-title").textContent = "Edit Team Member";
            teamModal.classList.add("active");
        });
    });

    tbody.querySelectorAll(".delete-team").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Delete this team member?")) return;
            const id  = btn.getAttribute("data-id");
            const m   = data.find(x => x.id === id);
            if (m?.image_url) await deleteImageFromStorage(m.image_url, "team");
            await supabase.from("team").delete().eq("id", id);
            loadTeam();
        });
    });
}

addTeamBtn.addEventListener("click", () => {
    teamForm.reset();
    document.getElementById("team-id").value = "";
    document.getElementById("team-order").value = "0";
    document.getElementById("team-department").value = "";
    document.getElementById("team-role-level").value = "member";
    document.getElementById("team-is-head").checked = false;
    document.getElementById("team-modal-title").textContent = "Add Team Member";
    teamModal.classList.add("active");
});

teamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = teamForm.querySelector('button[type="submit"]');
    const statusEl = document.getElementById("team-upload-status");
    btn.disabled = true; btn.textContent = "Saving...";
    if (statusEl) { statusEl.textContent = ""; statusEl.className = "upload-status"; }

    const id      = document.getElementById("team-id").value;
    const fileInput = document.getElementById("team-image-file");
    const payload = {
        name:          document.getElementById("team-name").value.trim(),
        role:          document.getElementById("team-role").value.trim(),
        bio:           document.getElementById("team-bio").value.trim(),
        linkedin:      document.getElementById("team-linkedin").value.trim(),
        display_order: parseInt(document.getElementById("team-order").value) || 0,
        department:    document.getElementById("team-department").value || null,
        role_level:    document.getElementById("team-role-level").value || "member",
        is_head:       document.getElementById("team-is-head").checked
    };

    try {
        if (fileInput.files.length > 0) {
            payload.image_url = await uploadImage(fileInput.files[0], "team", statusEl);
        } else if (!id) {
            throw new Error("Profile image is required for new team members.");
        }

        if (id) {
            await supabase.from("team").update(payload).eq("id", id);
        } else {
            await supabase.from("team").insert(payload);
        }
        closeAllModals();
        loadTeam();
    } catch (err) {
        console.error("Error saving team member:", err);
        alert("Failed to save team member. " + err.message);
    } finally {
        btn.disabled = false; btn.textContent = "Save Member";
    }
});

// ─── Gallery ─────────────────────────────────────────────────────────────────
const galleryModal  = document.getElementById("gallery-modal");
const addGalleryBtn = document.getElementById("add-gallery-btn");
const galleryForm   = document.getElementById("gallery-form");

async function loadGallery() {
    const tbody = document.querySelector("#gallery-table tbody");
    if (!tbody) return;

    const { data, error } = await supabase.from("gallery").select("*").order("created_at", { ascending: false });
    tbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">${error ? "Failed to load." : "No gallery items."}</td></tr>`;
        return;
    }

    data.forEach(item => {
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/A";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${item.image_url || ""}" alt="Gallery" style="width:60px;height:60px;object-fit:cover;border-radius:4px;"></td>
            <td><strong>${sanitize(item.title)}</strong></td>
            <td>${sanitize((item.description || "").slice(0, 50))}</td>
            <td>${dateStr}</td>
            <td class="actions">
                <button class="btn-icon text-error delete-gallery" data-id="${item.id}" title="Delete"><i class='bx bx-trash'></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".delete-gallery").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Delete this gallery item?")) return;
            const id   = btn.getAttribute("data-id");
            const item = data.find(x => x.id === id);
            if (item?.image_url) await deleteImageFromStorage(item.image_url, "gallery");
            await supabase.from("gallery").delete().eq("id", id);
            loadGallery();
        });
    });
}

if (addGalleryBtn) {
    addGalleryBtn.addEventListener("click", () => {
        galleryForm.reset();
        document.getElementById("gallery-id").value = "";
        galleryModal.classList.add("active");
    });
}

if (galleryForm) {
    galleryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = galleryForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = "Saving...";

        const id        = document.getElementById("gallery-id").value;
        const title     = document.getElementById("gallery-title").value.trim();
        const desc      = document.getElementById("gallery-desc").value.trim();
        const fileInput = document.getElementById("gallery-image-file");
        const statusEl  = document.getElementById("gallery-upload-status");
        if (statusEl) { statusEl.textContent = ""; statusEl.className = "upload-status"; }

        const payload = { title, description: desc };

        try {
            if (fileInput.files.length > 0) {
                payload.image_url = await uploadImage(fileInput.files[0], "gallery", statusEl);
            } else if (!id) {
                throw new Error("Image is required.");
            }
            if (id) {
                await supabase.from("gallery").update(payload).eq("id", id);
            } else {
                await supabase.from("gallery").insert(payload);
            }
            closeAllModals();
            loadGallery();
        } catch (err) {
            console.error("Error saving gallery item:", err);
            alert("Failed to save gallery item. " + err.message);
        } finally {
            btn.disabled = false; btn.textContent = "Save Image";
        }
    });
}

// ─── Announcements ────────────────────────────────────────────────────────────
const announcementModal  = document.getElementById("announcement-modal");
const addAnnouncementBtn = document.getElementById("add-announcement-btn");
const announcementForm   = document.getElementById("announcement-form");

const priorityLabel = { urgent: "🔴 Urgent", important: "🟠 Important", normal: "🔵 Normal" };

async function loadAnnouncements() {
    const tbody = document.querySelector("#announcements-table tbody");
    if (!tbody) return;

    const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    tbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">${error ? "Failed to load." : "No announcements found."}</td></tr>`;
        return;
    }

    data.forEach(item => {
        const dateStr  = item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/A";
        const priority = item.priority || "normal";
        const label    = priorityLabel[priority] || priority;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${sanitize(item.title)}</strong></td>
            <td><span class="badge-tag">${label}</span></td>
            <td>${sanitize((item.description || "").slice(0, 50))}</td>
            <td>${dateStr}</td>
            <td class="actions">
                <button class="btn-icon edit-announcement" data-id="${item.id}" title="Edit"><i class='bx bx-edit'></i></button>
                <button class="btn-icon text-error delete-announcement" data-id="${item.id}" title="Delete"><i class='bx bx-trash'></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".edit-announcement").forEach(btn => {
        btn.addEventListener("click", () => {
            const id   = btn.getAttribute("data-id");
            const item = data.find(x => x.id === id);
            if (!item) return;
            document.getElementById("announcement-id").value = id;
            document.getElementById("announcement-title").value = item.title || "";
            document.getElementById("announcement-desc").value = item.description || "";
            document.getElementById("announcementPriority").value = item.priority || "normal";
            document.getElementById("announcement-modal-title").textContent = "Edit Announcement";
            announcementModal.classList.add("active");
        });
    });

    tbody.querySelectorAll(".delete-announcement").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Delete this announcement?")) return;
            const id = btn.getAttribute("data-id");
            await supabase.from("announcements").delete().eq("id", id);
            loadAnnouncements();
        });
    });
}

if (addAnnouncementBtn) {
    addAnnouncementBtn.addEventListener("click", () => {
        announcementForm.reset();
        document.getElementById("announcement-id").value = "";
        document.getElementById("announcementPriority").value = "normal";
        document.getElementById("announcement-modal-title").textContent = "Add Announcement";
        announcementModal.classList.add("active");
    });
}

if (announcementForm) {
    announcementForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = announcementForm.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = "Saving...";

        const id       = document.getElementById("announcement-id").value;
        const title    = document.getElementById("announcement-title").value.trim();
        const desc     = document.getElementById("announcement-desc").value.trim();
        const priority = document.getElementById("announcementPriority").value;

        try {
            if (id) {
                await supabase.from("announcements").update({ title, description: desc, priority }).eq("id", id);
            } else {
                await supabase.from("announcements").insert({ title, description: desc, priority });
            }
            closeAllModals();
            loadAnnouncements();
        } catch (err) {
            console.error("Error saving announcement:", err);
            alert("Failed to save. " + err.message);
        } finally {
            btn.disabled = false; btn.textContent = "Save Announcement";
        }
    });
}

// ─── Hero Content ─────────────────────────────────────────────────────────────
async function loadHeroContent() {
    try {
        const { data } = await supabase.from("content").select("*").eq("key", "hero").single();
        if (!data) return;
        if (data.badge)          document.getElementById("content-badge").value    = data.badge;
        if (data.title)          document.getElementById("content-title").value    = data.title;
        if (data.gradient_text)  document.getElementById("content-gradient").value = data.gradient_text;
        if (data.subtitle)       document.getElementById("content-subtitle").value = data.subtitle;
        if (data.cta_text)       document.getElementById("content-cta").value      = data.cta_text;
    } catch (err) {
        console.error("Error loading hero content:", err);
    }
}

document.getElementById("content-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        key:           "hero",
        badge:         document.getElementById("content-badge").value.trim(),
        title:         document.getElementById("content-title").value.trim(),
        gradient_text: document.getElementById("content-gradient").value.trim(),
        subtitle:      document.getElementById("content-subtitle").value.trim(),
        cta_text:      document.getElementById("content-cta").value.trim(),
        updated_at:    new Date().toISOString()
    };

    const btn = document.getElementById("save-content-btn");
    const msg = document.getElementById("content-success-msg");
    btn.disabled = true; btn.textContent = "Saving...";

    try {
        await supabase.from("content").upsert(payload, { onConflict: "key" });
        msg.style.display = "inline";
        setTimeout(() => { msg.style.display = "none"; }, 3000);
    } catch (err) {
        console.error("Error saving content:", err);
        alert("Failed to save content. " + err.message);
    } finally {
        btn.disabled = false; btn.textContent = "Save Changes";
    }
});

// ─── Homepage Content ─────────────────────────────────────────────────────────

const homepageModal = document.getElementById("homepage-modal");
const addHomepageBtn = document.getElementById("add-homepage-btn");
const homepageForm = document.getElementById("homepage-form");

async function loadHomepageContent() {
    const pillarsTbody = document.querySelector("#pillars-table tbody");
    const clubTbody = document.querySelector("#club-info-table tbody");

    if (!pillarsTbody || !clubTbody) return;

    const { data, error } = await supabase.from("homepage_cards").select("*").order("order_index", { ascending: true });

    pillarsTbody.innerHTML = "";
    clubTbody.innerHTML = "";

    if (error || !data || data.length === 0) {
        pillarsTbody.innerHTML = `<tr><td colspan="5" class="text-center">${error ? "Failed to load." : "No pillar cards."}</td></tr>`;
        clubTbody.innerHTML = `<tr><td colspan="5" class="text-center">${error ? "Failed to load." : "No club info cards."}</td></tr>`;
        return;
    }

    const renderCardRow = (item) => `
        <tr>
            <td><strong>${sanitize(item.icon)}</strong></td>
            <td><strong>${sanitize(item.title)}</strong></td>
            <td>${sanitize((item.description || "").slice(0, 50))}...</td>
            <td>${item.order_index}</td>
            <td class="actions">
                <button class="btn-icon edit-homepage" data-id="${item.id}" title="Edit"><i class='bx bx-edit'></i></button>
                <button class="btn-icon text-error delete-homepage" data-id="${item.id}" title="Delete"><i class='bx bx-trash'></i></button>
            </td>
        </tr>
    `;

    const pillars = data.filter(c => c.section === "pillars");
    const clubInfo = data.filter(c => c.section === "club");

    if (pillars.length === 0) {
        pillarsTbody.innerHTML = `<tr><td colspan="5" class="text-center">No pillar cards.</td></tr>`;
    } else {
        pillarsTbody.innerHTML = pillars.map(renderCardRow).join("");
    }

    if (clubInfo.length === 0) {
        clubTbody.innerHTML = `<tr><td colspan="5" class="text-center">No club info cards.</td></tr>`;
    } else {
        clubTbody.innerHTML = clubInfo.map(renderCardRow).join("");
    }

    const bindActions = (tbody) => {
        tbody.querySelectorAll(".edit-homepage").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const item = data.find(x => x.id === id);
                if (!item) return;

                document.getElementById("homepage-id").value = id;
                document.getElementById("homepage-section").value = item.section || "pillars";
                document.getElementById("homepage-title").value = item.title || "";
                document.getElementById("homepage-desc").value = item.description || "";
                document.getElementById("homepage-icon").value = item.icon || "";
                document.getElementById("homepage-order").value = item.order_index ?? 0;

                document.getElementById("homepage-modal-title").textContent = "Edit Homepage Card";
                homepageModal.classList.add("active");
            });
        });

        tbody.querySelectorAll(".delete-homepage").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (!confirm("Delete this homepage card?")) return;
                const id = btn.getAttribute("data-id");
                await supabase.from("homepage_cards").delete().eq("id", id);
                loadHomepageContent();
            });
        });
    };

    bindActions(pillarsTbody);
    bindActions(clubTbody);
}

if (addHomepageBtn) {
    addHomepageBtn.addEventListener("click", () => {
        homepageForm.reset();
        document.getElementById("homepage-id").value = "";
        document.getElementById("homepage-order").value = "0";
        document.getElementById("homepage-modal-title").textContent = "Add Homepage Card";
        homepageModal.classList.add("active");
    });
}

if (homepageForm) {
    homepageForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = homepageForm.querySelector('button[type="submit"]');

        const title = document.getElementById("homepage-title").value.trim();
        const desc = document.getElementById("homepage-desc").value.trim();
        const icon = document.getElementById("homepage-icon").value.trim();
        
        if (!title || !desc || !icon) {
            alert("Title, Description, and Icon are required fields.");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Saving...";

        const id = document.getElementById("homepage-id").value;
        const section = document.getElementById("homepage-section").value;
        const order_index = parseInt(document.getElementById("homepage-order").value) || 0;

        const payload = { section, title, description: desc, icon, order_index };

        try {
            if (id) {
                await supabase.from("homepage_cards").update(payload).eq("id", id);
            } else {
                await supabase.from("homepage_cards").insert(payload);
            }
            closeAllModals();
            loadHomepageContent();
        } catch (err) {
            console.error("Error saving homepage card:", err);
            alert("Failed to save. " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Save Card";
        }
    });
}

// ─── Event Registrations ───────────────────────────────────────────────────────
let currentRegistrations = [];

function initEventRegistrations() {
    const eventSelect = document.getElementById("reg-event-select");
    const searchInput = document.getElementById("reg-search");
    const exportBtn   = document.getElementById("export-registrations-btn");
    
    if (!eventSelect) return;

    // Load Events into select
    const loadEventsDropdown = async () => {
        const { data, error } = await supabase.from("events").select("id, title").order("date", { ascending: false });
        if (!error && data) {
            data.forEach(ev => {
                const opt = document.createElement("option");
                opt.value = ev.id;
                opt.textContent = ev.title;
                eventSelect.appendChild(opt);
            });
        }
    };
    
    loadEventsDropdown();

    eventSelect.addEventListener("change", fetchEventRegistrations);
    if(searchInput) searchInput.addEventListener("input", renderRegistrationsTable);
    if(exportBtn) exportBtn.addEventListener("click", exportRegistrationsCSV);
}

async function fetchEventRegistrations() {
    const eventId = document.getElementById("reg-event-select").value;
    const tbody = document.querySelector("#event-registrations-table tbody");
    const statTeams = document.getElementById("reg-stat-teams");
    const statParticipants = document.getElementById("reg-stat-participants");

    if (!eventId) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center">Select an event to load registrations.</td></tr>`;
        statTeams.textContent = "0 Teams";
        statParticipants.textContent = "0 Total Participants";
        currentRegistrations = [];
        return;
    }

    tbody.innerHTML = `<tr><td colspan="10" class="text-center">Loading...</td></tr>`;

    // Fetch registrations and their members
    const { data: regs, error } = await supabase
        .from("event_registrations")
        .select(`
            id, team_name, team_size, team_leader_name, team_leader_email, team_leader_phone, 
            college_name, student_id, department, year, notes, registration_status, created_at,
            team_members(id, name, email, phone, member_role, student_id, college_name, department, year)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Fetch registrations error:", error);
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-error">Failed to load registrations.</td></tr>`;
        return;
    }

    currentRegistrations = regs || [];
    renderRegistrationsTable();
}

function renderRegistrationsTable() {
    const tbody = document.querySelector("#event-registrations-table tbody");
    const statTeams = document.getElementById("reg-stat-teams");
    const statParticipants = document.getElementById("reg-stat-participants");
    const searchVal = document.getElementById("reg-search").value.toLowerCase();

    // Filter registrations
    let filtered = currentRegistrations;
    if (searchVal) {
        filtered = currentRegistrations.filter(r => {
            const matchName = (r.team_leader_name || "").toLowerCase().includes(searchVal);
            const matchTeam = (r.team_name || "").toLowerCase().includes(searchVal);
            const matchEmail = (r.team_leader_email || "").toLowerCase().includes(searchVal);
            let matchMembers = false;
            r.team_members?.forEach(m => {
                if ((m.name || "").toLowerCase().includes(searchVal) || (m.email || "").toLowerCase().includes(searchVal)) {
                    matchMembers = true;
                }
            });
            return matchName || matchTeam || matchEmail || matchMembers;
        });
    }

    // Stats
    statTeams.textContent = `${filtered.length} Teams`;
    let totalP = 0;
    filtered.forEach(r => totalP += (r.team_members ? r.team_members.length : 0));
    statParticipants.textContent = `${totalP} Total Participants`;

    tbody.innerHTML = "";
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center">No registrations match your search.</td></tr>`;
        return;
    }

    filtered.forEach(r => {
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString() : "N/A";
        const memCount = r.team_members ? r.team_members.length : 0;
        const tr = document.createElement("tr");

        let statusBadge = "🔵 Confirmed";
        if(r.registration_status === 'cancelled') statusBadge = "🔴 Cancelled";
        if(r.registration_status === 'disqualified') statusBadge = "🟠 Disqualified";

        tr.innerHTML = `
            <td><strong>${sanitize(r.team_name || "N/A")}</strong></td>
            <td>${memCount} / ${r.team_size}</td>
            <td>${sanitize(r.team_leader_name)}</td>
            <td>${sanitize(r.team_leader_email)}</td>
            <td>${sanitize(r.college_name || "")}</td>
            <td>${sanitize(r.student_id || "")}</td>
            <td>${sanitize(r.department || "")}</td>
            <td><span class="badge-tag">${statusBadge}</span></td>
            <td>${dateStr}</td>
            <td class="actions">
                <button class="btn-primary btn-sm view-members-btn" data-id="${r.id}">Members</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".view-members-btn").forEach(btn => {
        btn.addEventListener("click", () => showViewMembersModal(btn.getAttribute("data-id")));
    });
}

function showViewMembersModal(regId) {
    const reg = currentRegistrations.find(r => r.id === regId);
    if (!reg) return;

    const modal = document.getElementById("view-members-modal");
    const content = document.getElementById("view-members-content");
    document.getElementById("view-members-title").textContent = `Team: ${sanitize(reg.team_name || "N/A")} (${reg.team_members.length} Members)`;

    let html = "";
    const leader = reg.team_members.find(m => m.member_role === 'leader');
    const others = reg.team_members.filter(m => m.member_role !== 'leader');
    const sortedMembers = leader ? [leader, ...others] : others;

    sortedMembers.forEach((m, idx) => {
        const roleStr = m.member_role === 'leader' ? "Leader" : `Member #${idx+1}`;
        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size: 0.75rem; text-transform: uppercase; color: #6c63ff; font-weight: bold; margin-bottom: 0.25rem;">${roleStr}</div>
                <div style="font-size: 1.1rem; font-weight: 500; color: #fff; margin-bottom: 0.5rem;">${sanitize(m.name)}</div>
                <div style="font-size: 0.9rem; color: #ccc; margin-bottom: 0.25rem;">✉️ <a href="mailto:${sanitize(m.email)}" style="color: #ccc;">${sanitize(m.email)}</a></div>
                <div style="font-size: 0.9rem; color: #ccc; margin-bottom: 0.25rem;">📞 ${sanitize(m.phone)}</div>
                ${m.student_id ? `<div style="font-size: 0.9rem; color: #ccc; margin-bottom: 0.25rem;">🪪 Student ID: ${sanitize(m.student_id)}</div>` : ""}
                ${m.college_name ? `<div style="font-size: 0.9rem; color: #ccc; margin-bottom: 0.25rem;">🏫 College: ${sanitize(m.college_name)}</div>` : ""}
                ${m.department ? `<div style="font-size: 0.9rem; color: #ccc; margin-bottom: 0.25rem;">📚 Dept: ${sanitize(m.department)}</div>` : ""}
                ${m.year ? `<div style="font-size: 0.9rem; color: #ccc;">📅 Year: ${sanitize(m.year)}</div>` : ""}
            </div>
        `;
    });

    content.innerHTML = html;
    modal.classList.add("active");
}

function exportRegistrationsCSV() {
    if (!currentRegistrations || currentRegistrations.length === 0) {
        alert("No registrations to export.");
        return;
    }
    const eventName = document.getElementById("reg-event-select").options[document.getElementById("reg-event-select").selectedIndex].text;
    
    // Columns: Event, Team Name, Participant Name, Email, Phone, College, Student ID, Department, Year, Role, Status
    const headers = ["Event", "Team Name", "Participant Name", "Email", "Phone", "College", "Student ID", "Department", "Year", "Role", "Registration Status"];
    
    let rows = [];
    currentRegistrations.forEach(r => {
        if (!r.team_members) return;
        r.team_members.forEach(m => {
            rows.push([
                `"${eventName.replace(/"/g, '""')}"`,
                `"${(r.team_name || "").replace(/"/g, '""')}"`,
                `"${(m.name || "").replace(/"/g, '""')}"`,
                `"${(m.email || "").replace(/"/g, '""')}"`,
                `"${(m.phone || "").replace(/"/g, '""')}"`,
                `"${(m.college_name || "").replace(/"/g, '""')}"`,
                `"${(m.student_id || "").replace(/"/g, '""')}"`,
                `"${(m.department || "").replace(/"/g, '""')}"`,
                `"${(m.year || "").replace(/"/g, '""')}"`,
                `"${m.member_role || "member"}"`,
                `"${r.registration_status || "confirmed"}"`
            ]);
        });
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `Event_Registrations_${new Date().toISOString().split("T")[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ─── Membership Applications ─────────────────────────────────────────────────

async function loadApplications() {
    const tbody = document.querySelector("#applications-table tbody");
    if (!tbody) return;

    const { data, error } = await supabase
        .from("club_membership_applications")
        .select("*")
        .eq("application_status", "pending")
        .order("created_at", { ascending: false });



    tbody.innerHTML = "";

    if (error) {
        console.error("Error fetching membership applications:", error);
    }

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">${error ? "Failed to load." : "No applications yet."}</td></tr>`;
        return;
    }

    data.forEach(app => {
        const tr = document.createElement("tr");
        const status = app.application_status || "pending";

        let statusHtml = "";
        if (status === "pending") statusHtml = `<span class="badge-tag" style="color:#f0ad4e;">🟡 Pending</span>`;
        else if (status === "admitted") statusHtml = `<span class="badge-tag" style="color:#00cc88;">✅ Admitted</span>`;
        else if (status === "rejected") statusHtml = `<span class="badge-tag" style="color:#ff3366;">❌ Rejected</span>`;

        let actionsHtml = "";
        if (status === "pending") {
            actionsHtml = `
                <button class="btn-primary btn-sm admit-btn" data-id="${app.id}">Admit</button>
                <button class="btn-icon text-error reject-btn" data-id="${app.id}" title="Reject"><i class='bx bx-x-circle'></i></button>
            `;
        } else {
            actionsHtml = `<span style="color:#888;font-size:0.8rem;">${status}</span>`;
        }

        const portfolioHtml = app.portfolio_link
            ? `<a href="${sanitize(app.portfolio_link)}" target="_blank" style="color:#6c63ff;">View</a>`
            : "—";

        tr.innerHTML = `
            <td><strong>${sanitize(app.name)}</strong><br><span style="font-size:0.8rem;color:#aaa;">${sanitize(app.email)}</span></td>
            <td>${sanitize(app.department || "")}</td>
            <td>${sanitize(app.year || "")}</td>
            <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${sanitize(app.skills || "")}">${sanitize(app.skills || "")}</td>
            <td>${portfolioHtml}</td>
            <td>${statusHtml}</td>
            <td class="actions">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    // Admit handlers
    tbody.querySelectorAll(".admit-btn").forEach(btn => {
        btn.addEventListener("click", () => admitApplication(btn.getAttribute("data-id"), btn));
    });

    // Reject handlers
    tbody.querySelectorAll(".reject-btn").forEach(btn => {
        btn.addEventListener("click", () => rejectApplication(btn.getAttribute("data-id"), btn));
    });
}

async function admitApplication(appId, btn) {
    if (!confirm("Admit this applicant? They will be added to the Members list and receive a welcome email.")) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Processing...`;
    }

    // Fetch the application
    const { data: app, error: fetchErr } = await supabase
        .from("club_membership_applications")
        .select("*")
        .eq("id", appId)
        .single();

    if (fetchErr || !app) {
        alert("Failed to load application.");
        if (btn) { btn.disabled = false; btn.innerText = "Admit"; }
        return;
    }

    // 1. Insert into members
    const { error: insertErr } = await supabase
        .from("members")
        .insert({
            name: app.name,
            email: app.email,
            phone: app.phone,
            department: app.department,
            year: app.year,
            skills: app.skills,
            portfolio_link: app.portfolio_link || null,
        });

    if (insertErr) {
        console.error("Member insert error:", insertErr);
        alert("Failed to create member record: " + insertErr.message);
        if (btn) { btn.disabled = false; btn.innerText = "Admit"; }
        return;
    }

    // 2. Update application status
    const { error: updateErr } = await supabase
        .from("club_membership_applications")
        .update({ application_status: "approved" })
        .eq("id", appId);

    if (updateErr) {
        console.error("Application update error:", updateErr);
        alert("Member record created, but failed to update application status: " + updateErr.message);
    }

    // 3. Send welcome email (fire-and-forget)
    try {
        fetch("https://yswdgvetgauvsvxuzrro.supabase.co/functions/v1/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "welcome_member", to: app.email, data: { name: app.name } }),
        })
        .then(res => res.json())
        .catch(e => console.error("Welcome Email fetch failed:", e));
    } catch (err) {
        // email send is non-blocking
    }

    loadApplications();
    // Refresh members list too
    if (typeof listenToMembers === 'function') {
        // The realtime subscription will auto-refresh
    }
}

async function rejectApplication(appId, btn) {
    if (!confirm("Reject this application?")) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i>`;
    }

    const { error } = await supabase
        .from("club_membership_applications")
        .update({ application_status: "rejected" })
        .eq("id", appId);

    if (error) {
        alert("Failed to reject application: " + error.message);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class='bx bx-x-circle'></i>`;
        }
        return;
    }

    loadApplications();
}
