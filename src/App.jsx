import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

const API = "https://script.google.com/macros/s/AKfycbx6OQ3C3iYw9bGXtx82hZNlevQOZBp4u1aUuoHkQQeiIZKknKtcCJsAa6fI9Xbr1CJT/exec";

// ── THEME ──
const T = {
  bg: '#0e1117', surface: '#1a1d24', card: '#262730', cardHover: '#2e303a',
  accent: '#ff4b4b', accentSoft: '#ff4b4b22', blue: '#4da3ff', blueSoft: '#4da3ff18',
  green: '#21c354', greenSoft: '#21c35418', gold: '#faca15', goldSoft: '#faca1518',
  coral: '#ff6b6b', teal: '#00d4aa',
  text: '#fafafa', textMuted: '#808495', textDim: '#555770',
  border: '#333645', input: '#1e2028', inputBorder: '#3d4050',
  ch: ['#4da3ff','#21c354','#faca15','#ff6b6b','#a78bfa','#f97316','#06b6d4','#ec4899','#84cc16','#8b5cf6','#14b8a6','#f43f5e'],
};

const fmt = n => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fPct = n => (n * 100).toFixed(1) + '%';
const fN = n => Math.round(n).toLocaleString('es-ES');
const sh = p => (p||'').replace(/Comercial (de ediciones |Grupo )/g,'').replace(/ S\.A\.U?\./g,'').replace(/ SL$/,'').replace(/ S\.L\.U?\./g,'').replace(/Ediciones /,'').replace(/Editorial /,'').replace(/Distribuc?ion de Libros/,'Dist. Libros').replace('MacMillan Iberia','MacMillan').replace(/Santillana Educaci.n/,'Santillana').replace(/Burlington Books Espa.a/,'Burlington').replace(/Don Bosco-Grup Edeb./,'Edebé').replace('Editoria Editex','Editex');

