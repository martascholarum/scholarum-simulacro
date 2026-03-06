import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ════════════════════════════════════════════════════════════════════
// 1. 🎨 CONFIGURACIÓN DE TU MARCA (SaaS Moderno)
// ════════════════════════════════════════════════════════════════════
const BRAND = {
  name: "DELIBER",
  companyLogo: "https://www.scholarum.es/wp-content/uploads/footer/logo-deliber.svg", 
  favicon: "https://somosdeliber.com/wp-content/uploads/favicon-1.png",
  primary: "#2563eb",    
  secondary: "#0d9488",  
  accent: "#f59e0b",     
  bg: "#f8fafc",         
  card: "#ffffff"        
};

const COMMERCIAL_PIN = "1234"; 
const API = "https://script.google.com/macros/s/AKfycbx6OQ3C3iYw9bGXtx82hZNlevQOZBp4u1aUuoHkQQeiIZKknKtcCJsAa6fI9Xbr1CJT/exec";
const N8N_WEBHOOK_URL = "https://scholarumdigital.app.n8n.cloud/webhook/0c901ba1-fd9e-4a10-91f0-c5b612249163"; 
const CLARITY_ID = ""; // Opcional: ID de Microsoft Clarity

const C = {
  ink: '#0f172a', navy: '#1e293b', blue: BRAND.primary, teal: BRAND.secondary, 
  gold: BRAND.accent, coral: '#ef4444', slate: '#64748b', green: '#10b981', 
  light: BRAND.bg, card: BRAND.card, muted: '#e2e8f0', 
  ch: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
};

