// register.js — Event Registration Logic
import { supabase } from "./supabase-client.js";
import { resolveDataSource } from "./init.js";

const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("event_id");

const errorState = document.getElementById("error-state");
const errorTitle = document.getElementById("error-title");
const errorDesc = document.getElementById("error-desc");
const contentState = document.getElementById("registration-content");

const eventBanner = document.getElementById("event-banner");
const teamSizeSelect = document.getElementById("reg-team-size");
const dynamicMembersContainer = document.getElementById("dynamic-members-container");
const form = document.getElementById("registration-form");
const submitBtn = document.getElementById("reg-submit-btn");
const errorMsg = document.getElementById("reg-error");
const successMsg = document.getElementById("reg-success");

let currentEvent = null;

function sanitize(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function showErrorState(title, desc) {
    if(contentState) contentState.style.display = "none";
    if(errorTitle) errorTitle.textContent = title;
    if(errorDesc) errorDesc.textContent = desc;
    if(errorState) errorState.style.display = "block";
}

// ─── Scope Field Toggling ───────────────────────────────────────────────────
function applyScopeFields(scope) {
    // Show/hide leader scope fields
    document.querySelectorAll(".scope-field").forEach(el => {
        if (el.classList.contains(`scope-${scope}`)) {
            el.style.display = "";
            // Make contained inputs required
            const input = el.querySelector("input");
            if (input) input.required = true;
        } else {
            el.style.display = "none";
            const input = el.querySelector("input");
            if (input) { input.required = false; input.value = ""; }
        }
    });
}

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
    if (!eventId) {
        showErrorState("Invalid Link", "No event ID was provided in the URL.");
        return;
    }

    try {
        const { data: ev, error } = await supabase
            .from("events")
            .select("*")
            .eq("id", eventId)
            .single();

        if (error || !ev) {
            showErrorState("Event Not Found", "The event you are looking for does not exist or has been removed.");
            return;
        }

        currentEvent = ev;

        // Check deadline
        if (ev.registration_deadline) {
            const deadline = new Date(ev.registration_deadline);
            if (new Date() > deadline) {
                showErrorState("Registration Closed", "The registration deadline for this event has passed.");
                return;
            }
        }

        renderEventBanner(ev);
        setupTeamSizeOptions(ev.min_team_size || 1, ev.max_team_size || 1);

        // Apply scope-based fields
        const scope = ev.participation_scope || "inter";
        applyScopeFields(scope);

        if(contentState) contentState.style.display = "block";
    } catch (err) {
        console.error("Init Error:", err);
        showErrorState("System Error", "Could not load event details. Please try again later.");
    } finally {
        resolveDataSource('register');
    }
}

