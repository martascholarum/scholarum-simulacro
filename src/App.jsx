import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ════════════════════════════════════════════════════════════════════
// 1. 🎨 CONFIGURACIÓN DE TU MARCA (Cambia estos datos)
// ════════════════════════════════════════════════════════════════════
const BRAND = {
  name: "DELIBER",
  companyLogo: "", // <-- Pega aquí la URL de tu logo (ej: "https://somosdeliber.com/logo.png"). Si lo dejas vacío, saldrá el texto.
  primary: "#1b6b93",    // Color principal (Cabeceras, Botones primarios)
  secondary: "#00897b",  // Color secundario (Acentos, Detalles)
  accent: "#e5a100",     // Color de destaque (Rappel, Alertas)
  bg: "#f4f7fa",         // Color de fondo de la app
  card: "#ffffff"        // Color de las tarjetas
};

// ════════════════════════════════════════════════════════════════════
// 2. 🔌 CONEXIONES (Apps Script y n8n)
// ════════════════════════════════════════════════════════════════════
const API = "https://script.google.com/macros/s/AKfycbwCYoLIusztmA7AXeEx8HnVprZoQJFMW-vIslvmgFNdvzt_NoY5d8w9nNOLP2btQ0b0/exec";
const N8N_WEBHOOK_URL = ""; // <-- PEGA AQUÍ LA URL DE TU WEBHOOK DE N8N PARA LOS ISBN FALTANTES

// ── Lógica interna de colores ──
const C = {
  ink: '#0c1e30', navy: '#122d47', blue: BRAND.primary, teal: BRAND.secondary, 
  gold: BRAND.accent, coral: '#d4513d', slate: '#6b7f94', green: '#2a7d3f', 
  light: BRAND.bg, card: BRAND.card, muted: '#e9ecf1', 
  ch: [BRAND.primary, BRAND.secondary, BRAND.accent, '#d4513d', '#7b5ea7']
};

