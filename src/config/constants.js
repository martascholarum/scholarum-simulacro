export const BRAND = {
  name: "DELIBER",
  companyLogo: "https://www.scholarum.es/wp-content/uploads/footer/logo-deliber.svg", 
  favicon: "https://somosdeliber.com/wp-content/uploads/favicon-1.png",
  primary: "#2563eb",    
  secondary: "#0d9488",  
  accent: "#f59e0b",     
  bg: "#f8fafc",         
  card: "#ffffff"        
};

export const COMERCIALES = [
  "Marta Herruzo", "Roberto Cereijo", "Raúl Martínez", 
  "Andrea de Nobrega", "Ana Gómez", "Laura Rada", "Marta Caballero"
];

export const COMMERCIAL_PIN = "1234"; 
export const API = "https://script.google.com/macros/s/AKfycbx6OQ3C3iYw9bGXtx82hZNlevQOZBp4u1aUuoHkQQeiIZKknKtcCJsAa6fI9Xbr1CJT/exec";
export const N8N_WEBHOOK_URL = "https://scholarumdigital.app.n8n.cloud/webhook/0c901ba1-fd9e-4a10-91f0-c5b612249163"; 
export const CLARITY_ID = ""; 

export const C = {
  ink: '#0f172a', navy: '#1e293b', blue: BRAND.primary, teal: BRAND.secondary, 
  gold: BRAND.accent, coral: '#ef4444', slate: '#64748b', green: '#10b981', 
  light: BRAND.bg, card: BRAND.card, muted: '#e2e8f0', 
  ch: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
};
export const sty = {
  card: { background: C.card, borderRadius: 16, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), 0 0 0 1px rgba(15,23,42,0.03)', marginBottom: 25 },
  input: { padding: '14px 18px', borderRadius: 10, border: `1px solid ${C.muted}`, fontSize: 15, width: '100%', boxSizing: 'border-box', background: '#fff', color: C.ink, transition: 'border-color 0.2s', outline: 'none' },
  btn: { padding: '12px 24px', borderRadius: 10, background: `linear-gradient(to bottom, ${C.blue}, #1d4ed8)`, color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' },
  btn2: { padding: '12px 24px', borderRadius: 10, border: `1.5px solid ${C.muted}`, background: '#fff', color: C.navy, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }
};