import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

const API = "https://script.google.com/macros/s/AKfycbx6OQ3C3iYw9bGXtx82hZNlevQOZBp4u1aUuoHkQQeiIZKknKtcCJsAa6fI9Xbr1CJT/exec";
const C = {ink:'#0c1e30',navy:'#122d47',blue:'#1b6b93',teal:'#00897b',gold:'#e5a100',coral:'#d4513d',slate:'#6b7f94',green:'#2a7d3f',light:'#f4f6fa',card:'#fff',muted:'#e9ecf1',ch:['#1b6b93','#00897b','#e5a100','#d4513d','#7b5ea7','#6b7f94','#c2185b','#ef6c00','#26a69a','#5c6bc0','#43a047','#ab47bc']};
const fmt=n=>n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const fPct=n=>(n*100).toFixed(1)+'%';
const fN=n=>Math.round(n).toLocaleString('es-ES');
const sh=p=>(p||'').replace(/Comercial (de ediciones |Grupo )/g,'').replace(/ S\.A\.U?\./g,'').replace(/ SL$/,'').replace(/ S\.L\.U?\./g,'').replace(/Ediciones /,'').replace(/Editorial /,'').replace(/Distribuc?ion de Libros/,'Dist. Libros').replace('MacMillan Iberia','MacMillan').replace(/Santillana Educaci.n/,'Santillana').replace(/Burlington Books Espa.a/,'Burlington').replace(/Don Bosco-Grup Edeb./,'Edebé').replace('Editoria Editex','Editex');

// ── SMART PARSER: extracts ISBN-13 + last number (alumnos) from messy input ──
function parseInput(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  const isbnRe = /97[89]\d{10}/g;

  for (const line of lines) {
    // Find all ISBN-13 in the line
    const isbns = line.match(isbnRe);
    if (!isbns) continue;

    // Find all standalone numbers that could be alumnos (1-999)
    // We strip out the ISBN digits first to avoid matching parts of ISBN
    let cleanLine = line;
    isbns.forEach(i => { cleanLine = cleanLine.replace(i, ' '); });
    const numbers = [];
    const numRe = /\b(\d{1,3})\b/g;
    let m;
    while ((m = numRe.exec(cleanLine)) !== null) {
      const n = parseInt(m[1]);
      if (n > 0 && n < 1000) numbers.push(n);
    }

    // If multiple ISBNs on same line, try to pair them
    // Most common: one ISBN per line with one number
    for (let idx = 0; idx < isbns.length; idx++) {
      const isbn = isbns[idx];
      // Take corresponding number if available, otherwise 0
      const alumnos = idx < numbers.length ? numbers[idx] : (numbers.length === 1 ? numbers[0] : 0);
      // Avoid duplicates
      if (!entries.find(e => e.isbn === isbn)) {
        entries.push({ isbn, alumnos, curso: '' });
      }
    }
  }
  return entries;
}

