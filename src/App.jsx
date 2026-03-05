import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// ── CONFIGURACIÓN DE MARCA ──
const BRAND = {
  name: "SCHOLARUM",
  primary: "#1b6b93",    
  secondary: "#00897b",  
  accent: "#e5a100",     
  bg: "#f4f7fa",         
  card: "#ffffff"        
};

// PON TU API KEY AQUÍ
const API = "https://script.google.com/macros/s/AKfycbwCYoLIusztmA7AXeEx8HnVprZoQJFMW-vIslvmgFNdvzt_NoY5d8w9nNOLP2btQ0b0/exec";

const C = {
  ink: '#0c1e30', navy: '#122d47', blue: BRAND.primary, teal: BRAND.secondary, 
  gold: BRAND.accent, coral: '#d4513d', slate: '#6b7f94', green: '#2a7d3f', 
  light: BRAND.bg, card: BRAND.card, muted: '#e9ecf1', 
  ch: [BRAND.primary, BRAND.secondary, BRAND.accent, '#d4513d', '#7b5ea7']
};

const fmt = n => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fPct = n => (n * 100).toFixed(1) + '%';
const fN = n => Math.round(n).toLocaleString('es-ES');
const sh = p => (p || '').replace(/Comercial (de ediciones |Grupo )/g, '').replace(/ S\.A\.U?\./g, '').replace(/ SL$/,'').replace(/ S\.L\.U?\./g,'').replace(/Ediciones /,'').replace(/Editorial /,'').replace('MacMillan Iberia','MacMillan');

// ── SMART PARSER ──
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
    const numRe = /\b(\d{1,3})\b/g;
    let m;
    while ((m = numRe.exec(cleanLine)) !== null) {
      const n = parseInt(m[1]);
      if (n > 0 && n < 1000) numbers.push(n);
    }
    for (let idx = 0; idx < isbns.length; idx++) {
      const isbn = isbns[idx];
      const alumnos = idx < numbers.length ? numbers[idx] : (numbers.length === 1 ? numbers[0] : 0);
      if (!entries.find(e => e.isbn === isbn)) entries.push({ isbn, alumnos, curso: '' });
    }
  }
  return entries;
}

// ── API CALL (FIXED: GET para leer, POST para guardar datos largos) ──
async function apiCall(action, params = {}) {
  if (action === 'guardar') {
    // Usamos POST con text/plain para evitar que la URL explote por tamaño y saltarnos el CORS block
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...params })
    });
    if (!r.ok) throw new Error(`Error servidor HTTP ${r.status}`);
    return r.json();
  } else {
    const url = new URL(API);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    }
    const r = await fetch(url.toString(), { redirect: 'follow' });
    if (!r.ok) throw new Error(`Error servidor HTTP ${r.status}`);
    return r.json();
  }
}

