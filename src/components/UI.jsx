import { useState } from "react";
import { C } from "../config/constants";

export function KPI({ label, value, sub, icon, accent, color }) {
  return (
    <div style={{ background: accent ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : C.card, padding: '25px 30px', borderRadius: 20, boxShadow: accent ? '0 10px 25px -5px rgba(13,148,136,0.3)' : '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), 0 0 0 1px rgba(15,23,42,0.03)', color: accent ? '#fff' : (color || C.ink), position: 'relative', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
      <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>{icon && <span style={{fontSize: 20}}>{icon}</span>} {label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 13, opacity: 0.75, marginTop: 8, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

export function LogoHoverLink({ href, src, height }) {
  const [hover, setHover] = useState(false);
  return (
    <a href={href} target="_blank" rel="noreferrer" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <img src={src} alt="Brand" style={{ height: height, filter: hover ? 'grayscale(0)' : 'grayscale(1)', opacity: hover ? 1 : 0.6, transition: 'all 0.3s ease', cursor: 'pointer', display: 'block' }} />
    </a>
  );
}

export function Spinner({ loadingMsg, loadingSubMsg }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', animation: 'fadeIn 0.4s' }}>
      <div style={{ width: 60, height: 60, border: `4px solid ${C.muted}`, borderTopColor: C.blue, borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 25 }}></div>
      <h2 style={{ color: C.navy, margin: '0 0 12px 0', fontSize: 26, fontWeight: 800 }}>{loadingMsg}</h2>
      <p style={{ color: C.slate, fontSize: 16, margin: 0, fontWeight: 500 }}>{loadingSubMsg}</p>
    </div>
  );
}