const fmt = n => (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const sh = p => (p || '').replace(/Comercial (de ediciones |Grupo )/g, '').replace(/ S\.A\.U?\./g, '').replace(/ SL$/,'').replace(/ S\.L\.U?\./g,'').replace(/Ediciones /,'').replace(/Editorial /,'');

function setFavicon() {
  document.title = `La Tienda del Cole | Propuestas`;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.href = BRAND.favicon;
}

function injectClarity(id) {
  if (!id || typeof window === 'undefined') return;
  (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];
      if(y && y.parentNode) y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", id);
}

function parseInput(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  const invalid = []; 
  const isbnRe = /97[89]\d{10}/g;
  
  for (const line of lines) {
    const isbns = line.match(isbnRe);
    if (!isbns) {
      if (/\d/.test(line) && line.length > 3 && line.length < 30) invalid.push(line);
      continue;
    }
    
    let cleanLine = line;
    isbns.forEach(i => { cleanLine = cleanLine.replace(i, ' '); });
    const numbers = [];
    const numRe = /\b(\d{1,3})\b/g;
    let m;
    while ((m = numRe.exec(cleanLine)) !== null) if (m[1] > 0 && m[1] < 1000) numbers.push(parseInt(m[1]));
    
    for (let idx = 0; idx < isbns.length; idx++) {
      const isbn = isbns[idx];
      const alumnos = idx < numbers.length ? numbers[idx] : (numbers.length === 1 ? numbers[0] : 0);
      
      let existing = entries.find(e => e.isbn === isbn);
      if (existing) existing.alumnos += alumnos;
      else entries.push({ isbn, alumnos, curso: '' });
    }
  }
  return { entries, invalid };
}

async function apiCall(action, params = {}) {
  if (action === 'guardar') {
    const formData = new URLSearchParams();
    formData.append('action', 'guardar');
    formData.append('data', JSON.stringify(params.data));
    if (params.id) formData.append('id', params.id); 
    if (params.baseUrl) formData.append('baseUrl', params.baseUrl); 
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

function generatePIN() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 6; i++) pin += chars.charAt(Math.floor(Math.random() * chars.length));
  return pin;
}

function refreshDtosReal(foundArray, currentDtos) {
  const dtos = {};
  foundArray.forEach(b => {
    const prov = b.proveedor || 'Sin proveedor';
    if (!dtos[prov]) dtos[prov] = { sum: 0, count: 0 };
    dtos[prov].sum += (parseFloat(b.dto) || 0);
    dtos[prov].count += 1;
  });
  const finalDtos = { ...currentDtos };
  Object.keys(dtos).forEach(prov => {
    const avg = Math.round(dtos[prov].sum / dtos[prov].count);
    if (!finalDtos[prov]) finalDtos[prov] = { scho: avg, col: avg };
    else finalDtos[prov].scho = avg; 
  });
  return finalDtos;
}

export default function App() {
  const [step, setStep] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('id')) ? 1 : 98); 
  const [currentId, setCurrentId] = useState(''); 
  
  const [loadingMsg, setLoadingMsg] = useState('Verificando acceso seguro...');
  const [loadingSubMsg, setLoadingSubMsg] = useState('Por favor, espera unos segundos.');
  
  const [nombre, setNombre] = useState('');
  const [responsable, setResponsable] = useState('');
  const [comercialName, setComercialName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [comentarios, setComentarios] = useState(''); 
  
  const [pin, setPin] = useState(''); 
  const [pinInput, setPinInput] = useState(''); 
  const [isAuthenticated, setIsAuthenticated] = useState(false); 
  
  const [inputText, setInputText] = useState('');
  const [invalidCodes, setInvalidCodes] = useState([]); 
  
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
  const [commercialUrl, setCommercialUrl] = useState(''); 
  const [saving, setSaving] = useState(false);
  
  const [search, setSearch] = useState('');
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualAlumnos, setManualAlumnos] = useState('');
  const [isManualLoading, setIsManualLoading] = useState(false); 
  
  const [webhookSentNotFound, setWebhookSentNotFound] = useState(false); 
  
  const [showMissing, setShowMissing] = useState(false); 
  const [showInvalid, setShowInvalid] = useState(false); 
  const fileRef = useRef(null);

  const isC = viewMode === 'comercial';
  const notFoundList = editableData?.meta?.notFound || data?.notFound || []; 
  const invalidList = editableData?.meta?.invalidCodes || invalidCodes || [];

  useEffect(() => { 
    setFavicon(); 
    injectClarity(CLARITY_ID); 
  }, []);
  
  useEffect(() => { if (isC && tab === 'propuesta') setTab('resumen'); }, [isC, tab]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('id'), ref = p.get('ref'); 
    
    if (id) {
      setCurrentId(id);
      setLoadingMsg('Desempaquetando propuesta...');
      setLoadingSubMsg('No me he quedado tostao, estoy pensando 🧠');
      
      apiCall('cargar', { id })
        .then(res => {
          if (res.error) throw new Error(res.error);
          setNombre(res.nombre || '');
          setData(res.datos); setEditableData(res.datos);
          setCostePapel(parseFloat(res.costeOp) || 12); 
          setCosteDigital(parseFloat(res.costeOpDigital) || 10);
          setProbabilidad(parseFloat(res.prob) || 100);
          setColDtos(res.condiciones || {});
          
          const meta = res.datos?.meta || {};
          setLogoUrl(meta.logoUrl || '');
          setResponsable(meta.responsable || '');
          setComercialName(meta.comercialName || '');
          setComentarios(meta.comentarios || '');
          setInvalidCodes(meta.invalidCodes || []);
          if(meta.pin) setPin(meta.pin);
          
          const isClient = ref !== 'admin';
          setViewMode(isClient ? 'colegio' : 'comercial');
          setTab(isClient ? 'propuesta' : 'resumen'); 
          
          if (isClient) {
            if (meta.pin) setStep(99); 
            else { setIsAuthenticated(true); setStep(3); }
          } else {
            setStep(98); 
          }
        })
        .catch(e => { setError(e.message); setStep(0); });
    }
  }, []);

  const handleLogin = () => {
    if (step === 98) {
      if (pinInput === COMMERCIAL_PIN) {
        setIsAuthenticated(true);
        setStep(viewMode === 'colegio' ? 3 : (data ? 2 : 0));
        setPinInput('');
      } else alert("PIN Comercial incorrecto.");
    } else if (step === 99) {
      if (pinInput.toUpperCase() === pin.toUpperCase()) {
        setIsAuthenticated(true);
        setStep(3);
        setPinInput('');
      } else alert("Contraseña incorrecta. Contacta con tu asesor.");
    }
  };

  const handleCruzar = useCallback(async () => {
    const parsed = parseInput(inputText);
    if (!parsed.entries.length) { setError('No se detectaron ISBNs válidos (13 dígitos).'); return; }
    
    setInvalidCodes(parsed.invalid); 

    const newPin = pin || generatePIN();
    if(!pin) setPin(newPin);

    setLoadingMsg('Marta Caballero está haciendo su magia... ✨');
    setLoadingSubMsg('Cruzando libros con el catálogo maestro');
    setLoading(true); setError(''); setStep(1);
    try {
      const isbnStr = parsed.entries.map(e => `${e.isbn}:${e.alumnos}`).join(',');
      const r = await apiCall('cruzar', { isbns: isbnStr });
      if (r.error) throw new Error(r.error);
      
      const datosCompletos = { ...r, meta: { notFound: r.notFound, invalidCodes: parsed.invalid } };
      setData(datosCompletos); setEditableData(datosCompletos);
      
      setColDtos(refreshDtosReal(r.found, {})); 
      setStep(2); setTab('resumen');

    } catch (e) { setError(e.message); setStep(0); }
    finally { setLoading(false); }
  }, [inputText, pin]);

  const handleAddManualIsbn = async () => {
    if (!manualIsbn.trim()) return;
    const cleanIsbn = manualIsbn.replace(/[^0-9]/g, '');
    if (cleanIsbn.length !== 13) { alert('El ISBN debe tener 13 dígitos numéricos.'); return; }

    if (editableData?.found?.some(b => b.isbn === cleanIsbn)) {
      alert('❌ Libro duplicado: Este ISBN ya está incluido en la propuesta.');
      return;
    }

    setIsManualLoading(true);
    try {
      const isbnsParam = `${cleanIsbn}:${parseInt(manualAlumnos) || 0}`;
      const r = await apiCall('cruzar', { isbns: isbnsParam });
      if (r.error) throw new Error(r.error);

      setEditableData(prev => {
        const newFound = [...prev.found, ...(r.found || [])];
        const newNotFound = [...(prev.meta?.notFound || []), ...(r.notFound || [])];
        setColDtos(currentDtos => refreshDtosReal(newFound, currentDtos));
        return { ...prev, found: newFound, meta: { ...prev.meta, notFound: newNotFound } };
      });
      setManualIsbn(''); setManualAlumnos('');
      if(r.found.length) alert('¡Libro añadido con éxito!');
      else alert('⚠️ ISBN no encontrado en el Master DB.');
    } catch (e) { alert('Error: ' + e.message); }
    finally { setIsManualLoading(false); }
  };

  const handleGuardar = useCallback(async () => {
    if (!editableData) return; setSaving(true);
    
    // CHIVATO PARA DEBUGGEAR LA ACTUALIZACIÓN
    console.log("Intentando guardar. ID actual:", currentId);
    
    try {
      const datosSeguros = { ...editableData, meta: { logoUrl, responsable, comercialName, comentarios, pin, notFound: notFoundList, invalidCodes: invalidList } };
      const saveData = { nombre, costeOp: costePapel, costeOpDigital: costeDigital, prob: probabilidad, condiciones: colDtos, datos: datosSeguros };
      const baseUrl = `${window.location.origin}${window.location.pathname}`;

      // AQUÍ LE ESTAMOS PASANDO EL currentId A GOOGLE
      const r = await apiCall('guardar', { data: saveData, id: currentId, baseUrl });
      
      console.log("Respuesta de Google:", r);
      if (r.error) throw new Error(r.error);
      
      setCurrentId(r.id); 
      setShareUrl(`${baseUrl}?id=${r.id}&ref=client`); 
      setCommercialUrl(`${baseUrl}?id=${r.id}&ref=admin`); 
    } catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, probabilidad, colDtos, logoUrl, responsable, comercialName, comentarios, pin, notFoundList, invalidList, currentId]);

  // ── FIX: N8N AHORA RECIBE UN ARRAY DE OBJETOS PARA DIVIDIRLOS ──
  const handleSendWebhookNotFound = async () => {
    if(!N8N_WEBHOOK_URL) return;
    try {
      // Creamos un array (lista) de JSONs. n8n detecta esto y lo divide en iteraciones automáticas.
      const payloadArray = notFoundList.map(isbn => ({
        tipo: 'ISBN_FALTANTE',
        colegio: nombre,
        comercial: comercialName || 'No especificado',
        fecha: new Date().toISOString(),
        isbnFaltante: isbn
      }));

      await fetch(N8N_WEBHOOK_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payloadArray) 
      });
      
      setWebhookSentNotFound(true);
    } catch (e) { alert("Hubo un error al enviar a n8n."); }
  };

  const updateAlumnos = useCallback((isbn, val) => {
    setEditableData(prev => ({ ...prev, found: prev.found.map(b => b.isbn === isbn ? { ...b, alumnos: parseInt(val) || 0 } : b) }));
  }, []);

  const handleFile = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setInputText(ev.target.result); r.readAsText(f);
  }, []);

  const calc = useMemo(() => {
    if (!editableData?.found) return null;
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
      const opPct = (isPapel ? (parseFloat(costePapel) || 0) : (parseFloat(costeDigital) || 0)) / 100;
      
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
    const prov = Object.values(bp).map(p => ({ ...p, m: p.tv - p.tcs, ben: (p.tv - p.tcs - p.costOp) + p.rap })).sort((a,b) => b.tv - a.tv);
    const totalAlumnos = rows.reduce((s, r) => s + (r.alumnos || 0), 0);
    
    // CÁLCULO DEL % DEL MARGEN DE DELIBER
    const deliberMarginPct = tv > 0 ? ((totalCostOp / tv) * 100).toFixed(1) : 0;

    return { rows, prov, tv, tcs, tcc, totalCostOp, deliberMarginPct, comision, rap, benColegio, t: rows.length, totalAlumnos };
  }, [editableData, colDtos, costePapel, costeDigital, probabilidad]);

  const filtered = calc?.rows.filter(r => !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.isbn?.includes(search)) || [];

  const sty = {
    card: { background: C.card, borderRadius: 16, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), 0 0 0 1px rgba(15,23,42,0.03)', marginBottom: 25 },
    input: { padding: '14px 18px', borderRadius: 10, border: `1px solid ${C.muted}`, fontSize: 15, width: '100%', boxSizing: 'border-box', background: '#fff', color: C.ink, transition: 'border-color 0.2s', outline: 'none' },
    btn: { padding: '12px 24px', borderRadius: 10, background: `linear-gradient(to bottom, ${C.blue}, #1d4ed8)`, color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' },
    btn2: { padding: '12px 24px', borderRadius: 10, border: `1.5px solid ${C.muted}`, background: '#fff', color: C.navy, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }
  };

  return (
    <div style={{ background: C.light, minHeight: '100vh', fontFamily: 'Outfit, sans-serif', color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        input:focus, textarea:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
      `}</style>
      
      <div style={{ padding: '20px 20px 0 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 20, padding: '12px 30px', maxWidth: 1200, margin: '0 auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), 0 0 0 1px rgba(15,23,42,0.03)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            {BRAND.companyLogo ? (
              <img src={BRAND.companyLogo} alt={BRAND.name} style={{ height: 35, objectFit: 'contain', padding: 2 }} />
            ) : (
              <div style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`, color: '#fff', fontWeight: 900, fontSize: 20, padding: '4px 12px', borderRadius: 8 }}>D.</div>
            )}
            <div style={{ borderLeft: `1px solid ${C.muted}`, paddingLeft: 15, marginLeft: 5 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: C.slate, textTransform: 'uppercase', marginBottom: 2 }}>LA TIENDA DEL COLE</div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy, letterSpacing: '-0.3px' }}>{nombre ? `Propuesta: ${nombre}` : "Portal B2B"}</h1>
            </div>
          </div>
          
          {isAuthenticated && step >= 2 && step !== 3 && (
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 10, border: `1px solid ${C.muted}` }}>
              <button onClick={() => setViewMode('comercial')} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: isC ? '#fff' : 'transparent', color: isC ? C.blue : C.slate, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 13, boxShadow: isC ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>🔧 Comercial</button>
              <button onClick={() => setViewMode('colegio')} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: !isC ? '#fff' : 'transparent', color: !isC ? C.blue : C.slate, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 13, boxShadow: !isC ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>🏫 Vista Cliente</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        
        {step === 98 && (
          <div style={{ ...sty.card, maxWidth: 450, margin: '60px auto', textAlign: 'center', borderTop: `4px solid ${C.blue}` }}>
            <div style={{ fontSize: 45, marginBottom: 15 }}>🔐</div>
            <h2 style={{ color: C.navy, margin: '0 0 10px 0', fontSize: 26, fontWeight: 800 }}>Acceso Empleado</h2>
            <p style={{ color: C.slate, fontSize: 15, marginBottom: 25 }}>Introduce el PIN maestro para gestionar propuestas.</p>
            <input type="password" placeholder="••••" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...sty.input, textAlign: 'center', fontSize: 28, letterSpacing: 10, marginBottom: 20, padding: '15px' }} />
            <button onClick={handleLogin} style={{ ...sty.btn, width: '100%', fontSize: 16, padding: '14px' }}>Acceder al Sistema</button>
          </div>
        )}

        {step === 99 && (
          <div style={{ ...sty.card, maxWidth: 450, margin: '60px auto', textAlign: 'center', borderTop: `4px solid ${C.teal}` }}>
            <div style={{ fontSize: 45, marginBottom: 15 }}>🔒</div>
            <h2 style={{ color: C.navy, margin: '0 0 10px 0', fontSize: 26, fontWeight: 800 }}>Propuesta Privada</h2>
            <p style={{ color: C.slate, fontSize: 15, marginBottom: 25 }}>Por favor, introduce la contraseña proporcionada por tu asesor comercial de {BRAND.name}.</p>
            <input type="password" placeholder="Ej: A1B2C3" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...sty.input, textAlign: 'center', fontSize: 24, letterSpacing: 6, marginBottom: 20, textTransform: 'uppercase', padding: '15px' }} />
            <button onClick={handleLogin} style={{ ...sty.btn, width: '100%', background: `linear-gradient(to bottom, ${C.teal}, #0f766e)`, boxShadow: '0 4px 6px -1px rgba(13,148,136,0.2)', fontSize: 16, padding: '14px' }}>Ver Propuesta</button>
          </div>
        )}

        {isAuthenticated && step === 0 && (
          <div style={{...sty.card, animation: 'fadeIn 0.4s ease-out'}}>
            <h2 style={{ marginTop: 0, fontSize: 24, color: C.navy, borderBottom: `1px solid ${C.muted}`, paddingBottom: 20, fontWeight: 800 }}>Crear Nueva Propuesta</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 30, background: '#f8fafc', padding: 25, borderRadius: 16, border: `1px solid ${C.muted}` }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: C.navy }}>👤 Tu Nombre (Comercial)</label>
                <input style={sty.input} value={comercialName} onChange={e => setComercialName(e.target.value)} placeholder="Ej: Carlos Pérez" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: C.navy }}>🏫 Nombre del centro</label>
                <input style={sty.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Colegio Humanitas" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: C.navy }}>👔 Responsable (Opcional)</label>
                <input style={sty.input} value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Ej: María García" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: C.navy }}>🖼️ URL Logotipo del Colegio (Opcional)</label>
                <input style={sty.input} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Ej: https://colegio.com/logo.png" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: C.navy }}>Pega ISBNs + Alumnos</label>
                <textarea style={{ ...sty.input, height: 220, fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical' }} value={inputText} onChange={e => setInputText(e.target.value)} placeholder="9788411826617   48&#10;9788498561661   25" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: C.navy }}>O sube un archivo (CSV/TXT)</label>
                <div style={{ border: `2px dashed ${C.blue}44`, borderRadius: 16, padding: '60px 20px', textAlign: 'center', background: '#f8fafc', transition: 'all 0.3s' }}>
                  <div style={{fontSize: 35, marginBottom: 15}}>📄</div>
                  <input type="file" ref={fileRef} accept=".csv,.txt,.tsv" onChange={handleFile} style={{ display: 'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={sty.btn2}>Seleccionar Archivo</button>
                  <p style={{fontSize: 13, color: C.slate, marginTop: 15}}>Detecta columnas de ISBNs automáticamente</p>
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 25, padding: '15px', background: '#fef2f0', color: C.coral, borderRadius: 10, fontWeight: 600, borderLeft: `4px solid ${C.coral}` }}>⚠️ {error}</div>}
            <div style={{ marginTop: 35, textAlign: 'right', borderTop: `1px solid ${C.muted}`, paddingTop: 25 }}>
              <button onClick={handleCruzar} disabled={!inputText.trim() || !comercialName.trim()} style={{ ...sty.btn, opacity: (inputText.trim() && comercialName.trim()) ? 1 : 0.5, fontSize: 16, padding: '14px 32px' }}>
                {!comercialName.trim() ? "Pon tu nombre para continuar" : "Cruzar datos y generar →"}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', animation: 'fadeIn 0.4s' }}>
            <div style={{ width: 60, height: 60, border: `4px solid ${C.muted}`, borderTopColor: C.blue, borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 25 }}></div>
            <h2 style={{ color: C.navy, margin: '0 0 12px 0', fontSize: 26, fontWeight: 800 }}>{loadingMsg}</h2>
            <p style={{ color: C.slate, fontSize: 16, margin: 0, fontWeight: 500 }}>{loadingSubMsg}</p>
          </div>
        )}

        {isAuthenticated && (step === 2 || step === 3) && calc && (
          <>
            {/* ALERTAS: Faltantes y No Identificados */}
            {isC && (notFoundList.length > 0 || invalidList.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 25 }}>
                
                {notFoundList.length > 0 && (
                  <div style={{ background: '#fef2f0', border: `1px solid ${C.coral}`, borderRadius: 16, padding: '20px', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                      <h3 style={{ margin: 0, color: C.coral, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ {notFoundList.length} ISBNs ignorados (No en catálogo)</h3>
                      <button onClick={() => setShowMissing(!showMissing)} style={{ ...sty.btn2, borderColor: C.coral, color: C.coral, padding: '6px 12px', fontSize: 12, boxShadow: 'none' }}>
                        {showMissing ? "Ocultar" : "👀 Ver Listado"}
                      </button>
                    </div>
                    {showMissing && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: '#fff', padding: 15, borderRadius: 10, border: `1px solid ${C.coral}33`, marginBottom: 15 }}>{notFoundList.map((i,x) => <span key={x} style={{fontSize:13, fontFamily:'monospace', fontWeight:'600', color:C.coral}}>{i}</span>)}</div>}
                    <button onClick={handleSendWebhookNotFound} disabled={webhookSentNotFound} style={{ ...sty.btn, background: webhookSentNotFound ? C.green : C.coral, width: '100%', padding: '10px' }}>
                      {webhookSentNotFound ? "✅ Avisado a Compras" : "✉️ Enviar listado a Compras (n8n)"}
                    </button>
                  </div>
                )}
                
                {invalidList.length > 0 && (
                  <div style={{ background: '#fffbeb', border: `1px solid ${C.accent}`, borderRadius: 16, padding: '20px', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                      <h3 style={{ margin: 0, color: '#d97706', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>❓ {invalidList.length} Códigos rotos / Inválidos</h3>
                      <button onClick={() => setShowInvalid(!showInvalid)} style={{ ...sty.btn2, borderColor: C.accent, color: '#d97706', padding: '6px 12px', fontSize: 12, boxShadow: 'none' }}>
                        {showInvalid ? "Ocultar" : "👀 Ver Códigos"}
                      </button>
                    </div>
                    <p style={{fontSize: 13, color: C.slate, margin: '0 0 15px'}}>Informativo: Estos códigos no tienen 13 dígitos y han sido ignorados. NO se envían a compras.</p>
                    {showInvalid && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: '#fff', padding: 15, borderRadius: 10, border: `1px solid ${C.accent}33`, marginBottom: 15 }}>{invalidList.map((i,x) => <span key={x} style={{fontSize:13, fontFamily:'monospace', background:'#fef3c7', padding:'4px 8px', borderRadius:6, color:'#b45309'}}>{i}</span>)}</div>}
                  </div>
                )}
              </div>
            )}

            {isC && (
              <div style={{ background: '#fff', padding: '25px', borderRadius: 16, marginBottom: 25, border: `1px solid ${C.blue}`, boxShadow: '0 4px 6px -1px rgba(37,99,235,0.1)' }}>
                <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, color: C.blue, fontSize: 15 }}>🎯 Probabilidad de Compra Base</span>
                        <span style={{ fontWeight: 800, color: C.blue, fontSize: 16 }}>{probabilidad}%</span>
                      </div>
                      <input type="range" min="10" max="100" step="5" value={probabilidad} onChange={e => setProbabilidad(+e.target.value)} style={{ width: '100%', cursor: 'pointer' }} />
                    </div>
                    
                    <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                      <div style={{ background: '#f8fafc', padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.muted}`, fontSize: 14, fontWeight: 600, color: C.navy, width: '100%' }}>
                        📄 Op. Papel: <input type="number" value={costePapel} onChange={e => setCostePapel(+e.target.value)} style={{ width: 45, border: 'none', background:'transparent', outline: 'none', fontWeight: 'bold', color: C.blue, fontSize: 15 }} />%
                        <span style={{ margin: '0 12px', color: C.muted }}>|</span>
                        💻 Op. Digital: <input type="number" value={costeDigital} onChange={e => setCosteDigital(+e.target.value)} style={{ width: 45, border: 'none', background:'transparent', outline: 'none', fontWeight: 'bold', color: C.blue, fontSize: 15 }} />%
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', fontWeight: 700, color: C.navy, marginBottom: 8, fontSize: 14 }}>📝 Comentarios de la propuesta (Visibles para el cliente)</label>
                    <textarea 
                      value={comentarios} onChange={e => setComentarios(e.target.value)} 
                      placeholder="Ej: No se han incluido los libros de lectura recomendada..." 
                      style={{ ...sty.input, height: 80, resize: 'vertical', marginBottom: 15 }} 
                    />
                    <button onClick={handleGuardar} style={{ ...sty.btn, background: `linear-gradient(to bottom, ${C.teal}, #0f766e)`, padding: '14px 24px', fontSize: 15, boxShadow: '0 4px 6px -1px rgba(13,148,136,0.2)', width: '100%' }}>
                      {saving ? "⏳ Guardando..." : (currentId ? "💾 Actualizar Propuesta Actual" : "💾 Generar URLs de Cliente")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isC && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15, marginBottom: 25, animation: 'fadeIn 0.3s' }}>
                <KPI label="Facturación" value={fmt(calc.tv)} sub={`Estimada al ${probabilidad}%`} icon="💰" />
                <KPI label="Beneficio Deliber" value={fmt(calc.totalCostOp)} sub={`Margen Operativo (${calc.deliberMarginPct}%)`} icon="⚙️" color={C.slate} />
                <KPI label="Beneficio Colegio" value={fmt(calc.benColegio)} sub="Comisión + Rappel" icon="🏫" accent />
              </div>
            )}

            {shareUrl && commercialUrl && isC && (
              <div style={{ padding: 30, background: '#e8f5e9', borderRadius: 16, marginBottom: 30, border: '1px solid #bbf7d0', textAlign: 'center', animation: 'fadeIn 0.5s', boxShadow: '0 4px 6px -1px rgba(34,197,94,0.1)' }}>
                <div style={{ fontSize: 35, marginBottom: 10 }}>🎉</div>
                <strong style={{ color: C.green, fontSize: 22, fontWeight: 800 }}>¡Propuesta Guardada / Actualizada!</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 25, textAlign: 'left' }}>
                  
                  <div style={{ background: '#fff', padding: 25, borderRadius: 12, border: `1px solid ${C.muted}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: 12, color: C.slate, fontWeight: 800, textTransform: 'uppercase', marginBottom: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🏫 Enlace para el Cliente</span>
                      <span style={{ color: C.coral, background: '#fef2f0', padding: '4px 10px', borderRadius: 6, fontSize: 13, border: `1px solid ${C.coral}33` }}>PIN: <strong>{pin}</strong></span>
                    </div>
                    <a href={shareUrl} target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 700, wordBreak: 'break-all', fontSize: 15, textDecoration: 'none', borderBottom: `1px solid ${C.blue}55` }}>{shareUrl}</a>
                    <p style={{ fontSize: 13, color: C.slate, margin: '15px 0 0', lineHeight: 1.5 }}>Envía este link y la contraseña al responsable del colegio.</p>
                  </div>

                  <div style={{ background: '#fff', padding: 25, borderRadius: 12, border: `1px solid ${C.muted}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: 12, color: C.slate, fontWeight: 800, textTransform: 'uppercase', marginBottom: 15 }}>📝 Tu enlace Privado (Edición)</div>
                    <a href={commercialUrl} target="_blank" rel="noreferrer" style={{ color: C.teal, fontWeight: 700, wordBreak: 'break-all', fontSize: 15, textDecoration: 'none', borderBottom: `1px solid ${C.teal}55` }}>{commercialUrl}</a>
                    <p style={{ fontSize: 13, color: C.slate, margin: '15px 0 0', lineHeight: 1.5 }}>Guarda este link en tu CRM. Te pedirá el PIN Maestro ({COMMERCIAL_PIN}) para volver a editar.</p>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap', borderBottom: `1px solid ${C.muted}`, paddingBottom: 20 }}>
              {!isC && <button onClick={() => setTab('propuesta')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: tab === 'propuesta' ? C.blue : '#fff', color: tab === 'propuesta' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: tab === 'propuesta' ? '0 4px 6px -1px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.05)' }}>Propuesta Integral</button>}
              {['resumen', 'detalle'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: tab === t ? C.blue : '#fff', color: tab === t ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s', boxShadow: tab === t ? '0 4px 6px -1px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.05)' }}>{t}</button>
              ))}
              <button onClick={() => setTab('editoriales')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: tab === 'editoriales' ? C.blue : '#fff', color: tab === 'editoriales' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: tab === 'editoriales' ? '0 4px 6px -1px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.05)' }}>Editoriales y Rappel</button>
            </div>

            {!isC && tab === 'propuesta' && (
              <div style={{ animation: 'fadeIn 0.6s ease-out' }}>
                
                <div style={{ 
                  background: `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 100%)`, 
                  position: 'relative', overflow: 'hidden',
                  borderRadius: 24, padding: '60px 50px', color: '#fff', 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  flexWrap: 'wrap', gap: 40, marginBottom: 30, 
                  boxShadow: '0 20px 25px -5px rgba(37,99,235,0.3), 0 8px 10px -6px rgba(37,99,235,0.2), 0 1px 3px rgba(255,255,255,0.1) inset' 
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.5, pointerEvents: 'none' }}></div>
                  
                  <div style={{ flex: 1, minWidth: 320, position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 30, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20, backdropFilter: 'blur(5px)' }}>
                      ✨ Propuesta Exclusiva
                    </div>
                    
                    <h2 style={{ margin: '0 0 20px 0', fontSize: 46, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-1px' }}>Hazlo fácil con {BRAND.name}</h2>
                    
                    {responsable && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '10px 18px', borderRadius: 10, marginBottom: 25, borderLeft: `4px solid ${C.gold}`, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <span style={{ fontSize: 16, opacity: 0.95, fontWeight: 500 }}>Para: <strong style={{fontWeight: 800}}>{responsable} ({nombre})</strong></span>
                      </div>
                    )}
                    
                    <p style={{ fontSize: 18, opacity: 0.9, maxWidth: 650, margin: 0, lineHeight: 1.6, fontWeight: 400 }}>Imagina tener una tienda online propia del colegio, desde donde vender todo lo necesario para el curso escolar sin complicaciones. Simplificando los procesos para las familias y aumentando la rentabilidad de tu centro.</p>
                  </div>

                  {logoUrl && (
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ background: '#fff', padding: 25, borderRadius: '50%', width: 170, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 10px rgba(255,255,255,0.1)' }}>
                        <img src={logoUrl} alt="Logo Colegio" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.05))' }} onError={(e) => e.target.style.display='none'} />
                      </div>
                    </div>
                  )}
                </div>

                {comentarios && (
                  <div style={{ background: '#fff', borderLeft: `6px solid ${C.accent}`, padding: '25px 30px', borderRadius: 16, marginBottom: 40, boxShadow: '0 10px 25px rgba(0,0,0,0.03)' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: C.navy, display: 'flex', alignItems: 'center', gap: 12, fontSize: 18 }}><span>💡</span> Nota de tu asesor comercial {comercialName ? `(${comercialName})` : ''}</h4>
                    <p style={{ margin: 0, color: C.slate, lineHeight: 1.7, fontSize: 16, whiteSpace: 'pre-wrap' }}>{comentarios}</p>
                  </div>
                )}

                <h3 style={{ fontSize: 30, color: C.navy, textAlign: 'center', marginTop: 50, marginBottom: 15, fontWeight: 800, letterSpacing: '-0.5px' }}>Proceso rentable para el colegio</h3>
                <p style={{ textAlign: 'center', color: C.slate, maxWidth: 800, margin: '0 auto 30px', fontSize: 17, lineHeight: 1.6 }}>Cada venta en la tienda online se traduce en ingresos para tu centro. Un dinero que podrás invertir en modernizar aulas o mejorar instalaciones.</p>
                
                <div style={{ ...sty.card, border: `2px solid ${C.teal}`, position: 'relative', boxShadow: '0 20px 25px -5px rgba(13,148,136,0.1), 0 8px 10px -6px rgba(13,148,136,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 30 }}>
                    <div style={{ flex: 1, minWidth: 300 }}>
                      <h3 style={{ marginTop: 0, color: C.teal, display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
                        <span style={{background: `${C.teal}15`, padding: 8, borderRadius: 10, display: 'flex'}}>🧮</span> Simulador de Retorno
                      </h3>
                      <p style={{ color: C.slate, fontSize: 16, lineHeight: 1.6, margin: '15px 0 30px 0' }}>Descubre tu beneficio ajustando la estimación de familias que utilizarán la plataforma a lo largo del curso.</p>
                      
                      <div style={{ background: '#f8fafc', padding: '20px 25px', borderRadius: 12, border: `1px solid ${C.muted}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>Familias estimadas</span>
                          <span style={{ fontWeight: 800, color: C.teal, fontSize: 20 }}>{probabilidad}%</span>
                        </div>
                        <input type="range" min="10" max="100" step="5" value={probabilidad} onChange={e => setProbabilidad(+e.target.value)} style={{ width: '100%', cursor: 'pointer', accentColor: C.teal }} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', alignItems: 'center' }}>
                      <KPI label="Beneficio Estimado" value={fmt(calc.benColegio)} accent />
                      {calc.rap > 0 && <KPI label="Rappel Garantizado" value={fmt(calc.rap)} sub="Por mejora de condiciones" color={C.coral} />}
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.muted}`, marginTop: 30, paddingTop: 20, textAlign: 'center' }}>
                    <p style={{ fontSize: 14, color: C.slate, fontStyle: 'italic', margin: 0 }}>* Datos aproximados. Sujeto a variaciones finales de compra y actualización de tarifas de mercado.</p>
                  </div>
                </div>

                <h3 style={{ fontSize: 30, color: C.navy, textAlign: 'center', marginTop: 70, marginBottom: 15, fontWeight: 800, letterSpacing: '-0.5px' }}>Nosotros nos encargamos de todo</h3>
                <p style={{ textAlign: 'center', color: C.slate, maxWidth: 800, margin: '0 auto 40px', fontSize: 17, lineHeight: 1.6 }}>Tendrás a un especialista que guía al colegio y un equipo de atención al cliente para las familias. Vende libros, licencias, material, uniformes y más.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 25, marginBottom: 60 }}>
                  <div style={{ padding: 35, background: '#fff', borderRadius: 20, borderTop: `6px solid ${C.blue}`, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', transition: 'all 0.3s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-8px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ fontSize: 40, marginBottom: 20, background: `${C.blue}15`, display: 'inline-block', padding: 15, borderRadius: 16 }}>💻</div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 800, color: C.navy }}>Plataforma Adaptable</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.6 }}>Nuestra plataforma se adapta a cualquier producto. Desde libros hasta la agenda escolar o papeletas para sorteos.</p>
                  </div>
                  <div style={{ padding: 35, background: '#fff', borderRadius: 20, borderTop: `6px solid ${C.teal}`, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', transition: 'all 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-8px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ fontSize: 40, marginBottom: 20, background: `${C.teal}15`, display: 'inline-block', padding: 15, borderRadius: 16 }}>📦</div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 800, color: C.navy }}>Logística 100%</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.6 }}>Asumimos pedidos, almacenamiento, preparación y entrega. El centro no invierte ni un minuto.</p>
                  </div>
                  <div style={{ padding: 35, background: '#fff', borderRadius: 20, borderTop: `6px solid ${C.gold}`, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', transition: 'all 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-8px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ fontSize: 40, marginBottom: 20, background: `${C.gold}22`, display: 'inline-block', padding: 15, borderRadius: 16 }}>💬</div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 800, color: C.navy }}>Atención a Familias</h3>
                    <p style={{ margin: 0, color: C.slate, fontSize: 15, lineHeight: 1.6 }}>Resolvemos dudas, incidencias y devoluciones. Liberamos a la secretaría del estrés de campaña.</p>
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 24, padding: '60px 50px', border: `1px solid ${C.muted}`, marginBottom: 60, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: 30, color: C.navy, marginTop: 0, marginBottom: 45, textAlign: 'center', fontWeight: 800, letterSpacing: '-0.5px' }}>¿Cómo funciona para el colegio?</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
                    {[
                      "Tras contactar con nosotros, os pediremos el listado de ISBN y resto de productos a incluir.",
                      "Elegís un dominio acorde al centro y nosotros nos encargamos de ponerlo todo en marcha, a tu nombre y con tus contenidos.",
                      "Después, debéis comunicar a las familias que pueden comprar desde la nueva web. ¡No tenéis que hacer más!",
                      "Asumimos toda la logística con las editoriales: pedidos, almacenamiento, entrega o devolución.",
                      "Nos encargamos de toda la atención al cliente para que no os preocupéis de seguimientos o incidencias."
                    ].map((text, i) => (
                      <div key={i} style={{ display: 'flex', gap: 25, alignItems: 'center', background: '#f8fafc', padding: '25px 30px', borderRadius: 16, border: `1px solid ${C.muted}` }}>
                        <div style={{ background: `linear-gradient(135deg, ${C.blue}, #1e40af)`, color: '#fff', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, flexShrink: 0, boxShadow: '0 4px 10px rgba(37,99,235,0.3)' }}>{i+1}</div>
                        <div style={{ color: C.navy, fontSize: 17, lineHeight: 1.6, fontWeight: 500 }}>{text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: `linear-gradient(135deg, ${C.teal}0a, ${C.blue}0a)`, borderRadius: 24, padding: '60px 50px', border: `1px solid ${C.teal}33` }}>
                  <h3 style={{ fontSize: 30, color: C.teal, marginTop: 0, marginBottom: 50, textAlign: 'center', fontWeight: 800, letterSpacing: '-0.5px' }}>Un proceso sencillo para las familias</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, textAlign: 'center', marginBottom: 60 }}>
                    <div style={{ background: '#fff', padding: '30px 20px', borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}><div style={{ fontSize: 45, marginBottom: 20 }}>🏫</div><div style={{ fontWeight: 700, color: C.navy, fontSize: 17 }}>1. Centro define material</div></div>
                    <div style={{ background: '#fff', padding: '30px 20px', borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}><div style={{ fontSize: 45, marginBottom: 20 }}>🛒</div><div style={{ fontWeight: 700, color: C.navy, fontSize: 17 }}>2. Familias compran web</div></div>
                    <div style={{ background: '#fff', padding: '30px 20px', borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}><div style={{ fontSize: 45, marginBottom: 20 }}>💳</div><div style={{ fontWeight: 700, color: C.navy, fontSize: 17 }}>3. Facilidades de pago</div></div>
                    <div style={{ background: '#fff', padding: '30px 20px', borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}><div style={{ fontSize: 45, marginBottom: 20 }}>🚚</div><div style={{ fontWeight: 700, color: C.navy, fontSize: 17 }}>4. Reciben en casa</div></div>
                  </div>

                  <div style={{ background: '#fff', padding: 40, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: `1px solid ${C.muted}` }}>
                    <h4 style={{ margin: '0 0 25px 0', color: C.navy, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>Facilitamos la vida a las familias</h4>
                    <ul style={{ margin: 0, paddingLeft: 25, color: C.slate, fontSize: 17, lineHeight: 1.8 }}>
                      <li style={{marginBottom: 15}}><strong>Facilidades de pago</strong> para no hacer esfuerzos económicos al inicio de curso.</li>
                      <li style={{marginBottom: 15}}><strong>Evitamos errores:</strong> la lista aparece exacta según el año y curso del colegio.</li>
                      <li style={{marginBottom: 15}}><strong>Licencias digitales cubiertas:</strong> se asocian directamente al correo del alumno sin configurar nada.</li>
                      <li><strong>Facturación simple:</strong> facturamos a las familias, y a nosotros nos facturan las editoriales.</li>
                    </ul>
                  </div>
                </div>

              </div>
            )}

            {tab === 'resumen' && (
              <div style={{ animation: 'fadeIn 0.3s' }}>
                {!isC && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 25 }}>
                    <KPI label="Facturación Estimada" value={fmt(calc.tv)} sub={`De ${Math.round(calc.totalAlumnos * (probabilidad/100))} compras estimadas`} icon="💰" />
                    <KPI label="Total Costes Centro" value={fmt(calc.tcc + calc.totalCostOp)} sub={`Material: ${fmt(calc.tcc)} | Op: ${fmt(calc.totalCostOp)}`} icon="📉" color={C.slate} />
                    <KPI label="Beneficio Colegio" value={fmt(calc.benColegio)} sub="Comisión + Rappel" icon="🏫" accent />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 25 }}>
                  <div style={sty.card}>
                    <h3 style={{ marginTop: 0, fontSize: 20, color: C.navy, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 25 }}>Ventas por Editorial</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={calc.prov.map(p => ({ name: sh(p.p), Venta: Math.round(p.tv) }))} layout="vertical" margin={{ left: 10 }}>
                        <defs>
                          <linearGradient id="colorVenta" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={C.blue} stopOpacity={0.8}/>
                            <stop offset="100%" stopColor={C.teal} stopOpacity={1}/>
                          </linearGradient>
                        </defs>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 13, fill: C.slate, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={v => fmt(v)} cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '10px 15px', fontWeight: 600, color: C.navy}} />
                        <Bar dataKey="Venta" fill="url(#colorVenta)" radius={[0, 8, 8, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={sty.card}>
                    <h3 style={{ marginTop: 0, fontSize: 20, color: C.navy, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 25 }}>Distribución</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie data={calc.prov.map((p,i) => ({ name: sh(p.p), value: Math.round(p.tv), fill: C.ch[i%C.ch.length] }))} dataKey="value" cx="50%" cy="50%" innerRadius={75} outerRadius={110} paddingAngle={3} />
                        <Tooltip formatter={v => fmt(v)} contentStyle={{borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '10px 15px', fontWeight: 600, color: C.navy}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: C.slate, fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>* Datos aproximados. Sujeto a variaciones finales de compra y actualización de tarifas anuales.</p>
              </div>
            )}

            {tab === 'detalle' && (
              <div style={{...sty.card, animation: 'fadeIn 0.3s'}}>
                
                {isC && (
                  <div style={{ display: 'flex', gap: 15, alignItems: 'center', background: '#f8fafc', padding: 20, borderRadius: 16, border: `1px solid ${C.muted}`, marginBottom: 25, flexWrap: 'wrap' }}>
                    <span style={{fontWeight: 800, color: C.navy, fontSize: 15}}>➕ Añadir ISBN Manual:</span>
                    <input value={manualIsbn} onChange={e=>setManualIsbn(e.target.value)} placeholder="Ej: 9788411826617" style={{...sty.input, width: 200, padding: '10px 15px'}} />
                    <input type="number" value={manualAlumnos} onChange={e=>setManualAlumnos(e.target.value)} placeholder="Alumnos" style={{...sty.input, width: 100, padding: '10px 15px'}} />
                    <button onClick={handleAddManualIsbn} disabled={isManualLoading} style={{...sty.btn, padding: '10px 20px', background: C.teal, boxShadow: 'none'}}>
                      {isManualLoading ? "Buscando..." : "Buscar e Incorporar"}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                  <h3 style={{ margin: 0, fontSize: 20, color: C.navy, fontWeight: 800, letterSpacing: '-0.5px' }}>Listado Oficial de Títulos ({calc.t})</h3>
                  <input type="text" placeholder="Buscar ISBN o título..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...sty.input, width: 300, padding: '10px 15px' }} />
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 600, borderRadius: 12, border: `1px solid ${C.muted}`, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '15px 20px', color: C.slate, fontWeight: 700 }}>ISBN</th>
                        <th style={{ padding: '15px 20px', color: C.slate, fontWeight: 700 }}>Título</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', color: C.slate, fontWeight: 700 }}>Fmt</th>
                        <th style={{ padding: '15px 20px', color: C.slate, fontWeight: 700 }}>PVP</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', color: C.slate, fontWeight: 700 }}>Alumnos Base</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', color: C.teal, fontWeight: 800 }}>Est. ({probabilidad}%)</th>
                        <th style={{ padding: '15px 20px', textAlign: 'right', color: C.slate, fontWeight: 700 }}>Venta Estimada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.muted}`, background: i % 2 === 0 ? '#fff' : '#fcfcfc', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fcfcfc'}>
                          <td style={{ padding: '15px 20px', fontFamily: 'monospace', color: C.slate, fontSize: 13 }}>{r.isbn}</td>
                          <td style={{ padding: '15px 20px', fontWeight: 600, color: C.navy }}>{r.titulo}</td>
                          <td style={{ padding: '15px 20px', fontSize: 18, textAlign: 'center' }}>{r.isPapel ? '📄' : '💻'}</td>
                          <td style={{ padding: '15px 20px', color: C.navy }}>{fmt(r.pvp)}</td>
                          <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                            <input type="number" value={r.alumnos} onChange={e => updateAlumnos(r.isbn, e.target.value)} disabled={!isC} style={{ width: 60, padding: 8, textAlign: 'center', border: `1px solid ${C.muted}`, borderRadius: 8, background: isC ? '#fff' : 'transparent', fontWeight: 'bold', color: C.navy }} />
                          </td>
                          <td style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 800, color: C.teal, fontSize: 16 }}>{Math.round(r.alumsEstimados)}</td>
                          <td style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 800, color: C.navy }}>{fmt(r.tv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'editoriales' && (
              <div style={{...sty.card, animation: 'fadeIn 0.3s'}}>
                <h3 style={{ marginTop: 0, fontSize: 24, color: C.navy, fontWeight: 800, letterSpacing: '-0.5px' }}>Descuentos y Rappel por Editorial</h3>
                <p style={{ fontSize: 16, color: C.slate, marginBottom: 30, lineHeight: 1.6 }}>Compara los descuentos negociados por tu colegio con los de nuestra central de compras. Introduce tus márgenes actuales y descubre el Rappel (Beneficio) extra que te devolvemos.</p>
                <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${C.muted}`, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '20px 25px', color: C.slate, fontWeight: 700 }}>Proveedor Principal</th>
                        <th style={{ padding: '20px 25px', textAlign: 'center', color: C.slate, fontWeight: 700 }}>DTO {BRAND.name} (Calculado)</th>
                        <th style={{ padding: '20px 25px', textAlign: 'center', color: C.teal, fontWeight: 800 }}>Tu Descuento Actual</th>
                        <th style={{ padding: '20px 25px', textAlign: 'right', color: C.coral, fontWeight: 800 }}>Rappel a tu favor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(colDtos).sort().map((prov, i) => {
                        const d = colDtos[prov];
                        const dif = d.col > d.scho;
                        const provCalc = calc.prov.find(p => p.p === prov);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fcfcfc', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f0fdfa'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fcfcfc'}>
                            <td style={{ padding: '20px 25px', fontWeight: 700, color: C.navy }}>{sh(prov)}</td>
                            <td style={{ padding: '20px 25px', textAlign: 'center', color: C.slate, fontWeight: 600 }}>{d.scho}%</td>
                            <td style={{ padding: '20px 25px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', border: `2px solid ${dif ? C.teal : C.muted}`, borderRadius: 10, padding: '6px 12px', boxShadow: dif ? `0 0 0 4px ${C.teal}22` : '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
                                <input type="number" value={d.col} onChange={e => setColDtos(p => ({ ...p, [prov]: { ...p[prov], col: +e.target.value } }))} style={{ width: 55, border: 'none', outline: 'none', textAlign: 'center', fontWeight: '800', fontSize: 18, color: dif ? C.teal : C.navy, background: 'transparent' }} />
                                <span style={{ fontWeight: '800', color: dif ? C.teal : C.slate }}>%</span>
                              </div>
                            </td>
                            <td style={{ padding: '20px 25px', textAlign: 'right', fontWeight: 800, color: (provCalc?.rap || 0) > 0 ? C.coral : C.slate, fontSize: 18 }}>
                              {fmt(provCalc?.rap || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '50px 20px 40px', marginTop: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 20, padding: '30px', gap: 40, boxShadow: '0 10px 25px rgba(0,0,0,0.02)' }}>
            <div style={{ borderRight: '1px solid #f1f5f9', paddingRight: 40 }}>
              <a href="https://www.scholarum.es" target="_blank" rel="noreferrer">
                <img src="https://www.scholarum.es/wp-content/uploads/footer/logo-scholarum.svg" alt="Scholarum" style={{ height: 45 }} />
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 35, alignItems: 'center', justifyContent: 'center' }}>
              <LogoHoverLink href="https://somosdeliber.com" src="https://www.scholarum.es/wp-content/uploads/footer/logo-deliber.svg" height={30} />
              <LogoHoverLink href="https://zonacoles.es/" src="https://www.scholarum.es/wp-content/uploads/footer/logo-zonacoles.svg" height={34} />
              <LogoHoverLink href="https://zonafp.com/" src="https://www.scholarum.es/wp-content/uploads/footer/logo-zonafp.svg" height={26} />
              <LogoHoverLink href="https://lareddual.com/" src="https://www.scholarum.es/wp-content/uploads/footer/logo-lareddual.svg" height={30} />
              <LogoHoverLink href="https://laferiadeloscolegios.com/" src="https://www.scholarum.es/wp-content/uploads/footer/logo-laferiadeloscolegios.svg" height={30} />
              <LogoHoverLink href="https://yoin.es/" src="https://www.scholarum.es/wp-content/uploads/footer/logo-yoin.svg" height={26} />
            </div>
          </div>
          <p style={{ textAlign: 'center', color: C.slate, fontSize: 14, marginTop: 30, fontWeight: 500 }}>
            © Copyright {new Date().getFullYear()} | Scholarum Educación. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, icon, accent, color }) {
  return (
    <div style={{ background: accent ? `linear-gradient(135deg, ${C.teal}, ${C.blue})` : C.card, padding: '25px 30px', borderRadius: 20, boxShadow: accent ? '0 10px 25px -5px rgba(13,148,136,0.3)' : '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), 0 0 0 1px rgba(15,23,42,0.03)', color: accent ? '#fff' : (color || C.ink), position: 'relative', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
      <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>{icon && <span style={{fontSize: 20}}>{icon}</span>} {label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 13, opacity: 0.75, marginTop: 8, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function LogoHoverLink({ href, src, height }) {
  const [hover, setHover] = useState(false);
  return (
    <a href={href} target="_blank" rel="noreferrer" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <img src={src} alt="Brand" style={{ height: height, filter: hover ? 'grayscale(0)' : 'grayscale(1)', opacity: hover ? 1 : 0.6, transition: 'all 0.3s ease', cursor: 'pointer', display: 'block' }} />
    </a>
  );
}