function renderEventBanner(ev) {
    if(!eventBanner) return;
    let dateStr = "TBD";
    if (ev.date) {
        dateStr = new Date(ev.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
    const color = ev.overlay_color || "#6c63ff";
    const type = (ev.type || "other").toUpperCase();
    const fallbackImg = "./assets/placeholder.webp";
    const imgSrc = ev.image_url || fallbackImg;
    const scopeLabel = ev.participation_scope === "intra" ? "Intra-College" : "Inter-College";

    eventBanner.innerHTML = `
        <div class="event-banner-img" style="background-image: linear-gradient(135deg, ${color}40, rgba(0, 204, 170, 0.15)), url('${imgSrc}'); background-size: cover; background-position: center;"></div>
        <div class="event-banner-content cl-reveal">
            <span class="event-banner-type">${sanitize(type)}</span>
            <span class="event-banner-type" style="background: rgba(16,185,129,0.2); color: #34d399; margin-left: 0.5rem;">${scopeLabel}</span>
            <h2>${sanitize(ev.title || "Untitled Event")}</h2>
            <div class="event-banner-meta">
                <span>📅 ${dateStr}</span>
                ${ev.location ? `<span>📍 ${sanitize(ev.location)}</span>` : ""}
            </div>
            <p style="margin-top: 1rem; color: #ccc; font-size: 0.95rem; line-height: 1.6;">${sanitize(ev.description || "")}</p>
        </div>
    `;
    eventBanner.style.display = 'flex'; // Show banner now that it has content
    eventBanner.classList.add('cl-reveal'); // Animate the container
}

function setupTeamSizeOptions(min, max) {
    if(!teamSizeSelect) return;
    teamSizeSelect.innerHTML = "";
    for (let i = min; i <= max; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = i;
        teamSizeSelect.appendChild(option);
    }
    if (min >= 1) {
        teamSizeSelect.value = min;
    }
    renderDynamicMembers();
}

if(teamSizeSelect) teamSizeSelect.addEventListener("change", renderDynamicMembers);

function renderDynamicMembers() {
    if(!dynamicMembersContainer) return;
    const size = parseInt(teamSizeSelect.value) || 1;
    const scope = currentEvent?.participation_scope || "inter";
    dynamicMembersContainer.innerHTML = "";

    for (let i = 2; i <= size; i++) {
        const card = document.createElement("div");
        card.className = "participant-card";
        card.style.animationDelay = `${(i - 1) * 0.1}s`;

        const showIntra = scope === "intra" ? "" : "display:none;";
        const showInter = scope === "inter" ? "" : "display:none;";
        const intraReq = scope === "intra" ? "required" : "";
        const interReq = scope === "inter" ? "required" : "";

        card.innerHTML = `
            <div class="participant-card-title">MEMBER #${i}</div>
            <div class="form-row">
                <div class="floating-input">
                    <input type="text" id="member-${i}-name" required placeholder=" ">
                    <label for="member-${i}-name">Full Name</label>
                </div>
                <div class="floating-input">
                    <input type="email" id="member-${i}-email" required placeholder=" ">
                    <label for="member-${i}-email">Email Address</label>
                </div>
            </div>
            <div class="form-row">
                <div class="floating-input">
                    <input type="tel" id="member-${i}-phone" required placeholder=" ">
                    <label for="member-${i}-phone">Phone Number</label>
                </div>
                <div class="floating-input" style="${showIntra}">
                    <input type="text" id="member-${i}-student-id" ${intraReq} placeholder=" ">
                    <label for="member-${i}-student-id">Student ID</label>
                </div>
            </div>
            <div class="form-row">
                <div class="floating-input" style="${showInter}">
                    <input type="text" id="member-${i}-college" ${interReq} placeholder=" ">
                    <label for="member-${i}-college">College Name</label>
                </div>
                <div class="floating-input">
                    <input type="text" id="member-${i}-department" placeholder=" ">
                    <label for="member-${i}-department">Department</label>
                </div>
            </div>
            <div class="floating-input">
                <select id="member-${i}-year" required>
                    <option value="" disabled selected hidden></option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                    <option value="5+">Graduate / Other</option>
                </select>
                <label for="member-${i}-year">Year of Study</label>
            </div>
        `;
        dynamicMembersContainer.appendChild(card);
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showMsg(el, text) {
    if (!el) return;
    el.textContent = text;
    el.style.display = "block";
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideMsg(el) {
    if (el) el.style.display = "none";
}

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideMsg(errorMsg);

        const scope = currentEvent?.participation_scope || "inter";

        const teamName = document.getElementById("reg-team-name").value.trim();
        const teamSize = parseInt(teamSizeSelect.value);
        const leaderName = document.getElementById("leader-name").value.trim();
        const leaderEmail = document.getElementById("leader-email").value.trim();
        const leaderPhone = document.getElementById("leader-phone").value.trim();
        const leaderCollege = document.getElementById("leader-college").value.trim();
        const leaderStudentId = document.getElementById("leader-student-id")?.value.trim() || "";
        const leaderDepartment = document.getElementById("leader-department")?.value.trim() || "";
        const year = document.getElementById("leader-year").value;
        const notes = document.getElementById("reg-notes").value.trim();
        const rules = document.getElementById("reg-rules").checked;

        // Validation
        if (!leaderName || !leaderEmail || !leaderPhone || !year) {
            showMsg(errorMsg, "Please fill in all Team Leader details.");
            return;
        }
        if (scope === "intra" && !leaderStudentId) {
            showMsg(errorMsg, "Student ID is required for intra-college events.");
            return;
        }
        if (scope === "inter" && !leaderCollege) {
            showMsg(errorMsg, "College Name is required for inter-college events.");
            return;
        }
        if (!isValidEmail(leaderEmail)) {
            showMsg(errorMsg, "Leader's email is invalid.");
            return;
        }
        if (teamSize < currentEvent.min_team_size || teamSize > currentEvent.max_team_size) {
            showMsg(errorMsg, "Invalid team size selected.");
            return;
        }
        if (!rules) {
            showMsg(errorMsg, "You must agree to the event rules.");
            return;
        }

        const members = [];
        for (let i = 2; i <= teamSize; i++) {
            const mName = document.getElementById(`member-${i}-name`).value.trim();
            const mEmail = document.getElementById(`member-${i}-email`).value.trim();
            const mPhone = document.getElementById(`member-${i}-phone`).value.trim();
            const mStudentId = document.getElementById(`member-${i}-student-id`)?.value.trim() || "";
            const mCollege = document.getElementById(`member-${i}-college`)?.value.trim() || "";
            const mDepartment = document.getElementById(`member-${i}-department`)?.value.trim() || "";
            const mYear = document.getElementById(`member-${i}-year`)?.value || "";

            if (!mName || !mEmail || !mPhone) {
                showMsg(errorMsg, `Please fill in all details for Member #${i}.`);
                return;
            }
            if (scope === "intra" && !mStudentId) {
                showMsg(errorMsg, `Student ID is required for Member #${i}.`);
                return;
            }
            if (scope === "inter" && !mCollege) {
                showMsg(errorMsg, `College Name is required for Member #${i}.`);
                return;
            }
            if (!isValidEmail(mEmail)) {
                showMsg(errorMsg, `Member #${i}'s email is invalid.`);
                return;
            }
            members.push({
                name: mName, email: mEmail, phone: mPhone,
                student_id: mStudentId || null, college_name: mCollege || null,
                department: mDepartment || null, year: mYear || null,
                member_role: 'member'
            });
        }

        // Leader is also a participant
        members.unshift({
            name: leaderName,
            email: leaderEmail,
            phone: leaderPhone,
            student_id: leaderStudentId || null,
            college_name: leaderCollege || null,
            department: leaderDepartment || null,
            year: year || null,
            member_role: 'leader'
        });

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
            // 1. Insert Event Registration
            const { data: regData, error: regError } = await supabase
                .from("event_registrations")
                .insert({
                    event_id: eventId,
                    team_name: teamName || null,
                    team_size: teamSize,
                    team_leader_name: leaderName,
                    team_leader_email: leaderEmail,
                    team_leader_phone: leaderPhone,
                    college_name: leaderCollege || null,
                    student_id: leaderStudentId || null,
                    department: leaderDepartment || null,
                    year,
                    notes: notes || null,
                    registration_status: "confirmed"
                })
                .select("id")
                .single();

            if (regError) {
                if (regError.code === "23505" || regError.message.includes("unique") || regError.message.includes("duplicate")) {
                    throw new Error("You have already registered for this event with this email address.");
                }
                throw regError;
            }

            const registrationId = regData.id;

            // 2. Insert Team Members
            const teamMembersPayload = members.map(m => ({
                registration_id: registrationId,
                name: m.name,
                email: m.email,
                phone: m.phone,
                student_id: m.student_id,
                college_name: m.college_name,
                department: m.department,
                year: m.year,
                member_role: m.member_role
            }));

            const { error: memError } = await supabase
                .from("team_members")
                .insert(teamMembersPayload);

            if (memError) {
                console.error("Member Insert Error:", memError);
                throw new Error("Registration partially failed while saving members. Please contact support.");
            }

            // 3. Send Confirmation Email (Fire-and-forget)
            try {
                const emailData = {
                    event_title: currentEvent.title,
                    event_date: currentEvent.date,
                    event_location: currentEvent.location,
                    team_name: teamName || "Individual",
                    members: members.map(m => ({ name: m.name, email: m.email, role: m.member_role })),
                    rulebook_url: currentEvent.rulebook_url || null,
                    attachment_url: currentEvent.attachment_url || null
                };

                fetch("https://yswdgvetgauvsvxuzrro.supabase.co/functions/v1/send-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "event_registration",
                        to: leaderEmail,
                        data: emailData
                    })
                })
                .then(res => res.json())
                .catch(err => console.error("Email fetch failed:", err));
            } catch (emailErr) {
                // email send is non-blocking
            }

            form.style.display = "none";
            if(document.getElementById("event-banner")) document.getElementById("event-banner").style.display = "none";
            if(successMsg) successMsg.style.display = "block";
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err) {
            console.error("Registration flow error:", err);
            showMsg(errorMsg, err.message || "An unexpected error occurred. Please try again later.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Register for Event";
        }
    });

}

document.addEventListener("DOMContentLoaded", init);
