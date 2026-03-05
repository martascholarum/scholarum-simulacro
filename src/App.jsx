import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ── CONFIGURACIÓN DE MARCA ──
const BRAND = {
  name: "SCHOLARUM",
  primary: "#1b6b93",    
  secondary: "#00897b",  
  accent: "#e5a100",     
  bg: "#f4f7fa",         
  card: "#ffffff"        
};

const API = "https://script.google.com/macros/s/AKfycbwCYoLIusztmA7AXeEx8HnVprZoQJFMW-vIslvmgFNdvzt_NoY5d8w9nNOLP2btQ0b0/exec";

const C = {
  ink: '#0c1e30', navy: '#122d47', blue: BRAND.primary, teal: BRAND.secondary, 
  gold: BRAND.accent, coral: '#d4513d', slate: '#6b7f94', green: '#2a7d3f', 
  light: BRAND.bg, card: BRAND.card, muted: '#e9ecf1', 
  ch: [BRAND.primary, BRAND.secondary, BRAND.accent, '#d4513d', '#7b5ea7']
};

const fmt = n => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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
  const [loadingMsg, setLoadingMsg] = useState('Cargando...'); // FIX: Mensaje dinámico
  const [nombre, setNombre] = useState('');
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
  const fileRef = useRef(null);

  const isC = viewMode === 'comercial';

  useEffect(() => { if (isC && tab === 'propuesta') setTab('resumen'); }, [isC, tab]);

  // Carga inicial por URL
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
          setCostePapel(res.costeOp || 12); setCosteDigital(res.costeOpDigital || 10);
          setProbabilidad(res.prob || 100);
          setColDtos(res.condiciones || {});
          setViewMode(modo === 'colegio' ? 'colegio' : 'comercial');
          setTab(modo === 'colegio' ? 'propuesta' : 'resumen'); // El colegio entra directo a la propuesta
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
        dtos[prov].sum += (b.dto || 0);
        dtos[prov].count += 1;
      });
      const finalDtos = {};
      Object.keys(dtos).forEach(prov => {
        const avg = Math.round(dtos[prov].sum / dtos[prov].count);
        finalDtos[prov] = { scho: avg, col: avg };
      });
      setColDtos(finalDtos); setStep(2); setTab('resumen');
    } catch (e) { setError(e.message); setStep(0); }
    finally { setLoading(false); }
  }, [inputText]);

  const handleGuardar = useCallback(async () => {
    if (!editableData) return; setSaving(true);
    try {
      const saveData = { nombre, costeOp: costePapel, costeOpDigital: costeDigital, prob: probabilidad, condiciones: colDtos, datos: editableData };
      const r = await apiCall('guardar', { data: saveData });
      if (r.error) throw new Error(r.error);
      const url = `${window.location.origin}${window.location.pathname}?id=${r.id}&modo=colegio`;
      setShareUrl(url);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, probabilidad, colDtos]);

  const updateAlumnos = useCallback((isbn, val) => {
    setEditableData(prev => ({ ...prev, found: prev.found.map(b => b.isbn === isbn ? { ...b, alumnos: parseInt(val) || 0 } : b) }));
  }, []);

  const handleFile = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setInputText(ev.target.result);
    r.readAsText(f);
  }, []);

  const calc = useMemo(() => {
    if (!editableData?.found) return null;
    const probFactor = probabilidad / 100;

    const rows = editableData.found.map(book => {
      const coste = book.coste; 
      const d = colDtos[book.proveedor] || { scho: book.dto || 0, col: book.dto || 0 };
      const difFactor = d.col > d.scho ? (d.col - d.scho) / (100 - d.scho) : 0;
      const costeCol = coste * (1 - difFactor);
      
      const isPapel = (book.formato || 'Papel').toLowerCase().includes('papel');
      const opPct = (isPapel ? costePapel : costeDigital) / 100;
      
      const alumsEstimados = (book.alumnos || 0) * probFactor;
      const tv = alumsEstimados * book.pvp;
      const tcs = alumsEstimados * coste;
      const tcc = alumsEstimados * costeCol;
      const costOp = tv * opPct;

      return { ...book, tv, tcs, tcc, costOp, rap: tcs - tcc, isPapel, alumsEstimados };
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
    btn: { padding: '12px 24px', borderRadius: 8, background: C.blue, color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' },
    btn2: { padding: '10px 20px', borderRadius: 8, border: `2px dashed ${C.blue}`, background: 'transparent', color: C.blue, cursor: 'pointer', fontWeight: 600 }
  };

  return (
    <div style={{ background: C.light, minHeight: '100vh', fontFamily: 'Outfit, sans-serif', color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      
      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.blue})`, padding: '24px 40px', color: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700, opacity: 0.7 }}>{BRAND.name}</div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{nombre || "Portal Escolar"}</h1>
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
            <h2 style={{ marginTop: 0, fontSize: 24, color: C.navy }}>Nuevo simulacro</h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Nombre del colegio</label>
              <input style={{...sty.input, maxWidth: 400}} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Colegio Humanitas" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Pega ISBNs + Alumnos</label>
                <textarea style={{ ...sty.input, height: 200, fontFamily: 'monospace' }} value={inputText} onChange={e => setInputText(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>O sube un archivo (CSV/TXT)</label>
                <div style={{ border: `2px dashed ${C.muted}`, borderRadius: 10, padding: '40px 20px', textAlign: 'center', background: '#f9fafb' }}>
                  <input type="file" ref={fileRef} accept=".csv,.txt,.tsv" onChange={handleFile} style={{ display: 'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={sty.btn2}>📄 Seleccionar Archivo</button>
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 15, padding: '15px', background: '#fef2f0', color: C.coral, borderRadius: 8, fontWeight: 600 }}>⚠️ {error}</div>}
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={handleCruzar} disabled={!inputText.trim()} style={{ ...sty.btn, opacity: inputText.trim() ? 1 : 0.5 }}>Generar propuesta →</button>
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
                <a href={shareUrl} target="_blank" style={{ color: C.blue, fontWeight: 'bold', wordBreak: 'break-all' }}>{shareUrl}</a>
              </div>
            )}

            {/* MENÚ DE PESTAÑAS */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap' }}>
              {!isC && <button onClick={() => setTab('propuesta')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: tab === 'propuesta' ? C.blue : '#fff', color: tab === 'propuesta' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer' }}>Propuesta Integral</button>}
              {['resumen', 'detalle'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: tab === t ? C.blue : '#fff', color: tab === t ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>
              ))}
              {isC && <button onClick={() => setTab('editoriales')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: tab === 'editoriales' ? C.blue : '#fff', color: tab === 'editoriales' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer' }}>Editoriales y Rappel</button>}
              {data?.notFound?.length > 0 && <button onClick={() => setTab('notFound')} style={{ padding: '10px 20px', borderRadius: 8, border: `2px solid ${C.coral}`, background: tab === 'notFound' ? C.coral : '#fff', color: tab === 'notFound' ? '#fff' : C.coral, fontWeight: 700, cursor: 'pointer' }}>⚠️ {data.notFound.length} No Encontrados</button>}
            </div>

            {/* 1. PESTAÑA PROPUESTA (LA LANDING PAGE DEL COLEGIO) */}
            {!isC && tab === 'propuesta' && (
              <div style={{ animation: 'fadeIn 0.5s ease-in' }}>
                {/* HERO SECTION */}
                <div style={{ background: `url('https://www.transparenttextures.com/patterns/cubes.png'), linear-gradient(135deg, ${C.navy}, ${C.blue})`, borderRadius: 16, padding: '50px 30px', color: '#fff', textAlign: 'center', marginBottom: 30, boxShadow: '0 10px 30px rgba(27, 107, 147, 0.2)' }}>
                  <h2 style={{ margin: '0 0 15px 0', fontSize: 36 }}>Propuesta Integral para {nombre}</h2>
                  <p style={{ fontSize: 18, opacity: 0.9, maxWidth: 700, margin: '0 auto', lineHeight: 1.6 }}>Externaliza la gestión de tus libros de texto con cero esfuerzo administrativo y maximiza los beneficios para el centro y las familias.</p>
                </div>

                {/* CALCULADORA INTERACTIVA */}
                <div style={{ ...sty.card, border: `2px solid ${C.teal}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                    <div style={{ flex: 1, minWidth: 250 }}>
                      <h3 style={{ marginTop: 0, color: C.teal, display: 'flex', alignItems: 'center', gap: 10, fontSize: 22 }}>🧮 Calculadora de Beneficios</h3>
                      <p style={{ color: C.slate, fontSize: 14, lineHeight: 1.5 }}>Utiliza este simulador para estimar el beneficio final del centro en función del porcentaje de familias que adquieran los libros en la plataforma.</p>
                      <div style={{ marginTop: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: C.ink }}>Estimación de Compra</span>
                          <span style={{ fontWeight: 800, color: C.teal, fontSize: 18 }}>{probabilidad}%</span>
                        </div>
                        <input type="range" min="10" max="100" step="5" value={probabilidad} onChange={e => setProbabilidad(+e.target.value)} style={{ width: '100%', cursor: 'pointer', accentColor: C.teal }} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
                      <KPI label="Beneficio Estimado" value={fmt(calc.benColegio)} accent />
                      {calc.rap > 0 && <KPI label="Rappel Garantizado" value={fmt(calc.rap)} sub="Por condiciones del centro" color={C.coral} />}
                    </div>
                  </div>
                </div>

                {/* PILARES */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 25, marginTop: 30 }}>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.blue}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 20 }}>📦 Gestión Logística Integral</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.6 }}>Nos encargamos del ciclo completo: negociación y compra a editoriales, recepción en almacén, empaquetado personalizado por alumno y entrega directa. <strong>Cero inversión de tiempo</strong> por parte de la secretaría del colegio.</p>
                  </div>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.teal}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 20 }}>💬 Atención a Familias 360º</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.6 }}>Nuestro equipo de atención al cliente asume todas las incidencias, devoluciones, cambios de grupo y dudas de los padres durante todo el proceso de compra y curso escolar.</p>
                  </div>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.gold}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 20 }}>📈 Transparencia Financiera</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.6 }}>Si las condiciones comerciales previamente negociadas por el colegio con la editorial son mejores que las de nuestra central de compras, respetamos tu margen devolviendo esa diferencia de forma íntegra (Rappel).</p>
                  </div>
                  <div style={{ padding: 30, background: '#fff', borderRadius: 16, borderTop: `5px solid ${C.coral}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 20 }}>💻 Plataforma Web Personalizada</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.6 }}>Desplegamos una tienda online con el logo y colores del colegio. Las familias encuentran sus listados de libros precargados por curso, garantizando un proceso de pago rápido y seguro.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. PESTAÑA RESUMEN */}
            {tab === 'resumen' && (
              <div>
                {/* KPIs Superiores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 25 }}>
                  <KPI label="Facturación" value={fmt(calc.tv)} sub={`De ${calc.totalAlumnos} alumnos`} icon="💰" />
                  {isC && <KPI label="Total Costes" value={fmt(calc.tcc + calc.totalCostOp)} sub={`Material: ${fmt(calc.tcc)} | Op: ${fmt(calc.totalCostOp)}`} icon="📉" color={C.slate} />}
                  {isC && <KPI label="Beneficio Tienda" value={fmt(calc.comision)} sub="Neto Scholarum" icon="📈" />}
                  {isC && <KPI label="Beneficio Colegio" value={fmt(calc.benColegio)} sub="Comisión + Rappel" icon="🏫" accent />}
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

            {/* 3. PESTAÑA DETALLE */}
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
                          <td style={{ padding: 12 }}>{r.pvp?.toFixed(2)}€</td>
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

            {/* 4. PESTAÑA EDITORIALES (Solo Comercial) */}
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

            {/* 5. PESTAÑA NO ENCONTRADOS */}
            {tab === 'notFound' && data?.notFound && (
              <div style={{ ...sty.card, border: `2px solid ${C.coral}` }}>
                <h3 style={{ marginTop: 0, color: C.coral }}>⚠️ Atención: {data.notFound.length} ISBNs ignorados por no estar en el catálogo</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 15 }}>
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
    <div style={{ background: accent ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : C.card, padding: '25px', borderRadius: 16, boxShadow: '0 8px 20px rgba(0,0,0,0.04)', color: accent ? '#fff' : (color || C.ink), border: accent ? 'none' : `1px solid ${C.muted}` }}>
      <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>{icon && <span style={{fontSize: 18}}>{icon}</span>} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}