function parseInput(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [], isbnRe = /97[89]\d{10}/g;
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

async function apiCall(action, params = {}) {
  const url = new URL(API);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  const r = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── SHARED STYLES ──
const S = {
  card: { background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` },
  input: { padding: '10px 14px', borderRadius: 8, border: `1px solid ${T.inputBorder}`, background: T.input, color: T.text, fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none' },
  btn: { padding: '10px 22px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btn2: { padding: '10px 22px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  btnSm: { padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, cursor: 'pointer', fontSize: 12 },
  metric: (color, accent) => ({
    background: accent ? `linear-gradient(135deg, ${color}18, ${color}08)` : T.card,
    borderRadius: 12, padding: '16px 18px',
    border: accent ? `1px solid ${color}33` : `1px solid ${T.border}`,
  }),
};

// ── KPI CARD ──
function Kpi({ icon, label, value, sub, color = T.blue, accent }) {
  return (
    <div style={S.metric(color, accent)}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4, letterSpacing: 0.5 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? color : T.text, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── TAB BUTTON ──
function Tab({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', borderRadius: 8, border: 'none',
      background: active ? T.accent : 'transparent', color: active ? '#fff' : T.textMuted,
      cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500, transition: 'all .15s',
    }}>{children}</button>
  );
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

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('id'), modo = p.get('modo');
    if (id) {
      setLoading(true); setStep(1);
      apiCall('cargar', { id, modo: modo || 'colegio' })
        .then(res => {
          if (res.error) { setError(res.error); setStep(0); return; }
          setNombre(res.nombre || '');
          setData(res.datos);
          setEditableData(res.datos);
          setCostePapel(res.costeOp || 12);
          setCosteDigital(res.costeOpDigital || 10);
          const dtos = {};
          (res.datos?.proveedores || []).forEach(p => {
            dtos[p.proveedor] = { scho: p.dtoScho || 0, col: p.dtoColegio || p.dtoScho || 0 };
          });
          if (res.condiciones) Object.assign(dtos, res.condiciones);
          setColDtos(dtos);
          setViewMode(modo === 'colegio' ? 'colegio' : 'comercial');
          setStep(modo === 'colegio' ? 3 : 2);
        })
        .catch(e => { setError(e.message); setStep(0); })
        .finally(() => setLoading(false));
    }
  }, []);

  const handleCruzar = useCallback(async () => {
    const entries = parseInput(inputText);
    if (!entries.length) { setError('No se detectaron ISBNs válidos'); return; }
    setLoading(true); setError(''); setStep(1);
    try {
      const isbnStr = entries.map(e => `${e.isbn}:${e.alumnos}`).join(',');
      const r = await apiCall('cruzar', { isbns: isbnStr });
      if (r.error) throw new Error(r.error);
      setData(r);
      setEditableData(r);
      const dtos = {};
      (r.proveedores || []).forEach(p => { dtos[p.proveedor] = { scho: p.dtoScho, col: p.dtoColegio }; });
      setColDtos(dtos);
      setStep(2); setTab('resumen');
    } catch (e) { setError('Error: ' + e.message); setStep(0); }
    finally { setLoading(false); }
  }, [inputText]);

  const handleGuardar = useCallback(async () => {
    if (!editableData) return; setSaving(true);
    try {
      const saveData = { nombre: nombre || 'Sin nombre', costeOp: costePapel, costeOpDigital: costeDigital, condiciones: colDtos, datos: editableData };
      const r = await apiCall('guardar', { data: saveData });
      if (r.error) throw new Error(r.error);
      const base = window.location.origin + window.location.pathname;
      setShareUrl(`${base}?id=${r.id}&modo=colegio`);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, colDtos]);

  // ── Update alumnos for a specific book ──
  const updateAlumnos = useCallback((isbn, newAlumnos) => {
    setEditableData(prev => {
      if (!prev?.found) return prev;
      return {
        ...prev,
        found: prev.found.map(b => b.isbn === isbn ? { ...b, alumnos: newAlumnos } : b),
      };
    });
  }, []);

  const handleFile = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setInputText(ev.target.result); r.readAsText(f);
  }, []);

  // ── CALC ENGINE (uses editableData for alumnos, coste from backend) ──
  const calc = useMemo(() => {
    if (!editableData?.found) return null;
    const rows = editableData.found.map(book => {
      const prov = book.proveedor;
      const dtoScho = book.dto || 0;
      const d = colDtos[prov];
      const dtoCol = d ? d.col : dtoScho;
      // FIXED: use book.coste directly from backend (Precio Compra Sin Iva)
      // Only fallback to calculation if coste is missing
      const coste = book.coste || book.pvp * (1 - dtoScho / 100);
      const dif = dtoCol > dtoScho ? (dtoCol - dtoScho) / (100 - dtoScho) : 0;
      const costeCol = coste * (1 - dif);
      const isPapel = (book.formato || 'Papel').toLowerCase().includes('papel');
      const opPct = isPapel ? costePapel / 100 : costeDigital / 100;
      const tv = (book.alumnos || 0) * book.pvp;
      const tcs = (book.alumnos || 0) * coste;
      const tcc = (book.alumnos || 0) * costeCol;
      const costOp = tv * opPct;
      return { ...book, dtoScho, dtoCol, dif, coste, costeCol, isPapel, opPct, tv, tcs, tcc, costOp };
    });

    const bp = {};
    rows.forEach(r => {
      const k = r.proveedor || 'Sin proveedor';
      if (!bp[k]) bp[k] = { p: k, n: 0, tv: 0, tcs: 0, tcc: 0, costOp: 0 };
      bp[k].n++; bp[k].tv += r.tv; bp[k].tcs += r.tcs; bp[k].tcc += r.tcc; bp[k].costOp += r.costOp;
    });
    const prov = Object.values(bp).map(p => ({
      ...p, m: p.tv - p.tcs, rap: p.tcs - p.tcc, ben: p.tv - p.tcc,
      comision: p.tv - p.tcs - p.costOp,
    })).sort((a, b) => b.tv - a.tv);

    const tv = rows.reduce((s, r) => s + r.tv, 0);
    const tcs = rows.reduce((s, r) => s + r.tcs, 0);
    const tcc = rows.reduce((s, r) => s + r.tcc, 0);
    const totalCostOp = rows.reduce((s, r) => s + r.costOp, 0);
    const comision = tv - tcs - totalCostOp;
    const rap = tcs - tcc;
    const nPapel = rows.filter(r => r.isPapel).length;
    return { rows, prov, tv, tcs, totalCostOp, comision, rap, benColegio: comision + rap, t: rows.length, nPapel, nDigital: rows.length - nPapel };
  }, [editableData, colDtos, costePapel, costeDigital]);

  const hasRappel = calc && calc.rap > 0.01;
  const isC = viewMode === 'comercial';
  const chartData = calc?.prov.map((p, i) => ({ name: sh(p.p), Venta: Math.round(p.tv), fill: T.ch[i % T.ch.length] })) || [];
  const pieData = calc?.prov.map((p, i) => ({ name: sh(p.p), value: Math.round(p.tv), fill: T.ch[i % T.ch.length] })) || [];
  const filtered = calc?.rows.filter(r => !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.isbn?.includes(search) || r.proveedor?.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div style={{ fontFamily: "'Outfit','DM Sans',system-ui,sans-serif", background: T.bg, minHeight: '100vh', color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: '14px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📚</span>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>Scholarum</span>
              {nombre && <span style={{ color: T.textMuted, fontWeight: 400, marginLeft: 8 }}>/ {nombre}</span>}
            </div>
          </div>
          {step >= 2 && step !== 3 && (
            <div style={{ display: 'flex', gap: 4, background: T.surface, borderRadius: 8, padding: 3 }}>
              {['comercial', 'colegio'].map(v => (
                <button key={v} onClick={() => setViewMode(v)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none',
                  background: viewMode === v ? T.card : 'transparent',
                  color: viewMode === v ? T.text : T.textMuted,
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                }}>{v === 'comercial' ? '🔧 Comercial' : '🏫 Colegio'}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 60px' }}>

        {/* ═══ INPUT ═══ */}
        {step === 0 && (
          <div style={{ maxWidth: 900, margin: '40px auto 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', letterSpacing: -1 }}>Simulacro de Tienda Escolar</h1>
              <p style={{ color: T.textMuted, fontSize: 15, margin: 0 }}>Pega los datos del colegio y genera un simulacro de beneficio en segundos</p>
            </div>

            <div style={S.card}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Nombre del colegio</label>
                <input type="text" placeholder="Ej: Obispo Perelló" value={nombre} onChange={e => setNombre(e.target.value)}
                  style={{ ...S.input, maxWidth: 400 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
                <div>
                  <label style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>ISBNs + Alumnos</label>
                  <textarea value={inputText} onChange={e => setInputText(e.target.value)}
                    placeholder={"Pega en cualquier formato:\n\n9788411826617  LENGUA 1EP  48\n9788411826648\t46\n978-8469-894590;27"}
                    style={{ ...S.input, height: 200, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, resize: 'vertical' }} />
                  {inputText.trim() && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 13 }}>
                      <span style={{ color: T.blue, fontWeight: 600 }}>{parseInput(inputText).length} ISBNs</span>
                      <span style={{ color: T.textDim }}>{parseInput(inputText).filter(e => e.alumnos > 0).length} con alumnos</span>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>O sube archivo</label>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: 10, padding: '40px 16px', textAlign: 'center', background: T.surface }}>
                    <input type="file" ref={fileRef} accept=".csv,.txt,.tsv" onChange={handleFile} style={{ display: 'none' }} />
                    <button onClick={() => fileRef.current?.click()} style={S.btn2}>📄 Seleccionar archivo</button>
                    <p style={{ margin: '8px 0 0', color: T.textDim, fontSize: 11 }}>CSV, TXT o TSV</p>
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 12px', background: T.blueSoft, borderRadius: 8, fontSize: 11, color: T.blue, border: `1px solid ${T.blue}22` }}>
                    <strong>Parser inteligente:</strong> detecta ISBNs (978/979) y números de alumnos automáticamente. Ignora títulos y texto extra.
                  </div>
                </div>
              </div>

              {error && <div style={{ marginTop: 14, padding: '10px 14px', background: T.accentSoft, borderRadius: 8, color: T.accent, fontSize: 13, border: `1px solid ${T.accent}33` }}>⚠️ {error}</div>}

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleCruzar} disabled={!inputText.trim() || loading}
                  style={{ ...S.btn, opacity: inputText.trim() ? 1 : .3, fontSize: 15, padding: '12px 32px' }}>
                  Generar simulacro →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ LOADING ═══ */}
        {step === 1 && (
          <div style={{ ...S.card, textAlign: 'center', padding: '80px 20px', maxWidth: 500, margin: '60px auto' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📚</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Cruzando con el catálogo</div>
            <div style={{ color: T.textMuted, fontSize: 14 }}>Buscando en tu Master DB... 10-15 segundos</div>
            <div style={{ marginTop: 20, height: 3, background: T.surface, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: T.accent, borderRadius: 2, animation: 'loading 1.5s ease-in-out infinite', width: '40%' }} />
            </div>
            <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
          </div>
        )}

        {/* ═══ SIMULACRO ═══ */}
        {(step === 2 || step === 3) && calc && (<>

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 2, background: T.surface, borderRadius: 8, padding: 3 }}>
              {['resumen', ...(isC ? ['editoriales'] : ['descuentos']), 'detalle', ...(data?.notFound?.length > 0 ? ['no encontrados'] : []), ...(!isC ? ['beneficios'] : [])].map(t => (
                <Tab key={t} active={tab === t} onClick={() => setTab(t)}>{t}</Tab>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {isC && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.surface, padding: '5px 12px', borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>📄</span>
                  <input type="number" value={costePapel} onChange={e => setCostePapel(Math.max(0, Math.min(50, +e.target.value || 0)))}
                    style={{ width: 36, padding: '3px', borderRadius: 4, border: `1px solid ${T.inputBorder}`, background: T.input, color: T.text, textAlign: 'center', fontSize: 12, fontWeight: 700 }} />
                  <span style={{ fontSize: 11, color: T.textDim }}>%</span>
                  <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>💻</span>
                  <input type="number" value={costeDigital} onChange={e => setCosteDigital(Math.max(0, Math.min(50, +e.target.value || 0)))}
                    style={{ width: 36, padding: '3px', borderRadius: 4, border: `1px solid ${T.inputBorder}`, background: T.input, color: T.text, textAlign: 'center', fontSize: 12, fontWeight: 700 }} />
                  <span style={{ fontSize: 11, color: T.textDim }}>%</span>
                </div>
              )}
              {isC && (
                <button onClick={handleGuardar} disabled={saving} style={{ ...S.btnSm, background: T.green + '18', color: T.green, borderColor: T.green + '33' }}>
                  {saving ? '...' : '💾 Guardar y compartir'}
                </button>
              )}
              {step === 2 && <button onClick={() => { setStep(0); setData(null); setEditableData(null); setError(''); setShareUrl(''); }} style={S.btnSm}>← Nuevo</button>}
            </div>
          </div>

          {shareUrl && isC && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: T.greenSoft, borderRadius: 8, border: `1px solid ${T.green}33`, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: T.green }}>🔗 URL colegio:</span>
              <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', color: T.textMuted }}>{shareUrl}</code>
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ ...S.btnSm, color: T.green, borderColor: T.green + '33' }}>Copiar</button>
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isC ? '160' : '220'}px, 1fr))`, gap: 10, marginBottom: 18 }}>
            <Kpi icon="💰" label="FACTURACIÓN" value={fmt(calc.tv)} sub={`${calc.t} títulos (${calc.nPapel}📄 ${calc.nDigital}💻)`} color={T.blue} />
            {isC && <Kpi icon="📈" label="COMISIÓN SCH" value={fmt(calc.comision)} sub={fPct(calc.comision / calc.tv) + ' s/venta'} color={T.green} />}
            {isC && <Kpi icon="🏪" label="COSTE OPERATIVO" value={fmt(calc.totalCostOp)} sub={`📄${costePapel}% 💻${costeDigital}%`} color={T.gold} />}
            {hasRappel && <Kpi icon="🎁" label="RAPPEL COLEGIO" value={fmt(calc.rap)} sub="Mejor dto. editorial" color={T.coral} />}
            <Kpi icon="🏫" label="BENEFICIO COLEGIO" value={fmt(calc.benColegio)} sub={hasRappel ? 'Comisión + Rappel' : 'Comisión tienda'} color={T.teal} accent />
          </div>

          {/* ── RESUMEN ── */}
          {tab === 'resumen' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={S.card}>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Facturación por Proveedor</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, calc.prov.length * 28 + 30)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 14 }}>
                    <XAxis type="number" tickFormatter={v => (v / 1000).toFixed(0) + 'k'} style={{ fontSize: 10 }} stroke={T.textDim} />
                    <YAxis type="category" dataKey="name" width={95} style={{ fontSize: 9 }} tick={{ fill: T.textMuted }} stroke={T.textDim} />
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, color: T.text }} />
                    <Bar dataKey="Venta" radius={[0, 4, 4, 0]} barSize={14}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={S.card}>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, color: T.textMuted, fontWeight: 600 }}>Distribución</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, calc.prov.length * 28 + 30)}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={38}
                      label={({ name, percent }) => percent > .05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false}
                      style={{ fontSize: 9 }}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, color: T.text }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...S.card, gridColumn: '1/-1', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: `2px solid ${T.border}` }}>
                    {['Proveedor', 'Títulos', 'Total Venta', ...(isC ? ['Coste SCH', 'Coste Op.'] : []), 'Margen', ...(hasRappel ? ['Rappel'] : []), 'Beneficio Col.'].map(h => (
                      <th key={h} style={{ padding: '10px 10px', textAlign: h === 'Proveedor' ? 'left' : 'right', fontWeight: 600, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {calc.prov.map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}22` }}>
                        <td style={{ padding: '9px 10px', fontWeight: 500 }}>{sh(p.p)}</td>
                        <td style={{ textAlign: 'right', padding: '9px 10px', color: T.textMuted }}>{p.n}</td>
                        <td style={{ textAlign: 'right', padding: '9px 10px' }}>{fmt(p.tv)}</td>
                        {isC && <td style={{ textAlign: 'right', padding: '9px 10px', color: T.textMuted }}>{fmt(p.tcs)}</td>}
                        {isC && <td style={{ textAlign: 'right', padding: '9px 10px', color: T.textDim }}>{fmt(p.costOp)}</td>}
                        <td style={{ textAlign: 'right', padding: '9px 10px', color: T.green, fontWeight: 600 }}>{fmt(isC ? p.comision : p.m)}</td>
                        {hasRappel && <td style={{ textAlign: 'right', padding: '9px 10px', color: T.coral }}>{fmt(p.rap)}</td>}
                        <td style={{ textAlign: 'right', padding: '9px 10px', color: T.teal, fontWeight: 700 }}>{fmt(isC ? p.comision + p.rap : p.ben)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${T.border}` }}>
                      <td style={{ padding: '10px', fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', padding: '10px', fontWeight: 700 }}>{calc.t}</td>
                      <td style={{ textAlign: 'right', padding: '10px', fontWeight: 700 }}>{fmt(calc.tv)}</td>
                      {isC && <td style={{ textAlign: 'right', padding: '10px', fontWeight: 700, color: T.textMuted }}>{fmt(calc.tcs)}</td>}
                      {isC && <td style={{ textAlign: 'right', padding: '10px', fontWeight: 700, color: T.textDim }}>{fmt(calc.totalCostOp)}</td>}
                      <td style={{ textAlign: 'right', padding: '10px', fontWeight: 700, color: T.green }}>{fmt(isC ? calc.comision : calc.tv - calc.tcs)}</td>
                      {hasRappel && <td style={{ textAlign: 'right', padding: '10px', fontWeight: 700, color: T.coral }}>{fmt(calc.rap)}</td>}
                      <td style={{ textAlign: 'right', padding: '10px', fontWeight: 700, color: T.teal }}>{fmt(calc.benColegio)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── EDITORIALES / DESCUENTOS ── */}
          {(tab === 'editoriales' || tab === 'descuentos') && (
            <div style={S.card}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{isC ? 'Condiciones por Proveedor' : 'Descuentos del Centro'}</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: T.textMuted }}>
                {isC ? 'Ajusta el descuento del colegio según lo negociado.' : 'Modifica tu descuento por proveedor para ver el impacto en tiempo real.'}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `2px solid ${T.border}` }}>
                  {['Proveedor', ...(isC ? ['DTO. SCH'] : []), 'DTO. Colegio', 'Diferencia', 'Rappel est.'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {Object.keys(colDtos).sort().map((prov, i) => {
                    const d = colDtos[prov]; if (!d) return null;
                    const dif = d.col > d.scho ? (d.col - d.scho) / (100 - d.scho) : 0;
                    const pc = calc.prov.find(p => p.p === prov);
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}22` }}>
                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>{sh(prov)}</td>
                        {isC && <td style={{ textAlign: 'center', padding: '8px' }}>
                          <span style={{ padding: '3px 10px', background: T.surface, borderRadius: 5, fontSize: 12, color: T.textMuted }}>{(d.scho || 0).toFixed(0)}%</span>
                        </td>}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <input type="number" value={(d.col || 0).toFixed(0)} min={0} max={80} step={1}
                            onChange={e => { const v = parseFloat(e.target.value); if (isNaN(v)) return; setColDtos(prev => ({ ...prev, [prov]: { ...prev[prov], col: Math.min(80, Math.max(0, v)) } })); }}
                            style={{ width: 52, padding: '5px', borderRadius: 6, textAlign: 'center', fontSize: 14, fontWeight: 700,
                              border: `2px solid ${dif > 0 ? T.coral + '66' : T.inputBorder}`,
                              color: dif > 0 ? T.coral : T.text, background: dif > 0 ? T.coral + '11' : T.input }} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '9px', color: dif > 0 ? T.coral : T.green, fontWeight: 600 }}>{fPct(dif)}</td>
                        <td style={{ textAlign: 'center', padding: '9px', fontWeight: 600, color: (pc?.rap || 0) > 0.01 ? T.coral : T.green }}>{fmt(pc?.rap || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hasRappel && <div style={{ marginTop: 14, padding: '10px 14px', background: T.goldSoft, borderRadius: 8, border: `1px solid ${T.gold}33`, fontSize: 13, color: T.gold }}>
                <strong>Rappel activo:</strong> Total {fmt(calc.rap)} devuelto al colegio.</div>}
            </div>
          )}

          {/* ── DETALLE (with editable alumnos) ── */}
          {tab === 'detalle' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Detalle — {filtered.length} títulos</h3>
                <input type="text" placeholder="🔍 Buscar ISBN, título o proveedor..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ ...S.input, width: 280, padding: '7px 12px', fontSize: 12 }} />
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 520 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead style={{ position: 'sticky', top: 0, background: T.card }}>
                    <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                      {['ISBN', 'Título', 'Proveedor', ...(isC ? ['Fmt'] : []), 'Alumnos', 'PVP', ...(isC ? ['Coste', 'Dto%'] : []), 'T.Venta', ...(isC ? ['T.Coste'] : [])].map(h => (
                        <th key={h} style={{ padding: '8px 6px', textAlign: ['Título', 'Proveedor'].includes(h) ? 'left' : h === 'Alumnos' ? 'center' : 'right',
                          fontWeight: 600, fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}11` }}>
                        <td style={{ padding: '6px', fontFamily: 'monospace', fontSize: 10, color: T.textMuted }}>{r.isbn}</td>
                        <td style={{ padding: '6px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.titulo}>{r.titulo}</td>
                        <td style={{ padding: '6px', fontSize: 10, color: T.textMuted }}>{sh(r.proveedor)}</td>
                        {isC && <td style={{ padding: '6px', textAlign: 'center', fontSize: 10 }}>{r.isPapel ? '📄' : '💻'}</td>}
                        <td style={{ textAlign: 'center', padding: '4px' }}>
                          <input type="number" value={r.alumnos} min={0} max={999}
                            onChange={e => updateAlumnos(r.isbn, Math.max(0, parseInt(e.target.value) || 0))}
                            style={{ width: 44, padding: '3px', borderRadius: 4, border: `1px solid ${T.inputBorder}`, background: T.input, color: T.blue, textAlign: 'center', fontSize: 12, fontWeight: 700 }} />
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px' }}>{r.pvp?.toFixed(2)}</td>
                        {isC && <>
                          <td style={{ textAlign: 'right', padding: '6px', color: T.textMuted }}>{r.coste?.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '6px', fontSize: 10, color: T.textDim }}>{r.dtoScho?.toFixed(0)}%</td>
                        </>}
                        <td style={{ textAlign: 'right', padding: '6px', fontWeight: 500, color: T.blue }}>{fmt(r.tv)}</td>
                        {isC && <td style={{ textAlign: 'right', padding: '6px', color: T.textMuted }}>{fmt(r.tcs)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── NO ENCONTRADOS ── */}
          {tab === 'no encontrados' && data?.notFound?.length > 0 && (
            <div style={S.card}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: T.coral }}>ISBNs no encontrados — {data.notFound.length}</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: T.textMuted }}>Estos ISBNs no están en tu catálogo. Revísalos manualmente.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.notFound.map((isbn, i) => (
                  <span key={i} style={{ padding: '5px 10px', background: T.accentSoft, borderRadius: 6, fontFamily: 'monospace', fontSize: 11, color: T.coral, border: `1px solid ${T.coral}33` }}>{isbn}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── BENEFICIOS (solo vista colegio) ── */}
          {tab === 'beneficios' && !isC && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={S.card}>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>¿Por qué una Tienda Escolar con Scholarum?</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    { icon: '💰', title: 'Ingresos para el centro', desc: 'Tu colegio recibe una comisión por cada venta realizada a través de la tienda, sin coste ni inversión.' },
                    { icon: '📦', title: 'Gestión completa', desc: 'Nos encargamos de todo: compra a editoriales, logística, almacenaje, distribución y atención al cliente.' },
                    { icon: '👨‍👩‍👧', title: 'Comodidad para las familias', desc: 'Los padres compran todos los libros en un solo lugar, con entrega garantizada antes del inicio del curso.' },
                    { icon: '🎓', title: 'Sin riesgo', desc: 'El colegio no asume ningún riesgo de stock ni inversión. Solo recibe beneficios.' },
                    { icon: '📊', title: 'Transparencia total', desc: 'Informes detallados de ventas, comisiones y liquidaciones accesibles en todo momento.' },
                    { icon: '🤝', title: 'Apoyo al proyecto educativo', desc: 'Los ingresos de la tienda pueden destinarse a actividades extraescolares, material o mejoras del centro.' },
                  ].map((b, i) => (
                    <div key={i} style={{ padding: '18px 20px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{b.title}</div>
                      <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{b.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              {calc && (
                <div style={{ ...S.card, background: `linear-gradient(135deg, ${T.teal}15, ${T.blue}10)`, border: `1px solid ${T.teal}33` }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: T.teal }}>Resumen para {nombre || 'tu centro'}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>Facturación estimada</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: T.text, marginTop: 4 }}>{fmt(calc.tv)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>Beneficio para el centro</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: T.teal, marginTop: 4 }}>{fmt(calc.benColegio)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>Títulos gestionados</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: T.text, marginTop: 4 }}>{calc.t}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
