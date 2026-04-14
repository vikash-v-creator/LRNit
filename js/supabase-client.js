// supabase-client.js — Shared Supabase client for LRNit
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://yswdgvetgauvsvxuzrro.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd2RndmV0Z2F1dnN2eHV6cnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg1MTQsImV4cCI6MjA4ODg2NDUxNH0.6m8Y2YQN0jWNfJHjCCEVpoHiRI-1ix7vuv3GVA2nB_g";

export const supabase = createClient(supabaseUrl, supabaseKey);
