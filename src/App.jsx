import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// ── CONFIGURACIÓN DE MARCA (Personaliza aquí) ──
const BRAND = {
  name: "SCHOLARUM",
  primary: "#1b6b93",    // Azul Principal
  secondary: "#00897b",  // Teal/Verde
  accent: "#e5a100",     // Oro/Detalles
  bg: "#f4f7fa",         // Fondo de la app
  card: "#ffffff"        // Color de las tarjetas
};

const API = "https://script.google.com/macros/s/AKfycbwCYoLIusztmA7AXeEx8HnVprZoQJFMW-vIslvmgFNdvzt_NoY5d8w9nNOLP2btQ0b0/exec";

// Estilos globales de colores basados en BRAND
const C = {
  ink: '#0c1e30',
  navy: '#122d47',
  blue: BRAND.primary,
  teal: BRAND.secondary,
  gold: BRAND.accent,
  coral: '#d4513d',
  slate: '#6b7f94',
  green: '#2a7d3f',
  light: BRAND.bg,
  card: BRAND.card,
  muted: '#e9ecf1',
  ch: [BRAND.primary, BRAND.secondary, BRAND.accent, '#d4513d', '#7b5ea7', '#6b7f94']
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

// ── API CALL (FIXED: No double encoding) ──
async function apiCall(action, params = {}) {
  const url = new URL(API);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    // IMPORTANTE: URLSearchParams ya codifica, no usar encodeURIComponent aquí
    url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  const r = await fetch(url.toString(), { mode: 'cors' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
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

  // ── LOAD SIMULACRO ──
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('id'), modo = p.get('modo');
    if (id) {
      setLoading(true); setStep(1);
      apiCall('cargar', { id, modo: modo || 'colegio' })
        .then(res => {
          if (res.error) throw new Error(res.error);
          setNombre(res.nombre || '');
          setData(res.datos);
          setEditableData(res.datos);
          setCostePapel(res.costeOp || 12);
          setCosteDigital(res.costeOpDigital || 10);
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
    if (!entries.length) { setError('No detectado'); return; }
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
      const url = `${window.location.origin}${window.location.pathname}?id=${r.id}&modo=colegio`;
      setShareUrl(url);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, colDtos]);

  // ── CALC ENGINE (Restaurado el 12% y 10% variables) ──
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
      // AQUI VOLVEMOS A LAS VARIABLES DINAMICAS
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

  // Estilos UI
  const sty = {
    card: { background: C.card, borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: `1px solid ${C.muted}` },
    input: { padding: '12px 16px', borderRadius: 10, border: `1px solid ${C.muted}`, width: '100%', fontSize: 14 },
    btn: { padding: '12px 24px', borderRadius: 10, background: C.blue, color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }
  };

  const isC = viewMode === 'comercial';

  return (
    <div style={{ background: C.light, minHeight: '100vh', fontFamily: 'Outfit, sans-serif', color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet" />
      
      {/* HEADER DINÁMICO */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.blue})`, padding: '30px 40px', color: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, fontWeight: 700, opacity: 0.6 }}>{BRAND.name} AUTOMATION</div>
            <h1 style={{ margin: 0, fontSize: 24 }}>{nombre || "Simulacro Escolar"}</h1>
          </div>
          {step >= 2 && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', padding: 5, borderRadius: 10 }}>
              <button onClick={() => setViewMode('comercial')} style={{ padding: '8px 15px', border: 'none', borderRadius: 8, background: isC ? '#fff' : 'transparent', color: isC ? C.blue : '#fff', fontWeight: 700, cursor: 'pointer' }}>Comercial</button>
              <button onClick={() => setViewMode('colegio')} style={{ padding: '8px 15px', border: 'none', borderRadius: 8, background: !isC ? '#fff' : 'transparent', color: !isC ? C.blue : '#fff', fontWeight: 700, cursor: 'pointer' }}>Colegio</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 40 }}>
        {/* Paso 0: Input */}
        {step === 0 && (
          <div style={sty.card}>
            <h2 style={{ marginTop: 0 }}>Carga de Datos</h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Nombre del Centro</label>
              <input style={sty.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Obispo Perelló" />
            </div>
            <textarea 
              style={{ ...sty.input, height: 200, fontFamily: 'monospace' }} 
              value={inputText} onChange={e => setInputText(e.target.value)}
              placeholder="Pega aquí el listado (ISBN y Alumnos)..."
            />
            <button onClick={handleCruzar} style={{ ...sty.btn, marginTop: 20, width: '100%' }}>
              {loading ? "Procesando catálogo..." : "Generar Simulacro →"}
            </button>
            {error && <p style={{ color: C.coral, fontWeight: 600 }}>{error}</p>}
          </div>
        )}

        {/* Paso 2: Resultados */}
        {step >= 2 && calc && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 30 }}>
              <KPI label="Facturación Estimada" value={fmt(calc.tv)} icon="💰" />
              {isC && <KPI label="Margen Scholarum" value={fmt(calc.comision)} icon="📈" color={C.green} />}
              {calc.rap > 1 && <KPI label="Rappel Colegio" value={fmt(calc.rap)} icon="🎁" color={C.coral} />}
              <KPI label="Beneficio para el Centro" value={fmt(calc.benColegio)} icon="🏫" accent />
            </div>

            {/* Selector de porcentajes operativos (Solo comercial) */}
            {isC && (
              <div style={{ ...sty.card, marginBottom: 20, display: 'flex', gap: 40 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>COSTE OP. PAPEL: {costePapel}%</label>
                  <input type="range" min="0" max="25" value={costePapel} onChange={e => setCostePapel(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>COSTE OP. DIGITAL: {costeDigital}%</label>
                  <input type="range" min="0" max="25" value={costeDigital} onChange={e => setCosteDigital(e.target.value)} />
                </div>
                <button onClick={handleGuardar} style={{ ...sty.btn, marginLeft: 'auto', background: C.teal }}>
                  {saving ? "Guardando..." : "💾 Guardar y Compartir"}
                </button>
              </div>
            )}

            {shareUrl && isC && (
              <div style={{ padding: 15, background: '#e8f5e9', borderRadius: 10, marginBottom: 20, border: '1px solid #c8e6c9', fontSize: 13 }}>
                <strong>Enlace para el colegio:</strong> <a href={shareUrl} target="_blank">{shareUrl}</a>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {['resumen', 'detalle'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: tab === t ? C.blue : C.muted, color: tab === t ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer' }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {tab === 'resumen' && (
              <div style={sty.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: `2px solid ${C.muted}` }}>
                      <th style={{ padding: 12 }}>Proveedor</th>
                      <th style={{ padding: 12, textAlign: 'right' }}>Venta</th>
                      <th style={{ padding: 12, textAlign: 'right' }}>Beneficio Centro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.prov.map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.muted}` }}>
                        <td style={{ padding: 12, fontWeight: 600 }}>{sh(p.p)}</td>
                        <td style={{ padding: 12, textAlign: 'right' }}>{fmt(p.tv)}</td>
                        <td style={{ padding: 12, textAlign: 'right', color: C.teal, fontWeight: 700 }}>{fmt(p.ben)}</td>
                      </tr>
                    ))}
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

function KPI({ label, value, icon, color, accent }) {
  return (
    <div style={{ 
      background: accent ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : C.card, 
      padding: 20, borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
      color: accent ? '#fff' : C.ink,
      border: accent ? 'none' : `1px solid ${C.muted}`
    }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 5 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
