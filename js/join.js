// join.js — Club Membership Application Logic
import { supabase } from "./supabase-client.js";

const form = document.getElementById("join-form");
const submitBtn = document.getElementById("join-submit-btn");
const errorMsg = document.getElementById("join-error");
const successMsg = document.getElementById("join-success");

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

        const name = document.getElementById("join-name").value.trim();
        const email = document.getElementById("join-email").value.trim();
        const phone = document.getElementById("join-phone").value.trim();
        const department = document.getElementById("join-department").value.trim();
        const year = document.getElementById("join-year").value;
        const portfolio = document.getElementById("join-portfolio").value.trim();
        const skills = document.getElementById("join-skills").value.trim();
        const motivation = document.getElementById("join-motivation").value.trim();

        // Basic Validation
        if (!name || !email || !phone || !department || !year || !skills || !motivation) {
            showMsg(errorMsg, "Please fill in all required fields.");
            return;
        }

        if (!isValidEmail(email)) {
            showMsg(errorMsg, "Please enter a valid email address.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting Application...";

        try {
            // Insert into Supabase
            const { error: insertError } = await supabase
                .from("club_membership_applications")
                .insert({
                    name: name,
                    email: email,
                    phone: phone,
                    department: department,
                    year: year,
                    portfolio_link: portfolio || null,
                    skills: skills,
                    motivation: motivation
                });

            if (insertError) {
                console.error("Application Insert Error:", insertError);
                throw new Error("Failed to submit application. Please try again later.");
            }
            


            // Fire-and-forget confirmation email
            try {
                fetch("https://yswdgvetgauvsvxuzrro.supabase.co/functions/v1/send-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "application_received", to: email, data: { name } }),
                })
                .then(res => res.json())
                .catch(e => console.error("Join Email fetch failed:", e));
            } catch (err) {
                // email send is non-blocking
            }

            // Success UI update
            form.style.display = "none";
            if (successMsg) successMsg.style.display = "block";
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err) {
            console.error("Application flow error:", err);
            showMsg(errorMsg, err.message || "An unexpected error occurred. Please try again later.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Apply to Join LRNit";
        }
    });
}
