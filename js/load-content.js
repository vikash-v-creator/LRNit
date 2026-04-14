// load-content.js — Fetches dynamic hero content from Supabase "content" table
import { supabase } from "./supabase-client.js";

async function loadHeroContent() {
    try {
        const { data, error } = await supabase
            .from("content")
            .select("*")
            .eq("key", "hero")
            .single();

        if (error || !data) return; // Keep static HTML if no content row exists

        if (data.title) {
            const heroTitle = document.querySelector(".hero-title");
            if (heroTitle) {
                const firstTextNode = heroTitle.firstChild;
                if (firstTextNode && firstTextNode.nodeType === Node.TEXT_NODE) {
                    firstTextNode.textContent = data.title + " ";
                }
            }
        }

        if (data.gradient_text) {
            const gradientSpan = document.querySelector(".hero-title .gradient-text");
            if (gradientSpan) gradientSpan.textContent = data.gradient_text;
        }

        if (data.subtitle) {
            const subtitle = document.querySelector(".hero-subtitle");
            if (subtitle) subtitle.textContent = data.subtitle;
        }

        if (data.cta_text) {
            const ctaBtn = document.getElementById("btn-join");
            if (ctaBtn) ctaBtn.textContent = data.cta_text;
        }

        if (data.badge) {
            const badge = document.querySelector(".badge");
            if (badge) badge.textContent = data.badge;
        }

    } catch (err) {
        console.error("Failed to load hero content:", err);
    }
}

loadHeroContent();