// ── CORRECCIÓN DE API CALL ──
async function apiCall(action, params = {}) {
  const url = new URL(API);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    // ELIMINADO: encodeURIComponent (URLSearchParams ya lo hace solo)
    url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  
  // Añadimos modo 'cors' explícito
  const r = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
  });
  
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
  const [colDtos, setColDtos] = useState({});
  const [costePapel, setCostePapel] = useState(12);
  const [costeDigital, setCosteDigital] = useState(10);
  const [tab, setTab] = useState('resumen');
  const [viewMode, setViewMode] = useState('comercial');
  const [shareUrl, setShareUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  // Load simulacro from URL params
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('id'), modo = p.get('modo');
    if (id) {
      setLoading(true); setStep(1);
      fetch(`${API}?action=cargar&id=${id}&modo=${modo || 'colegio'}`)
        .then(r => r.json())
        .then(res => {
          if (res.error) { setError(res.error); setStep(0); return; }
          setNombre(res.nombre || '');
          setData(res.datos);
          setCostePapel(res.costeOp || 12);
          setCosteDigital(res.costeOpDigital || 10);
          const dtos = {};
          (res.datos?.proveedores || []).forEach(p => {
            dtos[p.proveedor] = { scho: p.dtoScho || 0, col: p.dtoColegio || p.dtoScho || 0 };
          });
          if (res.condiciones && Object.keys(res.condiciones).length > 0) Object.assign(dtos, res.condiciones);
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
    if (!entries.length) { setError('No se detectaron ISBNs válidos (deben empezar por 978 o 979, 13 dígitos)'); return; }
    setLoading(true); setError(''); setStep(1);
    try {
      // Encode as compact string: "isbn:alumnos,isbn:alumnos,..."
      const isbnStr = entries.map(e => `${e.isbn}:${e.alumnos}`).join(',');
      const r = await apiCall('cruzar', { isbns: isbnStr });
      if (r.error) throw new Error(r.error);
      setData(r);
      const dtos = {};
      (r.proveedores || []).forEach(p => { dtos[p.proveedor] = { scho: p.dtoScho, col: p.dtoColegio }; });
      setColDtos(dtos);
      setStep(2); setTab('resumen');
    } catch (e) { setError('Error de conexión: ' + e.message + '. Verifica que publicaste la nueva versión del Apps Script.'); setStep(0); }
    finally { setLoading(false); }
  }, [inputText]);

  const handleGuardar = useCallback(async () => {
    if (!data) return; setSaving(true);
    try {
      const saveData = {
        nombre: nombre || 'Sin nombre', costeOp: costePapel, costeOpDigital: costeDigital,
        condiciones: colDtos, datos: data,
      };
      const r = await apiCall('guardar', { data: saveData });
      if (r.error) throw new Error(r.error);
      const base = window.location.origin + window.location.pathname;
      const url = `${base}?id=${r.id}&modo=colegio`;
      setShareUrl(url);
      alert(`Guardado!\n\nURL colegio:\n${url}\n\nURL comercial:\n${base}?id=${r.id}&modo=comercial`);
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }, [data, nombre, costePapel, costeDigital, colDtos]);

  const handleFile = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setInputText(ev.target.result);
    r.readAsText(f);
  }, []);

  // ── CALC ENGINE with paper/digital split ──
  const calc = useMemo(() => {
    if (!data?.found) return null;
    const rows = data.found.map(book => {
      const prov = book.proveedor;
      const dtoScho = book.dto || 0;
      const d = colDtos[prov];
      const dtoCol = d ? d.col : dtoScho;
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
    const nDigital = rows.length - nPapel;

    return { rows, prov, tv, tcs, totalCostOp, comision, rap, benColegio: comision + rap, t: rows.length, nPapel, nDigital };
  }, [data, colDtos, costePapel, costeDigital]);

  const hasRappel = calc && calc.rap > 0.01;
  const isC = viewMode === 'comercial';
  const chartData = calc?.prov.map((p, i) => ({ name: sh(p.p), Venta: Math.round(p.tv), fill: C.ch[i % C.ch.length] })) || [];
  const pieData = calc?.prov.map((p, i) => ({ name: sh(p.p), value: Math.round(p.tv), fill: C.ch[i % C.ch.length] })) || [];
  const filtered = calc?.rows.filter(r => !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.isbn?.includes(search) || r.proveedor?.toLowerCase().includes(search.toLowerCase())) || [];

  const sty = {
    btn: { padding: '10px 24px', borderRadius: 8, border: 'none', background: C.blue, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
    btn2: { padding: '10px 24px', borderRadius: 8, border: `2px solid ${C.blue}`, background: 'transparent', color: C.blue, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
    input: { padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${C.muted}`, fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none' },
    card: { background: C.card, borderRadius: 14, padding: 22, border: `1px solid ${C.muted}` },
  };

  return (
    <div style={{ fontFamily: "'Outfit','DM Sans',sans-serif", background: C.light, minHeight: '100vh', color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg,${C.ink} 0%,${C.navy} 60%,${C.blue} 100%)`, padding: '22px 28px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, maxWidth: 1200, margin: '0 auto' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', opacity: .5 }}>Scholarum</div>
            <h1 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700 }}>
              Simulacro Tienda Escolar{nombre && <span style={{ fontWeight: 400, opacity: .7 }}> — {nombre}</span>}
            </h1>
          </div>
          {step >= 2 && step !== 3 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {['comercial', 'colegio'].map(v => (
                <button key={v} onClick={() => setViewMode(v)} style={{
                  padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,.25)',
                  background: viewMode === v ? 'rgba(255,255,255,.18)' : 'transparent',
                  color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === v ? 700 : 400,
                }}>{v === 'comercial' ? '🔧 Comercial' : '🏫 Colegio'}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px' }}>

        {/* ═══ INPUT ═══ */}
        {step === 0 && (
          <div style={sty.card}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Nuevo simulacro</h2>
            <p style={{ margin: '0 0 18px', color: C.slate, fontSize: 13 }}>Pega los datos del colegio. El sistema detecta automáticamente los ISBNs y los alumnos, ignorando títulos y texto extra.</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Nombre del colegio</label>
              <input type="text" placeholder="Ej: Obispo Perelló" value={nombre} onChange={e => setNombre(e.target.value)} style={{ ...sty.input, maxWidth: 400 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>Pega ISBNs + Alumnos</label>
                <textarea value={inputText} onChange={e => setInputText(e.target.value)}
                  placeholder={"Pega cualquier formato. Ejemplos que funcionan:\n\n9788411826617\t48\n9788411826617  LENGUA 1EP  48\n9788411826617;LEAD THE WAY 3 Pb;19\nISBN: 978-8411-826617 - Alumnos: 48"}
                  style={{ ...sty.input, height: 220, fontFamily: 'monospace', fontSize: 11.5, resize: 'vertical' }} />
                {inputText.trim() && (
                  <div style={{ marginTop: 8, fontSize: 13, color: C.blue, fontWeight: 500 }}>
                    {parseInput(inputText).length} ISBNs detectados
                    {parseInput(inputText).length > 0 && (
                      <span style={{ color: C.slate, fontWeight: 400 }}>
                        {' '}— {parseInput(inputText).filter(e => e.alumnos > 0).length} con alumnos
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 5 }}>O sube un archivo</label>
                <div style={{ border: `2px dashed ${C.muted}`, borderRadius: 10, padding: '45px 20px', textAlign: 'center', background: '#f9fafb' }}>
                  <input type="file" ref={fileRef} accept=".csv,.txt,.tsv" onChange={handleFile} style={{ display: 'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={{ ...sty.btn2, fontSize: 13 }}>📄 Seleccionar CSV / TXT</button>
                  <p style={{ margin: '10px 0 0', color: C.slate, fontSize: 12 }}>Cualquier formato con ISBNs de 13 dígitos</p>
                </div>
                <div style={{ marginTop: 14, padding: '12px 14px', background: '#f0f7ff', borderRadius: 8, fontSize: 12, color: C.navy, lineHeight: 1.5 }}>
                  <strong>Parser inteligente:</strong> detecta ISBNs (978/979 + 10 dígitos) y el número de alumnos. Ignora automáticamente títulos, nombres de editoriales y cualquier texto extra.
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f0', borderRadius: 8, color: C.coral, fontSize: 13 }}>⚠️ {error}</div>}
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleCruzar} disabled={!inputText.trim() || loading} style={{ ...sty.btn, opacity: inputText.trim() ? 1 : .4 }}>
                {loading ? 'Procesando...' : 'Generar simulacro →'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ LOADING ═══ */}
        {step === 1 && (
          <div style={{ ...sty.card, textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.navy }}>Cruzando con el catálogo...</div>
            <div style={{ fontSize: 13, color: C.slate, marginTop: 6 }}>Buscando en tu Master DB. 10-15 segundos.</div>
          </div>
        )}

        {/* ═══ SIMULACRO ═══ */}
        {(step === 2 || step === 3) && calc && (<>
          {/* Tabs + controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['resumen', ...(isC ? ['editoriales'] : ['descuentos']), 'detalle', ...(data?.notFound?.length > 0 ? ['no encontrados'] : [])].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: tab === t ? C.blue : C.muted, color: tab === t ? '#fff' : C.slate,
                  cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 500, textTransform: 'capitalize',
                }}>{t}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {isC && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0f2f5', padding: '4px 10px', borderRadius: 6 }}>
                  <span style={{ fontSize: 11, color: C.slate }}>📄</span>
                  <input type="number" value={costePapel} onChange={e => setCostePapel(Math.max(0, Math.min(50, +e.target.value || 0)))}
                    min={0} max={50} step={1} style={{ width: 36, padding: '2px 4px', borderRadius: 4, border: `1px solid ${C.muted}`, textAlign: 'center', fontSize: 12, fontWeight: 700 }} />
                  <span style={{ fontSize: 11, color: C.slate }}>%</span>
                  <span style={{ fontSize: 11, color: C.slate, marginLeft: 6 }}>💻</span>
                  <input type="number" value={costeDigital} onChange={e => setCosteDigital(Math.max(0, Math.min(50, +e.target.value || 0)))}
                    min={0} max={50} step={1} style={{ width: 36, padding: '2px 4px', borderRadius: 4, border: `1px solid ${C.muted}`, textAlign: 'center', fontSize: 12, fontWeight: 700 }} />
                  <span style={{ fontSize: 11, color: C.slate }}>%</span>
                </div>
              )}
              {isC && <button onClick={handleGuardar} disabled={saving} style={{ ...sty.btn, padding: '7px 16px', fontSize: 12, background: C.teal }}>
                {saving ? 'Guardando...' : '💾 Guardar y compartir'}</button>}
              {step === 2 && <button onClick={() => { setStep(0); setData(null); setError(''); setShareUrl(''); }} style={{ ...sty.btn2, padding: '7px 14px', fontSize: 12 }}>← Nuevo</button>}
            </div>
          </div>

          {shareUrl && isC && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#e8f5e9', borderRadius: 8, border: '1px solid #a5d6a7', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>🔗 URL colegio:</span>
              <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all' }}>{shareUrl}</code>
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ ...sty.btn, padding: '4px 12px', fontSize: 11 }}>Copiar</button>
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${isC ? '155' : '210'}px,1fr))`, gap: 10, marginBottom: 16 }}>
            {[
              { icon: '💰', l: 'Facturación', v: fmt(calc.tv), s: `${calc.t} títulos (${calc.nPapel}📄 ${calc.nDigital}💻)`, show: true },
              { icon: '📈', l: 'Comisión SCH', v: fmt(calc.comision), s: fPct(calc.comision / calc.tv) + ' s/venta', show: isC },
              { icon: '🏪', l: 'Coste Op.', v: fmt(calc.totalCostOp), s: `📄${costePapel}% 💻${costeDigital}%`, show: isC },
              { icon: '🎁', l: 'Rappel Colegio', v: fmt(calc.rap), s: 'Mejor dto. editorial', show: hasRappel },
              { icon: '🏫', l: 'Beneficio Colegio', v: fmt(calc.benColegio), s: hasRappel ? 'Comisión + Rappel' : 'Comisión tienda', show: true, accent: true },
              { icon: '📚', l: 'Cobertura', v: `${fN(calc.t)}/${fN(calc.t + (data?.notFound?.length || 0))}`, s: fPct(calc.t / (calc.t + (data?.notFound?.length || 0))), show: (data?.notFound?.length || 0) > 0 },
            ].filter(k => k.show).map((k, i) => (
              <div key={i} style={{
                background: k.accent ? `linear-gradient(135deg,${C.teal},${C.blue})` : C.card,
                borderRadius: 12, padding: '14px 16px', border: k.accent ? 'none' : `1px solid ${C.muted}`,
              }}>
                <div style={{ fontSize: 11, color: k.accent ? 'rgba(255,255,255,.7)' : C.slate, marginBottom: 3 }}>{k.icon} {k.l}</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: k.accent ? '#fff' : C.ink }}>{k.v}</div>
                <div style={{ fontSize: 11, color: k.accent ? 'rgba(255,255,255,.5)' : C.slate, marginTop: 2 }}>{k.s}</div>
              </div>
            ))}
          </div>

          {/* RESUMEN */}
          {tab === 'resumen' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={sty.card}>
                <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.slate, fontWeight: 600 }}>Facturación por Proveedor</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, calc.prov.length * 26 + 30)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 14 }}>
                    <XAxis type="number" tickFormatter={v => (v / 1000).toFixed(0) + 'k'} style={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={95} style={{ fontSize: 9 }} tick={{ fill: '#444' }} />
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="Venta" radius={[0, 4, 4, 0]} barSize={13}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={sty.card}>
                <h3 style={{ margin: '0 0 10px', fontSize: 13, color: C.slate, fontWeight: 600 }}>Distribución</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, calc.prov.length * 26 + 30)}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={38}
                      label={({ name, percent }) => percent > .05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false} style={{ fontSize: 9 }}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...sty.card, gridColumn: '1/-1', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: C.ink, color: '#fff' }}>
                    {['Proveedor', 'Títulos', 'Total Venta', ...(isC ? ['Coste SCH', 'Coste Op.'] : []), 'Margen', ...(hasRappel ? ['Rappel'] : []), 'Beneficio Col.'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Proveedor' ? 'left' : 'right', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {calc.prov.map((p, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#f8f9fb' : '#fff', borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 500, fontSize: 12 }}>{sh(p.p)}</td>
                        <td style={{ textAlign: 'right', padding: '7px 10px' }}>{p.n}</td>
                        <td style={{ textAlign: 'right', padding: '7px 10px' }}>{fmt(p.tv)}</td>
                        {isC && <td style={{ textAlign: 'right', padding: '7px 10px' }}>{fmt(p.tcs)}</td>}
                        {isC && <td style={{ textAlign: 'right', padding: '7px 10px', color: C.slate }}>{fmt(p.costOp)}</td>}
                        <td style={{ textAlign: 'right', padding: '7px 10px', color: C.green, fontWeight: 600 }}>{fmt(isC ? p.comision : p.m)}</td>
                        {hasRappel && <td style={{ textAlign: 'right', padding: '7px 10px', color: C.coral }}>{fmt(p.rap)}</td>}
                        <td style={{ textAlign: 'right', padding: '7px 10px', color: C.teal, fontWeight: 700 }}>{fmt(isC ? p.comision + p.rap : p.ben)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: C.ink, color: '#fff', fontWeight: 700, fontSize: 12 }}>
                      <td style={{ padding: '8px 10px' }}>TOTAL</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px' }}>{calc.t}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px' }}>{fmt(calc.tv)}</td>
                      {isC && <td style={{ textAlign: 'right', padding: '8px 10px' }}>{fmt(calc.tcs)}</td>}
                      {isC && <td style={{ textAlign: 'right', padding: '8px 10px' }}>{fmt(calc.totalCostOp)}</td>}
                      <td style={{ textAlign: 'right', padding: '8px 10px' }}>{fmt(isC ? calc.comision : calc.tv - calc.tcs)}</td>
                      {hasRappel && <td style={{ textAlign: 'right', padding: '8px 10px' }}>{fmt(calc.rap)}</td>}
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: C.gold }}>{fmt(calc.benColegio)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EDITORIALES / DESCUENTOS */}
          {(tab === 'editoriales' || tab === 'descuentos') && (
            <div style={sty.card}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{isC ? 'Condiciones por Proveedor' : 'Descuentos del Centro'}</h3>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: C.slate }}>
                {isC ? 'Ajusta el DTO. Colegio según lo negociado por el centro.' : 'Ajusta tu descuento por proveedor para ver el impacto.'}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: C.ink, color: '#fff' }}>
                  {['Proveedor', ...(isC ? ['DTO. SCH'] : []), 'DTO. Colegio (%)', 'Diferencia', 'Rappel est.'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {Object.keys(colDtos).sort().map((prov, i) => {
                    const d = colDtos[prov]; if (!d) return null;
                    const dif = d.col > d.scho ? (d.col - d.scho) / (100 - d.scho) : 0;
                    const pc = calc.prov.find(p => p.p === prov);
                    return (
                      <tr key={i} style={{ background: i % 2 ? '#f8f9fb' : '#fff', borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{sh(prov)}</td>
                        {isC && <td style={{ textAlign: 'center', padding: '7px' }}>
                          <span style={{ padding: '3px 10px', background: '#f0f2f5', borderRadius: 5, fontSize: 12 }}>{(d.scho || 0).toFixed(0)}%</span>
                        </td>}
                        <td style={{ textAlign: 'center', padding: '7px' }}>
                          <input type="number" value={(d.col || 0).toFixed(0)} min={0} max={80} step={1}
                            onChange={e => { const v = parseFloat(e.target.value); if (isNaN(v)) return; setColDtos(prev => ({ ...prev, [prov]: { ...prev[prov], col: Math.min(80, Math.max(0, v)) } })); }}
                            style={{ width: 56, padding: '4px 6px', borderRadius: 7, textAlign: 'center', fontSize: 14, fontWeight: 700, border: `2px solid ${dif > 0 ? C.coral : C.muted}`, color: dif > 0 ? C.coral : C.ink, background: dif > 0 ? '#fef2f0' : '#fff' }} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px', color: dif > 0 ? C.coral : C.green, fontWeight: 600 }}>{fPct(dif)}</td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: 600, color: (pc?.rap || 0) > 0.01 ? C.coral : C.green }}>{fmt(pc?.rap || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hasRappel && <div style={{ marginTop: 14, padding: '10px 14px', background: '#fff8e1', borderRadius: 8, border: '1px solid #ffe082', fontSize: 13 }}>
                <strong style={{ color: '#e65100' }}>Rappel activo:</strong> <span style={{ color: '#bf360c' }}>Total {fmt(calc.rap)} devuelto al colegio.</span></div>}
            </div>
          )}

          {/* DETALLE */}
          {tab === 'detalle' && (
            <div style={sty.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Detalle ({filtered.length} títulos)</h3>
                <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ ...sty.input, width: 240, padding: '6px 12px', fontSize: 12 }} />
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 480 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr style={{ background: C.ink, color: '#fff' }}>
                      {['ISBN', 'Título', 'Proveedor', ...(isC ? ['Fmt'] : []), 'Alum.', 'PVP', ...(isC ? ['Coste', 'Dto%', 'Dif.'] : []), 'T.Venta', ...(isC ? ['T.Coste'] : [])].map(h => (
                        <th key={h} style={{ padding: '6px 5px', textAlign: ['Título', 'Proveedor'].includes(h) ? 'left' : 'right', fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#f8f9fb' : '#fff', borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '5px', fontFamily: 'monospace', fontSize: 10 }}>{r.isbn}</td>
                        <td style={{ padding: '5px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.titulo}>{r.titulo}</td>
                        <td style={{ padding: '5px', fontSize: 10 }}>{sh(r.proveedor)}</td>
                        {isC && <td style={{ padding: '5px', fontSize: 10, textAlign: 'center' }}>{r.isPapel ? '📄' : '💻'}</td>}
                        <td style={{ textAlign: 'right', padding: '5px', fontWeight: 600 }}>{r.alumnos}</td>
                        <td style={{ textAlign: 'right', padding: '5px' }}>{r.pvp?.toFixed(2)}</td>
                        {isC && <>
                          <td style={{ textAlign: 'right', padding: '5px' }}>{r.coste?.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '5px', fontSize: 10 }}>{r.dtoScho?.toFixed(0)}%</td>
                          <td style={{ textAlign: 'right', padding: '5px', color: r.dif > 0 ? C.coral : C.green, fontSize: 10 }}>{fPct(r.dif)}</td>
                        </>}
                        <td style={{ textAlign: 'right', padding: '5px', fontWeight: 500 }}>{fmt(r.tv)}</td>
                        {isC && <td style={{ textAlign: 'right', padding: '5px' }}>{fmt(r.tcs)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NO ENCONTRADOS */}
          {tab === 'no encontrados' && data?.notFound?.length > 0 && (
            <div style={sty.card}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: C.coral }}>ISBNs no encontrados ({data.notFound.length})</h3>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: C.slate }}>Estos ISBNs no están en tu catálogo.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.notFound.map((isbn, i) => (
                  <span key={i} style={{ padding: '5px 10px', background: '#fef2f0', borderRadius: 5, fontFamily: 'monospace', fontSize: 11, color: C.coral, border: '1px solid #f5c6c0' }}>{isbn}</span>
                ))}
              </div>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