const fmt = n => (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const sh = p => (p || '').replace(/Comercial (de ediciones |Grupo )/g, '').replace(/ S\.A\.U?\./g, '').replace(/ SL$/,'').replace(/ S\.L\.U?\./g,'').replace(/Ediciones /,'').replace(/Editorial /,'');

function parseInput(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  const isbnRe = /97[89]\d{10}/g;
  for (const line of lines) {
    const isbns = line.match(isbnRe);
    if (!isbns) continue;
    let cleanLine = line;
    isbns.forEach(i => { cleanLine = cleanLine.replace(i, ' '); });
    const numbers = [];
    let m;
    const numRe = /\b(\d{1,3})\b/g;
    while ((m = numRe.exec(cleanLine)) !== null) if (m[1] > 0 && m[1] < 1000) numbers.push(parseInt(m[1]));
    for (let idx = 0; idx < isbns.length; idx++) {
      const isbn = isbns[idx];
      const alumnos = idx < numbers.length ? numbers[idx] : (numbers.length === 1 ? numbers[0] : 0);
      if (!entries.find(e => e.isbn === isbn)) entries.push({ isbn, alumnos, curso: '' });
    }
  }
  return entries;
}

async function apiCall(action, params = {}) {
  if (action === 'guardar') {
    const formData = new URLSearchParams();
    formData.append('action', 'guardar');
    formData.append('data', JSON.stringify(params.data));
    const r = await fetch(API, { method: 'POST', body: formData });
    return r.json();
  } else {
    const url = new URL(API);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    const r = await fetch(url.toString());
    return r.json();
  }
}

export default function App() {
  const [step, setStep] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('Cargando...');
  
  const [nombre, setNombre] = useState('');
  const [responsable, setResponsable] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [editableData, setEditableData] = useState(null);
  const [colDtos, setColDtos] = useState({});
  const [costePapel, setCostePapel] = useState(12);
  const [costeDigital, setCosteDigital] = useState(10);
  const [probabilidad, setProbabilidad] = useState(100);
  const [tab, setTab] = useState('resumen');
  const [viewMode, setViewMode] = useState('comercial');
  const [shareUrl, setShareUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [webhookSent, setWebhookSent] = useState(false); // Estado para el botón de n8n
  const fileRef = useRef(null);

  const isC = viewMode === 'comercial';

  useEffect(() => { if (isC && tab === 'propuesta') setTab('resumen'); }, [isC, tab]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('id'), modo = p.get('modo');
    if (id) {
      setLoadingMsg('Abriendo propuesta segura...');
      setLoading(true); setStep(1);
      apiCall('cargar', { id, modo: modo || 'colegio' })
        .then(res => {
          if (res.error) throw new Error(res.error);
          setNombre(res.nombre || '');
          setData(res.datos); setEditableData(res.datos);
          setCostePapel(parseFloat(res.costeOp) || 12); 
          setCosteDigital(parseFloat(res.costeOpDigital) || 10);
          setProbabilidad(parseFloat(res.prob) || 100);
          
          const loadedDtos = { ...(res.condiciones || {}) };
          if (loadedDtos._meta) {
            setLogoUrl(loadedDtos._meta.logoUrl || '');
            setResponsable(loadedDtos._meta.responsable || '');
            delete loadedDtos._meta;
          }
          setColDtos(loadedDtos);
          
          setViewMode(modo === 'colegio' ? 'colegio' : 'comercial');
          setTab(modo === 'colegio' ? 'propuesta' : 'resumen'); 
          setStep(modo === 'colegio' ? 3 : 2);
        })
        .catch(e => { setError(e.message); setStep(0); })
        .finally(() => setLoading(false));
    }
  }, []);

  const handleCruzar = useCallback(async () => {
    const entries = parseInput(inputText);
    if (!entries.length) { setError('No se detectaron ISBNs válidos.'); return; }
    setLoadingMsg('Cruzando con el catálogo de libros...');
    setLoading(true); setError(''); setStep(1);
    try {
      const isbnStr = entries.map(e => `${e.isbn}:${e.alumnos}`).join(',');
      const r = await apiCall('cruzar', { isbns: isbnStr });
      if (r.error) throw new Error(r.error);
      setData(r); setEditableData(r);
      
      const dtos = {};
      r.found.forEach(b => {
        const prov = b.proveedor || 'Sin proveedor';
        if (!dtos[prov]) dtos[prov] = { sum: 0, count: 0 };
        dtos[prov].sum += (parseFloat(b.dto) || 0);
        dtos[prov].count += 1;
      });
      const finalDtos = {};
      Object.keys(dtos).forEach(prov => {
        const avg = Math.round(dtos[prov].sum / dtos[prov].count);
        finalDtos[prov] = { scho: avg, col: avg };
      });
      setColDtos(finalDtos); setStep(2); setTab('resumen');
      
      // Mostrar la pestaña de error automáticamente si faltan libros para que el comercial se dé cuenta
      if(r.notFound && r.notFound.length > 0) setTab('notFound');

    } catch (e) { setError(e.message); setStep(0); }
    finally { setLoading(false); }
  }, [inputText]);

  const handleGuardar = useCallback(async () => {
    if (!editableData) return; setSaving(true);
    try {
      const dtosConMeta = { ...colDtos, _meta: { logoUrl, responsable } };
      const saveData = { nombre, costeOp: costePapel, costeOpDigital: costeDigital, prob: probabilidad, condiciones: dtosConMeta, datos: editableData };
      const r = await apiCall('guardar', { data: saveData });
      if (r.error) throw new Error(r.error);
      const url = `${window.location.origin}${window.location.pathname}?id=${r.id}&modo=colegio`;
      setShareUrl(url);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, probabilidad, colDtos, logoUrl, responsable]);

  // ── FUNCIÓN PARA MANDAR DATOS A N8N ──
  const handleSendWebhook = async () => {
    if(!N8N_WEBHOOK_URL) {
      alert("Primero debes añadir la URL de tu Webhook de n8n en el código (línea 16).");
      return;
    }
    try {
      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colegio: nombre,
          fecha: new Date().toISOString(),
          totalFaltantes: data.notFound.length,
          isbns: data.notFound
        })
      });
      setWebhookSent(true);
    } catch (e) {
      alert("Hubo un error al enviar a n8n. Revisa la consola o los CORS del webhook.");
    }
  };

  const updateAlumnos = useCallback((isbn, val) => {
    setEditableData(prev => ({ ...prev, found: prev.found.map(b => b.isbn === isbn ? { ...b, alumnos: parseInt(val) || 0 } : b) }));
  }, []);

  const handleFile = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setInputText(ev.target.result);
    r.readAsText(f);
  }, []);

  // ── MOTOR DE CÁLCULO BLINDADO (Anti NaN) ──
  const calc = useMemo(() => {
    if (!editableData?.found) return null;
    
    // Forzamos a que siempre sea un número (0 si falla)
    const probSegura = parseFloat(probabilidad) || 0;
    const probFactor = probSegura / 100;

    const rows = editableData.found.map(book => {
      const coste = parseFloat(book.coste) || 0; 
      const pvp = parseFloat(book.pvp) || 0;
      const alumnos = parseFloat(book.alumnos) || 0;
      const dtoScho = parseFloat(book.dto) || 0;
      
      const d = colDtos[book.proveedor] || { scho: dtoScho, col: dtoScho };
      const dCol = parseFloat(d.col) || 0;
      const dScho = parseFloat(d.scho) || 0;
      
      const difFactor = dCol > dScho ? (dCol - dScho) / (100 - dScho) : 0;
      const costeCol = coste * (1 - difFactor);
      
      const isPapel = (book.formato || 'Papel').toLowerCase().includes('papel');
      const pctPapel = parseFloat(costePapel) || 0;
      const pctDigital = parseFloat(costeDigital) || 0;
      const opPct = (isPapel ? pctPapel : pctDigital) / 100;
      
      const alumsEstimados = alumnos * probFactor;
      const tv = alumsEstimados * pvp;
      const tcs = alumsEstimados * coste;
      const tcc = alumsEstimados * costeCol;
      const costOp = tv * opPct;

      return { ...book, pvp, alumnos, tv, tcs, tcc, costOp, rap: tcs - tcc, isPapel, alumsEstimados };
    });

    const tv = rows.reduce((s, r) => s + (r.tv || 0), 0);
    const tcs = rows.reduce((s, r) => s + (r.tcs || 0), 0);
    const tcc = rows.reduce((s, r) => s + (r.tcc || 0), 0);
    const totalCostOp = rows.reduce((s, r) => s + (r.costOp || 0), 0);
    const rap = tcs - tcc;
    const comision = tv - tcs - totalCostOp;
    const benColegio = comision + rap;

    const bp = {};
    rows.forEach(r => {
      const k = r.proveedor || 'Sin proveedor';
      if (!bp[k]) bp[k] = { p: k, n: 0, tv: 0, tcs: 0, tcc: 0, costOp: 0, rap: 0 };
      bp[k].n++; bp[k].tv += r.tv; bp[k].tcs += r.tcs; bp[k].tcc += r.tcc; bp[k].costOp += r.costOp; bp[k].rap += r.rap;
    });
    const prov = Object.values(bp).map(p => ({
      ...p, m: p.tv - p.tcs, ben: (p.tv - p.tcs - p.costOp) + p.rap
    })).sort((a,b) => b.tv - a.tv);

    const totalAlumnos = rows.reduce((s, r) => s + (r.alumnos || 0), 0);
    return { rows, prov, tv, tcs, tcc, totalCostOp, comision, rap, benColegio, t: rows.length, totalAlumnos };
  }, [editableData, colDtos, costePapel, costeDigital, probabilidad]);

  const filtered = calc?.rows.filter(r => !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.isbn?.includes(search)) || [];

  const sty = {
    card: { background: C.card, borderRadius: 16, padding: 30, boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: `1px solid ${C.muted}`, marginBottom: 25 },
    input: { padding: '12px 16px', borderRadius: 8, border: `1.5px solid ${C.muted}`, fontSize: 14, width: '100%', boxSizing: 'border-box' },
    btn: { padding: '12px 24px', borderRadius: 8, background: C.blue, color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' },
    btn2: { padding: '10px 20px', borderRadius: 8, border: `2px dashed ${C.blue}`, background: 'transparent', color: C.blue, cursor: 'pointer', fontWeight: 600 }
  };

  return (
    <div style={{ background: C.light, minHeight: '100vh', fontFamily: 'Outfit, sans-serif', color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      
      {/* CABECERA CORPORATIVA DE LA APP */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.blue})`, padding: '20px 40px', color: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            {BRAND.companyLogo ? (
              <img src={BRAND.companyLogo} alt={BRAND.name} style={{ height: 40, objectFit: 'contain', background: '#fff', padding: 5, borderRadius: 8 }} />
            ) : (
              <div style={{ background: '#fff', color: C.blue, fontWeight: 900, fontSize: 20, padding: '5px 12px', borderRadius: 8, letterSpacing: -1 }}>D.</div>
            )}
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700, opacity: 0.8 }}>{BRAND.name} EDUCACIÓN</div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{nombre ? `Propuesta: ${nombre}` : "Portal Escolar"}</h1>
            </div>
          </div>
          {step >= 2 && step !== 3 && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', padding: 4, borderRadius: 8 }}>
              <button onClick={() => setViewMode('comercial')} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: isC ? '#fff' : 'transparent', color: isC ? C.blue : '#fff', fontWeight: 700, cursor: 'pointer' }}>🔧 Comercial</button>
              <button onClick={() => setViewMode('colegio')} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: !isC ? '#fff' : 'transparent', color: !isC ? C.blue : '#fff', fontWeight: 700, cursor: 'pointer' }}>🏫 Vista Cliente</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '30px 20px' }}>
        
        {step === 0 && (
          <div style={sty.card}>
            <h2 style={{ marginTop: 0, fontSize: 24, color: C.navy, borderBottom: `2px solid ${C.muted}`, paddingBottom: 15 }}>Crear Nueva Propuesta</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 25, background: '#f8fafc', padding: 20, borderRadius: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Nombre del centro</label>
                <input style={sty.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Colegio Humanitas" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Responsable (Opcional)</label>
                <input style={sty.input} value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Ej: María García (Dirección)" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>URL Logotipo del Colegio (Opcional)</label>
                <input style={sty.input} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Ej: https://colegio.com/logo.png" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Pega ISBNs + Alumnos</label>
                <textarea style={{ ...sty.input, height: 200, fontFamily: 'monospace' }} value={inputText} onChange={e => setInputText(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>O sube un archivo (CSV/TXT)</label>
                <div style={{ border: `2px dashed ${C.muted}`, borderRadius: 10, padding: '40px 20px', textAlign: 'center', background: '#fff' }}>
                  <input type="file" ref={fileRef} accept=".csv,.txt,.tsv" onChange={handleFile} style={{ display: 'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={sty.btn2}>📄 Seleccionar Archivo</button>
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 15, padding: '15px', background: '#fef2f0', color: C.coral, borderRadius: 8, fontWeight: 600 }}>⚠️ {error}</div>}
            <div style={{ marginTop: 25, textAlign: 'right' }}>
              <button onClick={handleCruzar} disabled={!inputText.trim()} style={{ ...sty.btn, opacity: inputText.trim() ? 1 : 0.5, fontSize: 16 }}>Generar propuesta →</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ ...sty.card, textAlign: 'center', padding: '100px 20px' }}>
            <div style={{ fontSize: 50, marginBottom: 20 }}>⏳</div>
            <h2 style={{ color: C.navy, margin: 0 }}>{loadingMsg}</h2>
          </div>
        )}

        {(step === 2 || step === 3) && calc && (
          <>
            {/* CONTROLES COMERCIALES */}
            {isC && (
              <div style={{ background: '#fff', padding: '15px 25px', borderRadius: 12, marginBottom: 20, border: `1px solid ${C.blue}`, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, color: C.blue }}>🎯 Est. Compra (Slider Base)</span>
                    <span style={{ fontWeight: 800, color: C.blue }}>{probabilidad}%</span>
                  </div>
                  <input type="range" min="10" max="100" step="5" value={probabilidad} onChange={e => setProbabilidad(+e.target.value)} style={{ width: '100%', cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                  <div style={{ background: '#f8fafc', padding: '8px 15px', borderRadius: 8, border: `1px solid ${C.muted}`, fontSize: 13, fontWeight: 600 }}>
                    📄 Gasto Papel: <input type="number" value={costePapel} onChange={e => setCostePapel(+e.target.value)} style={{ width: 45, border: 'none', background:'transparent', outline: 'none', fontWeight: 'bold', color: C.blue }} />%
                    <span style={{ margin: '0 10px', color: C.muted }}>|</span>
                    💻 Gasto Digital: <input type="number" value={costeDigital} onChange={e => setCosteDigital(+e.target.value)} style={{ width: 45, border: 'none', background:'transparent', outline: 'none', fontWeight: 'bold', color: C.blue }} />%
                  </div>
                  <button onClick={handleGuardar} style={{ ...sty.btn, background: C.teal }}>{saving ? "⏳..." : "💾 Generar URL Cliente"}</button>
                </div>
              </div>
            )}

            {shareUrl && isC && (
              <div style={{ padding: 20, background: '#e8f5e9', borderRadius: 12, marginBottom: 20, border: '1px solid #c8e6c9', fontSize: 15, textAlign: 'center' }}>
                <strong style={{ color: C.green }}>¡Enlace listo para enviar al colegio!</strong><br/><br/>
                <a href={shareUrl} target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 'bold', wordBreak: 'break-all' }}>{shareUrl}</a>
              </div>
            )}

            {/* PESTAÑAS */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap' }}>
              {!isC && <button onClick={() => setTab('propuesta')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: tab === 'propuesta' ? C.blue : '#fff', color: tab === 'propuesta' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>Propuesta Integral</button>}
              {['resumen', 'detalle'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: tab === t ? C.blue : '#fff', color: tab === t ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>{t}</button>
              ))}
              {isC && <button onClick={() => setTab('editoriales')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: tab === 'editoriales' ? C.blue : '#fff', color: tab === 'editoriales' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>Editoriales y Rappel</button>}
              {data?.notFound?.length > 0 && <button onClick={() => setTab('notFound')} style={{ padding: '10px 20px', borderRadius: 8, border: `2px solid ${C.coral}`, background: tab === 'notFound' ? C.coral : '#fff', color: tab === 'notFound' ? '#fff' : C.coral, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>⚠️ {data.notFound.length} Faltantes</button>}
            </div>

            {/* 1. PROPUESTA (CLIENTE) */}
            {!isC && tab === 'propuesta' && (
              <div style={{ animation: 'fadeIn 0.5s ease-in' }}>
                <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.blue})`, borderRadius: 16, padding: '50px 40px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 30, marginBottom: 30, boxShadow: '0 10px 30px rgba(27, 107, 147, 0.2)' }}>
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, opacity: 0.8, marginBottom: 10, textTransform: 'uppercase' }}>Propuesta de colaboración</div>
                    <h2 style={{ margin: '0 0 15px 0', fontSize: 38, lineHeight: 1.2 }}>{nombre} x {BRAND.name}</h2>
                    {responsable && <p style={{ fontSize: 18, opacity: 0.9, margin: '0 0 15px 0', borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>A la atención de: <strong>{responsable}</strong></p>}
                    <p style={{ fontSize: 16, opacity: 0.8, maxWidth: 600, margin: 0, lineHeight: 1.6 }}>Simplificamos los procesos para las familias y aumentamos la rentabilidad del colegio. Nosotros nos encargamos de todo.</p>
                  </div>
                  {logoUrl && (
                    <div style={{ background: '#fff', padding: 15, borderRadius: '50%', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                      <img src={logoUrl} alt="Logo Colegio" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} onError={(e) => e.target.style.display='none'} />
                    </div>
                  )}
                </div>

                <div style={{ ...sty.card, border: `2px solid ${C.teal}`, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 30 }}>
                    <div style={{ flex: 1, minWidth: 300 }}>
                      <h3 style={{ marginTop: 0, color: C.teal, display: 'flex', alignItems: 'center', gap: 10, fontSize: 22 }}>🧮 Simulador de Retorno</h3>
                      <p style={{ color: C.slate, fontSize: 15, lineHeight: 1.5, margin: '10px 0 25px 0' }}>Descubre el retorno económico para tu centro ajustando la estimación de familias que utilizarán la plataforma.</p>
                      
                      <div style={{ background: '#f8fafc', padding: '15px 20px', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: C.ink }}>Familias estimadas</span>
                          <span style={{ fontWeight: 800, color: C.teal, fontSize: 18 }}>{probabilidad}%</span>
                        </div>
                        <input type="range" min="10" max="100" step="5" value={probabilidad} onChange={e => setProbabilidad(+e.target.value)} style={{ width: '100%', cursor: 'pointer', accentColor: C.teal }} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', alignItems: 'center' }}>
                      <KPI label="Beneficio Estimado" value={fmt(calc.benColegio)} accent />
                      {calc.rap > 0 && <KPI label="Rappel Garantizado" value={fmt(calc.rap)} sub="Por mejora de condiciones" color={C.coral} />}
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.muted}`, marginTop: 25, paddingTop: 15, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: C.slate, fontStyle: 'italic', margin: 0 }}>* Datos aproximados. Sujeto a variaciones finales de compra y actualización de tarifas anuales.</p>
                  </div>
                </div>

                <h3 style={{ fontSize: 26, color: C.navy, textAlign: 'center', marginTop: 45, marginBottom: 30 }}>¿Por qué externalizar "La Tienda del Cole" con nosotros?</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 25 }}>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.blue}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 18 }}>💻 Tu propia Tienda Online</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Creamos un e-commerce totalmente gratuito y personalizado a tu nombre. Vende libros, licencias y material abriendo una nueva línea de negocio a coste cero.</p>
                  </div>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.teal}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 18 }}>📦 Logística 100% Gestionada</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Asumimos toda la relación con editoriales: pedidos, almacenamiento, preparación individualizada y entrega a domicilio. El centro no invierte ni un minuto.</p>
                  </div>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.gold}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 18 }}>💬 Atención a Familias 360º</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Contamos con un equipo dedicado y especialista para resolver dudas, incidencias y devoluciones. Liberamos por completo a la secretaría del estrés de campaña.</p>
                  </div>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.coral}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 18 }}>🔗 Hub de Licencias Digitales</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Activación automática de todos los libros digitales a través de nuestro Hub. Proceso simple, seguro e integrable con Google Classroom o Microsoft Teams.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. RESUMEN */}
            {tab === 'resumen' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 25 }}>
                  <KPI label="Facturación Estimada" value={fmt(calc.tv)} sub={`De ${Math.round(calc.totalAlumnos * (probabilidad/100))} compras estimadas`} icon="💰" />
                  <KPI label="Total Costes Centro" value={fmt(calc.tcc + calc.totalCostOp)} sub={`Material: ${fmt(calc.tcc)} | Op: ${fmt(calc.totalCostOp)}`} icon="📉" color={C.slate} />
                  <KPI label="Beneficio Colegio" value={fmt(calc.benColegio)} sub="Comisión + Rappel" icon="🏫" accent />
                  {isC && <KPI label="Beneficio Tienda" value={fmt(calc.comision)} sub="Neto Deliber" icon="📈" />}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                  <div style={sty.card}>
                    <h3 style={{ marginTop: 0, fontSize: 18 }}>Ventas por Editorial</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={calc.prov.map(p => ({ name: sh(p.p), Venta: Math.round(p.tv) }))} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: C.navy, fontWeight: 600 }} />
                        <Tooltip formatter={v => fmt(v)} cursor={{fill: '#f4f7fa'}} />
                        <Bar dataKey="Venta" fill={C.blue} radius={[0, 6, 6, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={sty.card}>
                    <h3 style={{ marginTop: 0, fontSize: 18 }}>Distribución</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={calc.prov.map((p,i) => ({ name: sh(p.p), value: Math.round(p.tv), fill: C.ch[i%C.ch.length] }))} dataKey="value" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} />
                        <Tooltip formatter={v => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* 3. DETALLE */}
            {tab === 'detalle' && (
              <div style={sty.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>Listado Oficial de Títulos ({calc.t})</h3>
                  <input type="text" placeholder="Buscar ISBN o título..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...sty.input, width: 300 }} />
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 600 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ position: 'sticky', top: 0, background: C.light }}>
                      <tr style={{ textAlign: 'left', borderBottom: `2px solid ${C.muted}` }}>
                        <th style={{ padding: 12 }}>ISBN</th>
                        <th style={{ padding: 12 }}>Título</th>
                        <th style={{ padding: 12 }}>Fmt</th>
                        <th style={{ padding: 12 }}>PVP</th>
                        <th style={{ padding: 12, textAlign: 'center' }}>Alumnos Base</th>
                        <th style={{ padding: 12, textAlign: 'center' }}>Est. Compra ({probabilidad}%)</th>
                        <th style={{ padding: 12, textAlign: 'right' }}>Venta Estimada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.muted}`, background: i % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                          <td style={{ padding: 12, fontFamily: 'monospace', color: C.slate }}>{r.isbn}</td>
                          <td style={{ padding: 12, fontWeight: 600 }}>{r.titulo}</td>
                          <td style={{ padding: 12, fontSize: 16 }}>{r.isPapel ? '📄' : '💻'}</td>
                          <td style={{ padding: 12 }}>{fmt(r.pvp)}</td>
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <input type="number" value={r.alumnos} onChange={e => updateAlumnos(r.isbn, e.target.value)} disabled={!isC} style={{ width: 60, padding: 6, textAlign: 'center', border: `1px solid ${C.muted}`, borderRadius: 6, background: isC ? '#fff' : 'transparent', fontWeight: 'bold' }} />
                          </td>
                          <td style={{ padding: 12, textAlign: 'center', fontWeight: 800, color: C.teal }}>{Math.round(r.alumsEstimados)}</td>
                          <td style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>{fmt(r.tv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. EDITORIALES (Solo Comercial) */}
            {tab === 'editoriales' && isC && (
              <div style={sty.card}>
                <h3 style={{ marginTop: 0 }}>Descuentos y Rappel por Editorial</h3>
                <p style={{ fontSize: 14, color: C.slate }}>Modifica el DTO del colegio para calcular su rappel exacto.</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead><tr style={{ background: C.light, textAlign: 'left' }}>
                    <th style={{ padding: 12 }}>Proveedor</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>Nuestro DTO.</th>
                    <th style={{ padding: 12, textAlign: 'center' }}>DTO. Colegio</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Rappel Generado</th>
                  </tr></thead>
                  <tbody>
                    {Object.keys(colDtos).sort().map((prov, i) => {
                      const d = colDtos[prov];
                      const dif = d.col > d.scho;
                      const provCalc = calc.prov.find(p => p.p === prov);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 12, fontWeight: 600 }}>{sh(prov)}</td>
                          <td style={{ padding: 12, textAlign: 'center', color: C.slate }}>{d.scho}%</td>
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <input type="number" value={d.col} onChange={e => setColDtos(p => ({ ...p, [prov]: { ...p[prov], col: +e.target.value } }))} style={{ width: 70, padding: 8, textAlign: 'center', border: `2px solid ${dif ? C.coral : C.muted}`, borderRadius: 6, fontWeight: 'bold', fontSize: 15 }} />
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', fontWeight: 800, color: (provCalc?.rap || 0) > 0 ? C.coral : C.slate, fontSize: 15 }}>
                            {fmt(provCalc?.rap || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. N8N / NO ENCONTRADOS */}
            {tab === 'notFound' && data?.notFound && (
              <div style={{ ...sty.card, border: `2px solid ${C.coral}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                  <div>
                    <h3 style={{ marginTop: 0, color: C.coral }}>⚠️ Atención: {data.notFound.length} ISBNs ignorados (No están en catálogo)</h3>
                    <p style={{ color: C.slate, margin: 0 }}>El comercial debe decidir si crear la propuesta sin ellos o avisar a Compras para que los den de alta en el Excel.</p>
                  </div>
                  <button 
                    onClick={handleSendWebhook} 
                    disabled={webhookSent}
                    style={{ ...sty.btn, background: webhookSent ? C.green : C.ink, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {webhookSent ? "✅ Enviado a Compras" : "✉️ Avisar a Compras (n8n)"}
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 25 }}>
                  {data.notFound.map((isbn, i) => (
                    <span key={i} style={{ padding: '8px 12px', background: '#fef2f0', borderRadius: 8, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', color: C.coral }}>{isbn}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, sub, icon, accent, color }) {
  return (
    <div style={{ background: accent ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : C.card, padding: '25px', borderRadius: 16, boxShadow: '0 8px 20px rgba(0,0,0,0.04)', color: accent ? '#fff' : (color || C.ink), border: accent ? 'none' : `1px solid ${C.muted}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>{icon && <span style={{fontSize: 18}}>{icon}</span>} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}