export default function App() {
  const [step, setStep] = useState(0);
  const [nombre, setNombre] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [editableData, setEditableData] = useState(null);
  const [colDtos, setColDtos] = useState({});
  const [costePapel, setCostePapel] = useState(12);
  const [costeDigital, setCosteDigital] = useState(10);
  const [tab, setTab] = useState('resumen');
  const [viewMode, setViewMode] = useState('comercial');
  const [shareUrl, setShareUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  // Carga inicial por URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('id'), modo = p.get('modo');
    if (id) {
      setLoading(true); setStep(1);
      apiCall('cargar', { id, modo: modo || 'colegio' })
        .then(res => {
          if (res.error) throw new Error(res.error);
          setNombre(res.nombre || '');
          setData(res.datos); setEditableData(res.datos);
          setCostePapel(res.costeOp || 12); setCosteDigital(res.costeOpDigital || 10);
          setColDtos(res.condiciones || {});
          setViewMode(modo === 'colegio' ? 'colegio' : 'comercial');
          setStep(modo === 'colegio' ? 3 : 2);
        })
        .catch(e => { setError(e.message); setStep(0); })
        .finally(() => setLoading(false));
    }
  }, []);

  const handleCruzar = useCallback(async () => {
    const entries = parseInput(inputText);
    if (!entries.length) { setError('No se detectaron ISBNs válidos.'); return; }
    setLoading(true); setError(''); setStep(1);
    try {
      const isbnStr = entries.map(e => `${e.isbn}:${e.alumnos}`).join(',');
      const r = await apiCall('cruzar', { isbns: isbnStr });
      if (r.error) throw new Error(r.error);
      setData(r); setEditableData(r);
      const dtos = {};
      (r.proveedores || []).forEach(p => { dtos[p.proveedor] = { scho: p.dtoScho, col: p.dtoColegio }; });
      setColDtos(dtos); setStep(2);
    } catch (e) { setError(e.message); setStep(0); }
    finally { setLoading(false); }
  }, [inputText]);

  const handleGuardar = useCallback(async () => {
    if (!editableData) return; setSaving(true);
    try {
      const saveData = { nombre: nombre || 'Sin nombre', costeOp: costePapel, costeOpDigital: costeDigital, condiciones: colDtos, datos: editableData };
      const r = await apiCall('guardar', { data: saveData });
      if (r.error) throw new Error(r.error);
      setShareUrl(`${window.location.origin}${window.location.pathname}?id=${r.id}&modo=colegio`);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, colDtos]);

  // RESTAURADA: Función para modificar alumnos
  const updateAlumnos = useCallback((isbn, val) => {
    const newAlumnos = parseInt(val) || 0;
    setEditableData(prev => {
      if (!prev?.found) return prev;
      return { ...prev, found: prev.found.map(b => b.isbn === isbn ? { ...b, alumnos: newAlumnos } : b) };
    });
  }, []);

  // RESTAURADA: Función para archivo CSV/TXT
  const handleFile = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setInputText(ev.target.result);
    r.readAsText(f);
  }, []);

  // MOTOR DE CÁLCULO
  const calc = useMemo(() => {
    if (!editableData?.found) return null;
    const rows = editableData.found.map(book => {
      const coste = book.coste; 
      const dtoScho = book.dto || 0;
      const d = colDtos[book.proveedor];
      const dtoCol = d ? d.col : dtoScho;
      
      const difFactor = dtoCol > dtoScho ? (dtoCol - dtoScho) / (100 - dtoScho) : 0;
      const costeCol = coste * (1 - difFactor);
      
      const isPapel = (book.formato || 'Papel').toLowerCase().includes('papel');
      const opPct = (isPapel ? costePapel : costeDigital) / 100;
      
      const tv = (book.alumnos || 0) * book.pvp;
      const tcs = (book.alumnos || 0) * coste;
      const tcc = (book.alumnos || 0) * costeCol;
      const costOp = tv * opPct;

      return { ...book, tv, tcs, tcc, costOp, rap: tcs - tcc, dtoScho, dtoCol, isPapel };
    });

    const tv = rows.reduce((s, r) => s + r.tv, 0);
    const tcs = rows.reduce((s, r) => s + r.tcs, 0);
    const tcc = rows.reduce((s, r) => s + r.tcc, 0);
    const totalCostOp = rows.reduce((s, r) => s + r.costOp, 0);
    const rap = tcs - tcc;
    const comision = tv - tcs - totalCostOp;
    const benColegio = comision + rap;

    const bp = {};
    rows.forEach(r => {
      const k = r.proveedor || 'Sin proveedor';
      if (!bp[k]) bp[k] = { p: k, n: 0, tv: 0, tcs: 0, tcc: 0, costOp: 0 };
      bp[k].n++; bp[k].tv += r.tv; bp[k].tcs += r.tcs; bp[k].tcc += r.tcc; bp[k].costOp += r.costOp;
    });
    const prov = Object.values(bp).map(p => ({
      ...p, m: p.tv - p.tcs, rap: p.tcs - p.tcc, ben: (p.tv - p.tcs - p.costOp) + (p.tcs - p.tcc)
    })).sort((a,b) => b.tv - a.tv);

    return { rows, prov, tv, tcs, tcc, totalCostOp, comision, rap, benColegio, t: rows.length };
  }, [editableData, colDtos, costePapel, costeDigital]);

  const isC = viewMode === 'comercial';
  const filtered = calc?.rows.filter(r => !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.isbn?.includes(search)) || [];

  const sty = {
    card: { background: C.card, borderRadius: 14, padding: 24, boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: `1px solid ${C.muted}` },
    input: { padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${C.muted}`, fontSize: 14, width: '100%', boxSizing: 'border-box' },
    btn: { padding: '12px 24px', borderRadius: 8, background: C.blue, color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' },
    btn2: { padding: '10px 20px', borderRadius: 8, border: `2px solid ${C.blue}`, background: 'transparent', color: C.blue, cursor: 'pointer', fontWeight: 600 }
  };

  return (
    <div style={{ background: C.light, minHeight: '100vh', fontFamily: 'Outfit, sans-serif', color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      
      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.blue})`, padding: '24px 40px', color: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700, opacity: 0.7 }}>{BRAND.name} AUTOMATION</div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{nombre || "Simulacro Escolar"}</h1>
          </div>
          {step >= 2 && step !== 3 && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', padding: 4, borderRadius: 8 }}>
              <button onClick={() => setViewMode('comercial')} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: isC ? '#fff' : 'transparent', color: isC ? C.blue : '#fff', fontWeight: 700, cursor: 'pointer' }}>🔧 Comercial</button>
              <button onClick={() => setViewMode('colegio')} style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: !isC ? '#fff' : 'transparent', color: !isC ? C.blue : '#fff', fontWeight: 700, cursor: 'pointer' }}>🏫 Colegio</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '30px 20px' }}>
        
        {/* PASO 0: INPUT Y CSV (RESTAURADO) */}
        {step === 0 && (
          <div style={sty.card}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Nuevo simulacro</h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Nombre del colegio</label>
              <input style={{...sty.input, maxWidth: 400}} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Colegio Humanitas" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Pega ISBNs + Alumnos</label>
                <textarea style={{ ...sty.input, height: 200, fontFamily: 'monospace' }} value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Ej: 9788411826617   48" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>O sube un archivo (CSV/TXT)</label>
                <div style={{ border: `2px dashed ${C.muted}`, borderRadius: 10, padding: '40px 20px', textAlign: 'center', background: '#f9fafb' }}>
                  <input type="file" ref={fileRef} accept=".csv,.txt,.tsv" onChange={handleFile} style={{ display: 'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={sty.btn2}>📄 Seleccionar Archivo</button>
                  <p style={{ margin: '10px 0 0', color: C.slate, fontSize: 13 }}>Detecta ISBNs de 13 dígitos automáticamente</p>
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 15, padding: '10px', background: '#fef2f0', color: C.coral, borderRadius: 8 }}>⚠️ {error}</div>}
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={handleCruzar} disabled={!inputText.trim()} style={{ ...sty.btn, opacity: inputText.trim() ? 1 : 0.5 }}>Generar simulacro →</button>
            </div>
          </div>
        )}

        {/* PASO 1: LOADING (RESTAURADO) */}
        {step === 1 && (
          <div style={{ ...sty.card, textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 50, marginBottom: 20, animation: 'pulse 1.5s infinite' }}>📚</div>
            <h2 style={{ color: C.navy, margin: 0 }}>Cruzando con el catálogo...</h2>
            <p style={{ color: C.slate }}>Buscando precios y formatos en tu Master DB.</p>
          </div>
        )}

        {/* PASO 2 Y 3: DASHBOARD */}
        {(step === 2 || step === 3) && calc && (
          <>
            {/* Controles Superiores */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['propuesta', 'resumen', 'detalle', ...(isC ? ['editoriales'] : [])].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === t ? C.blue : C.muted, color: tab === t ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {t}
                  </button>
                ))}
              </div>
              {isC && (
                <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                  <div style={{ background: '#fff', padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.muted}`, fontSize: 12, fontWeight: 600 }}>
                    📄 Papel: <input type="number" value={costePapel} onChange={e => setCostePapel(+e.target.value)} style={{ width: 40, border: 'none', outline: 'none', fontWeight: 'bold', color: C.blue }} />%
                    <span style={{ margin: '0 10px', color: C.muted }}>|</span>
                    💻 Digital: <input type="number" value={costeDigital} onChange={e => setCosteDigital(+e.target.value)} style={{ width: 40, border: 'none', outline: 'none', fontWeight: 'bold', color: C.blue }} />%
                  </div>
                  <button onClick={handleGuardar} style={{ ...sty.btn, background: C.teal, padding: '8px 16px' }}>{saving ? "⏳..." : "💾 Guardar URL"}</button>
                  <button onClick={() => window.location.reload()} style={{ ...sty.btn2, padding: '8px 16px' }}>Nuevo</button>
                </div>
              )}
            </div>

            {shareUrl && isC && (
              <div style={{ padding: 15, background: '#e8f5e9', borderRadius: 8, marginBottom: 20, border: '1px solid #c8e6c9', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Enlace para el cliente:</strong> <a href={shareUrl} target="_blank" style={{ color: C.green }}>{shareUrl}</a></span>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15, marginBottom: 25 }}>
              <KPI label="Facturación" value={fmt(calc.tv)} sub={`${calc.t} títulos`} icon="💰" />
              {isC && <KPI label="Comisión SCH" value={fmt(calc.comision)} sub="Neto" icon="📈" />}
              {calc.rap > 0 && <KPI label="Rappel Devuelto" value={fmt(calc.rap)} sub="Por mejora de condiciones" icon="🎁" />}
              <KPI label="Beneficio Colegio" value={fmt(calc.benColegio)} sub="Comisión + Rappel" icon="🏫" accent />
            </div>

            {/* TABS */}
            
            {/* NUEVA PESTAÑA: PROPUESTA DE VALOR */}
            {tab === 'propuesta' && (
              <div style={sty.card}>
                <h2 style={{ color: C.navy, marginTop: 0, fontSize: 24, textAlign: 'center', marginBottom: 30 }}>¿Por qué externalizar la tienda con {BRAND.name}?</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, borderLeft: `4px solid ${C.blue}` }}>
                    <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>📦 Gestión Integral</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Nos encargamos de toda la gestión: compra a editoriales, recepción, empaquetado personalizado por alumno y entrega directa. El colegio no invierte tiempo administrativo.</p>
                  </div>
                  <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, borderLeft: `4px solid ${C.teal}` }}>
                    <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>💬 Atención a Familias</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Nuestra atención al cliente asume todas las incidencias, devoluciones y dudas de los padres durante el proceso de compra. Liberamos a la secretaría del centro.</p>
                  </div>
                  <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, borderLeft: `4px solid ${C.gold}` }}>
                    <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>📈 Transparencia y Rappel</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Si las condiciones comerciales del colegio con la editorial son mejores que las nuestras, respetamos su margen devolviendo esa diferencia de forma íntegra.</p>
                  </div>
                  <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, borderLeft: `4px solid ${C.coral}` }}>
                    <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>💻 Plataforma Propia</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 14, lineHeight: 1.6 }}>Tienda online personalizada con el logo del colegio. Proceso de compra en 3 clics, listados de libros precargados y pasarela de pago segura.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RESUMEN (Gráficos) */}
            {tab === 'resumen' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                <div style={sty.card}>
                  <h3 style={{ marginTop: 0 }}>Ventas por Proveedor</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={calc.prov.map(p => ({ name: sh(p.p), Venta: Math.round(p.tv) }))} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="Venta" fill={C.blue} radius={[0, 4, 4, 0]} barSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={sty.card}>
                  <h3 style={{ marginTop: 0 }}>Distribución</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={calc.prov.map((p,i) => ({ name: sh(p.p), value: Math.round(p.tv), fill: C.ch[i%C.ch.length] }))} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80}>
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* TAB: DETALLE (RESTAURADA EDICIÓN Y BUSCADOR) */}
            {tab === 'detalle' && (
              <div style={sty.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
                  <h3 style={{ margin: 0 }}>Listado de Títulos</h3>
                  <input type="text" placeholder="Buscar ISBN o título..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...sty.input, width: 250, padding: '6px 12px' }} />
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 500 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: C.light }}>
                      <tr style={{ textAlign: 'left', borderBottom: `2px solid ${C.muted}` }}>
                        <th style={{ padding: 10 }}>ISBN</th>
                        <th style={{ padding: 10 }}>Título</th>
                        <th style={{ padding: 10 }}>Fmt</th>
                        <th style={{ padding: 10 }}>PVP</th>
                        <th style={{ padding: 10, textAlign: 'center' }}>Alumnos</th>
                        <th style={{ padding: 10, textAlign: 'right' }}>Total Venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.muted}`, background: i % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                          <td style={{ padding: 10, fontFamily: 'monospace' }}>{r.isbn}</td>
                          <td style={{ padding: 10 }}>{r.titulo}</td>
                          <td style={{ padding: 10 }}>{r.isPapel ? '📄' : '💻'}</td>
                          <td style={{ padding: 10 }}>{r.pvp?.toFixed(2)}€</td>
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            {/* RESTAURADO: Input editable para cambiar número de alumnos */}
                            <input 
                              type="number" 
                              value={r.alumnos} 
                              onChange={e => updateAlumnos(r.isbn, e.target.value)}
                              disabled={!isC}
                              style={{ width: 60, padding: 5, textAlign: 'center', border: `1px solid ${C.muted}`, borderRadius: 4, background: isC ? '#fff' : 'transparent' }}
                            />
                          </td>
                          <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{fmt(r.tv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: EDITORIALES (Para ajustar descuentos) */}
            {tab === 'editoriales' && isC && (
              <div style={sty.card}>
                <h3 style={{ marginTop: 0 }}>Descuentos por Editorial</h3>
                <p style={{ fontSize: 13, color: C.slate }}>Modifica el % de descuento pactado por el colegio para calcular el Rappel.</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: C.light, textAlign: 'left' }}>
                    <th style={{ padding: 10 }}>Proveedor</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>Nuestro DTO.</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>DTO. Colegio</th>
                  </tr></thead>
                  <tbody>
                    {Object.keys(colDtos).sort().map((prov, i) => {
                      const d = colDtos[prov];
                      const dif = d.col > d.scho;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 10, fontWeight: 600 }}>{sh(prov)}</td>
                          <td style={{ padding: 10, textAlign: 'center' }}>{d.scho}%</td>
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            <input type="number" value={d.col} 
                              onChange={e => setColDtos(p => ({ ...p, [prov]: { ...p[prov], col: +e.target.value } }))}
                              style={{ width: 60, padding: 5, textAlign: 'center', border: `2px solid ${dif ? C.coral : C.muted}`, borderRadius: 5, fontWeight: 'bold' }} 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}

// Componente para pintar KPIs bonitos
function KPI({ label, value, sub, icon, accent }) {
  return (
    <div style={{ 
      background: accent ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : C.card, 
      padding: '20px', borderRadius: 14, boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
      color: accent ? '#fff' : C.ink, border: accent ? 'none' : `1px solid ${C.muted}`
    }}>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 5, fontWeight: 600 }}>{icon} {label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
