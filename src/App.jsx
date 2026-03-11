import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// IMPORTACIONES ARQUITECTURA SDD
import { BRAND, COMMERCIAL_PIN, N8N_WEBHOOK_URL, CLARITY_ID, C, sty } from "./config/constants";
import { fmt, sh, setFavicon, injectClarity, parseInput, generatePIN, refreshDtosReal } from "./utils/helpers";
import { apiCall } from "./services/api";
import { calculateBusinessModel } from "./utils/calculator";

// IMPORTACIONES COMPONENTES
import { KPI, Spinner } from "./components/UI";
import { Header, Footer } from "./components/Layout";
import { AuthScreens } from "./components/AuthScreens";
import { CreationForm } from "./components/CreationForm";

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
  
  const [pricingModel, setPricingModel] = useState('global'); 
  const [editorialMargins, setEditorialMargins] = useState({}); 
  
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
    setFavicon(BRAND.favicon); 
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
          
          setPricingModel(meta.pricingModel || 'global');
          setEditorialMargins(meta.editorialMargins || {});
          
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

  const handleNewProposal = () => {
    if (step >= 2) {
      if (!window.confirm("¿Seguro que quieres crear una nueva propuesta?\nLos cambios no guardados se perderán.")) return;
    }
    setStep(0); setCurrentId(''); setNombre(''); setResponsable(''); setComentarios(''); setLogoUrl('');
    setInputText(''); setInvalidCodes([]); setData(null); setEditableData(null); setColDtos({});
    setShareUrl(''); setCommercialUrl(''); setPricingModel('global'); setEditorialMargins({});
    setWebhookSentNotFound(false);
    window.history.replaceState({}, '', window.location.pathname);
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
    if (cleanIsbn.length !== 13 && cleanIsbn.length !== 10) { alert('El ISBN debe tener 10 o 13 dígitos numéricos.'); return; }

    if (editableData?.found?.some(b => b.isbn === cleanIsbn || b.isbn === '978'+cleanIsbn)) {
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
    try {
      const datosSeguros = { 
        ...editableData, 
        meta: { logoUrl, responsable, comercialName, comentarios, pin, notFound: notFoundList, invalidCodes: invalidList, pricingModel, editorialMargins } 
      };
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      const saveData = { nombre, pin, costeOp: costePapel, costeOpDigital: costeDigital, prob: probabilidad, condiciones: colDtos, datos: datosSeguros };

      const r = await apiCall('guardar', { data: saveData, id: currentId, baseUrl });
      if (r.error) throw new Error(r.error);
      
      setCurrentId(r.id); 
      setShareUrl(`${baseUrl}?id=${r.id}&ref=client`); 
      setCommercialUrl(`${baseUrl}?id=${r.id}&ref=admin`); 
    } catch (e) { alert('Error al guardar: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, probabilidad, colDtos, logoUrl, responsable, comercialName, comentarios, pin, notFoundList, invalidList, currentId, pricingModel, editorialMargins]);

  const handleSendWebhookNotFound = async () => {
    if(!N8N_WEBHOOK_URL) return;
    try {
      for (const isbn of notFoundList) {
        await fetch(N8N_WEBHOOK_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            tipo: 'ISBN_FALTANTE', colegio: nombre, 
            comercial: comercialName || 'No especificado', 
            fecha: new Date().toISOString(), isbnFaltante: isbn 
          }) 
        });
        await new Promise(r => setTimeout(r, 600)); 
      }
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

  const calc = useMemo(() => calculateBusinessModel({
    editableData, colDtos, costePapel, costeDigital, probabilidad, pricingModel, editorialMargins
  }), [editableData, colDtos, costePapel, costeDigital, probabilidad, pricingModel, editorialMargins]);

  const filtered = calc?.rows.filter(r => !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.isbn?.includes(search)) || [];

  return (
    <div style={{ background: C.light, minHeight: '100vh', fontFamily: 'Outfit, sans-serif', color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        input:focus, textarea:focus, select:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
      `}</style>
      
      <Header nombre={nombre} isAuthenticated={isAuthenticated} step={step} isC={isC} setViewMode={setViewMode} handleNewProposal={handleNewProposal} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        
        <AuthScreens step={step} pinInput={pinInput} setPinInput={setPinInput} handleLogin={handleLogin} />

        {isAuthenticated && step === 0 && (
          <CreationForm 
            comercialName={comercialName} setComercialName={setComercialName}
            nombre={nombre} setNombre={setNombre}
            responsable={responsable} setResponsable={setResponsable}
            logoUrl={logoUrl} setLogoUrl={setLogoUrl}
            inputText={inputText} setInputText={setInputText}
            fileRef={fileRef} handleFile={handleFile}
            error={error} handleCruzar={handleCruzar}
          />
        )}

        {step === 1 && <Spinner loadingMsg={loadingMsg} loadingSubMsg={loadingSubMsg} />}

        {/* -------------------------------------------------------------
            DASHBOARD PRINCIPAL (Módulo Pendiente de Separar en Fase 3)
            ------------------------------------------------------------- */}
        {isAuthenticated && (step === 2 || step === 3) && calc && (
          <>
            {isC && (notFoundList.length > 0 || invalidList.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 25 }}>
                {notFoundList.length > 0 && (
                  <div style={{ background: '#fef2f0', border: `1px solid ${C.coral}`, borderRadius: 16, padding: '20px', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                      <h3 style={{ margin: 0, color: C.coral, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ {notFoundList.length} ISBNs ignorados (No en catálogo)</h3>
                      <button onClick={() => setShowMissing(!showMissing)} style={{ ...sty.btn2, borderColor: C.coral, color: C.coral, padding: '6px 12px', fontSize: 12, boxShadow: 'none' }}>{showMissing ? "Ocultar" : "👀 Ver Listado"}</button>
                    </div>
                    {showMissing && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: '#fff', padding: 15, borderRadius: 10, border: `1px solid ${C.coral}33`, marginBottom: 15 }}>{notFoundList.map((i,x) => <span key={x} style={{fontSize:13, fontFamily:'monospace', fontWeight:'600', color:C.coral}}>{i}</span>)}</div>}
                    <button onClick={handleSendWebhookNotFound} disabled={webhookSentNotFound} style={{ ...sty.btn, background: webhookSentNotFound ? C.green : C.coral, width: '100%', padding: '10px' }}>
                      {webhookSentNotFound ? "✅ Avisado a Compras (n8n)" : "✉️ Enviar listado a Compras (n8n)"}
                    </button>
                  </div>
                )}
                
                {invalidList.length > 0 && (
                  <div style={{ background: '#fffbeb', border: `1px solid ${C.accent}`, borderRadius: 16, padding: '20px', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                      <h3 style={{ margin: 0, color: '#d97706', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>❓ {invalidList.length} Códigos rotos / Inválidos</h3>
                      <button onClick={() => setShowInvalid(!showInvalid)} style={{ ...sty.btn2, borderColor: C.accent, color: '#d97706', padding: '6px 12px', fontSize: 12, boxShadow: 'none' }}>{showInvalid ? "Ocultar" : "👀 Ver Códigos"}</button>
                    </div>
                    <p style={{fontSize: 13, color: C.slate, margin: '0 0 15px'}}>Informativo: Estos códigos no tienen la longitud correcta y han sido ignorados.</p>
                    {showInvalid && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: '#fff', padding: 15, borderRadius: 10, border: `1px solid ${C.accent}33` }}>{invalidList.map((i,x) => <span key={x} style={{fontSize:13, fontFamily:'monospace', background:'#fef3c7', padding:'4px 8px', borderRadius:6, color:'#b45309'}}>{i}</span>)}</div>}
                  </div>
                )}
              </div>
            )}

            {isC && (
              <div style={{ background: '#fff', padding: '30px', borderRadius: 16, marginBottom: 25, border: `1px solid ${C.blue}`, boxShadow: '0 4px 6px -1px rgba(37,99,235,0.1)' }}>
                <h3 style={{ marginTop: 0, color: C.navy, borderBottom: `1px solid ${C.muted}`, paddingBottom: 15, marginBottom: 25 }}>⚙️ Configuración del Negocio</h3>
                <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1.5', minWidth: 350 }}>
                    <div style={{ marginBottom: 30, background: '#f8fafc', padding: '15px 20px', borderRadius: 12, border: `1px solid ${C.muted}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>🎯 Probabilidad de Compra Base</span>
                        <span style={{ fontWeight: 800, color: C.blue, fontSize: 18 }}>{probabilidad}%</span>
                      </div>
                      <input type="range" min="10" max="100" step="5" value={probabilidad} onChange={e => setProbabilidad(+e.target.value)} style={{ width: '100%', cursor: 'pointer' }} />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontWeight: 700, color: C.navy, fontSize: 15, display: 'block', marginBottom: 10 }}>Calculadora de Rentabilidad</label>
                      <div style={{ display: 'flex', background: '#f1f5f9', padding: 6, borderRadius: 12, border: `1px solid ${C.muted}`, width: 'fit-content' }}>
                        <button onClick={() => setPricingModel('global')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: pricingModel==='global' ? '#fff' : 'transparent', color: pricingModel==='global' ? C.blue : C.slate, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: pricingModel==='global' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>🌍 % Global (Logística)</button>
                        <button onClick={() => setPricingModel('editorial')} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: pricingModel==='editorial' ? '#fff' : 'transparent', color: pricingModel==='editorial' ? C.blue : C.slate, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: pricingModel==='editorial' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>📚 % por Editorial</button>
                      </div>
                    </div>

                    <div style={{ minHeight: 120 }}>
                      {pricingModel === 'global' ? (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                          <p style={{ fontSize: 14, color: C.slate, marginBottom: 15 }}>El beneficio del colegio se calcula sumando la comisión (PVP - Coste - Logística) más el rappel que negocien.</p>
                          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                            <div style={{ background: '#fff', padding: '15px 20px', borderRadius: 12, border: `2px solid ${C.blue}33`, fontSize: 15, fontWeight: 600, color: C.navy, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                              📄 Gasto Op. Papel: <input type="number" value={costePapel} onChange={e => setCostePapel(+e.target.value)} style={{ width: 50, border: 'none', background:'transparent', outline: 'none', fontWeight: '800', color: C.blue, fontSize: 18, textAlign: 'center' }} />%
                              <span style={{ margin: '0 20px', color: C.muted }}>|</span>
                              💻 Gasto Op. Digital: <input type="number" value={costeDigital} onChange={e => setCosteDigital(+e.target.value)} style={{ width: 50, border: 'none', background:'transparent', outline: 'none', fontWeight: '800', color: C.blue, fontSize: 18, textAlign: 'center' }} />%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                          <p style={{ fontSize: 14, color: C.slate, marginBottom: 15 }}>Asigna qué % directo de la Venta final se queda el colegio por cada editorial.</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 15, maxHeight: 300, overflowY: 'auto', paddingRight: 10 }}>
                            {calc.prov.map(p => (
                              <div key={p.p} style={{ background: '#fff', padding: '12px 15px', borderRadius: 10, border: `1px solid ${C.muted}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }} title={p.p}>{sh(p.p).substring(0, 16)}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <input type="number" value={editorialMargins[p.p] || 0} onChange={e => setEditorialMargins(prev => ({...prev, [p.p]: +e.target.value}))} style={{ width: 50, padding: '6px', borderRadius: 6, border: `2px solid ${editorialMargins[p.p] > 0 ? C.teal : C.muted}`, textAlign: 'center', fontWeight: '800', color: editorialMargins[p.p] > 0 ? C.teal : C.slate, outline: 'none' }} />
                                  <span style={{color: C.slate, fontWeight: 'bold'}}>%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', fontWeight: 700, color: C.navy, marginBottom: 8, fontSize: 14 }}>📝 Comentarios de la propuesta</label>
                    <textarea value={comentarios} onChange={e => setComentarios(e.target.value)} placeholder="Ej: Oferta válida hasta el 30 de Mayo..." style={{ ...sty.input, flex: 1, minHeight: 120, resize: 'vertical', marginBottom: 20 }} />
                    <button onClick={handleGuardar} style={{ ...sty.btn, background: `linear-gradient(to bottom, ${C.teal}, #0f766e)`, padding: '18px 24px', fontSize: 16, boxShadow: '0 4px 6px -1px rgba(13,148,136,0.3)', width: '100%' }}>
                      {saving ? "⏳ Guardando..." : (currentId ? "💾 Actualizar Propuesta Actual" : "💾 Guardar y Generar URLs")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isC && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15, marginBottom: 25, animation: 'fadeIn 0.3s' }}>
                <KPI label="Facturación" value={fmt(calc.tv)} sub={`Estimada al ${probabilidad}%`} icon="💰" />
                <KPI label="Beneficio Deliber" value={fmt(calc.activeDeliberBenefit)} sub={`Margen Operativo Neto (${calc.activeDeliberMarginPct}%)`} icon="⚙️" color={C.slate} />
                <KPI label="Beneficio Colegio" value={fmt(calc.activeSchoolBenefit)} sub={pricingModel === 'global' ? "Comisión + Rappel" : "Margen directo s/ventas"} icon="🏫" accent />
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
                  </div>
                  <div style={{ background: '#fff', padding: 25, borderRadius: 12, border: `1px solid ${C.muted}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: 12, color: C.slate, fontWeight: 800, textTransform: 'uppercase', marginBottom: 15 }}>📝 Tu enlace Privado (Edición)</div>
                    <a href={commercialUrl} target="_blank" rel="noreferrer" style={{ color: C.teal, fontWeight: 700, wordBreak: 'break-all', fontSize: 15, textDecoration: 'none', borderBottom: `1px solid ${C.teal}55` }}>{commercialUrl}</a>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 25, flexWrap: 'wrap', borderBottom: `1px solid ${C.muted}`, paddingBottom: 20 }}>
              {!isC && <button onClick={() => setTab('propuesta')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: tab === 'propuesta' ? C.blue : '#fff', color: tab === 'propuesta' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: tab === 'propuesta' ? '0 4px 6px -1px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.05)' }}>Propuesta Integral</button>}
              {['resumen', 'detalle'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: tab === t ? C.blue : '#fff', color: tab === t ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s', boxShadow: tab === t ? '0 4px 6px -1px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.05)' }}>{t}</button>
              ))}
              {(isC || pricingModel === 'global') && (
                <button onClick={() => setTab('editoriales')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: tab === 'editoriales' ? C.blue : '#fff', color: tab === 'editoriales' ? '#fff' : C.slate, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: tab === 'editoriales' ? '0 4px 6px -1px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {pricingModel === 'global' ? 'Editoriales y Rappel' : 'Márgenes por Editorial'}
                </button>
              )}
            </div>

            {!isC && tab === 'propuesta' && (
              <div style={{ animation: 'fadeIn 0.6s ease-out' }}>
                <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.blue} 100%)`, position: 'relative', overflow: 'hidden', borderRadius: 24, padding: '60px 50px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 40, marginBottom: 30, boxShadow: '0 20px 25px -5px rgba(37,99,235,0.3)' }}>
                  <div style={{ flex: 1, minWidth: 320, position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 30, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20 }}>✨ Propuesta Exclusiva</div>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: 46, lineHeight: 1.1, fontWeight: 800 }}>Hazlo fácil con {BRAND.name}</h2>
                    {responsable && <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '10px 18px', borderRadius: 10, marginBottom: 25, borderLeft: `4px solid ${C.gold}` }}><span style={{ fontSize: 16 }}>Para: <strong style={{fontWeight: 800}}>{responsable} ({nombre})</strong></span></div>}
                    <p style={{ fontSize: 18, opacity: 0.9, maxWidth: 650, margin: 0, lineHeight: 1.6 }}>Imagina tener una tienda online propia del colegio, simplificando los procesos para las familias y aumentando la rentabilidad.</p>
                  </div>
                  {logoUrl && <div style={{ position: 'relative', zIndex: 1 }}><div style={{ background: '#fff', padding: 25, borderRadius: '50%', width: 170, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src={logoUrl} alt="Logo" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} /></div></div>}
                </div>

                {comentarios && (
                  <div style={{ background: '#fff', borderLeft: `6px solid ${C.accent}`, padding: '25px 30px', borderRadius: 16, marginBottom: 40, boxShadow: '0 10px 25px rgba(0,0,0,0.03)' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: C.navy, display: 'flex', alignItems: 'center', gap: 12, fontSize: 18 }}><span>💡</span> Nota de tu asesor comercial {comercialName ? `(${comercialName})` : ''}</h4>
                    <p style={{ margin: 0, color: C.slate, lineHeight: 1.7, fontSize: 16, whiteSpace: 'pre-wrap' }}>{comentarios}</p>
                  </div>
                )}

                <div style={{ ...sty.card, border: `2px solid ${C.teal}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 30 }}>
                    <div style={{ flex: 1, minWidth: 300 }}>
                      <h3 style={{ marginTop: 0, color: C.teal, display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800 }}>🧮 Simulador de Retorno</h3>
                      <p style={{ color: C.slate, fontSize: 16, margin: '15px 0 30px 0' }}>Descubre tu beneficio ajustando la estimación de familias.</p>
                      <div style={{ background: '#f8fafc', padding: '20px 25px', borderRadius: 12, border: `1px solid ${C.muted}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ fontWeight: 700, color: C.navy }}>Familias estimadas</span><span style={{ fontWeight: 800, color: C.teal }}>{probabilidad}%</span></div>
                        <input type="range" min="10" max="100" step="5" value={probabilidad} onChange={e => setProbabilidad(+e.target.value)} style={{ width: '100%', cursor: 'pointer', accentColor: C.teal }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', alignItems: 'center' }}>
                      <KPI label="Beneficio Estimado" value={fmt(calc.activeSchoolBenefit)} accent />
                      {pricingModel === 'global' && calc.rap > 0 && <KPI label="Rappel Garantizado" value={fmt(calc.rap)} sub="Por mejora de condiciones" color={C.coral} />}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'resumen' && (
              <div style={{ animation: 'fadeIn 0.3s' }}>
                {!isC && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 25 }}>
                    <KPI label="Facturación Estimada" value={fmt(calc.tv)} sub={`De ${Math.round(calc.totalAlumnos * (probabilidad/100))} compras`} icon="💰" />
                    <KPI label="Total Costes Centro" value={fmt(calc.tcc + calc.totalCostOp)} sub={`Material: ${fmt(calc.tcc)}`} icon="📉" color={C.slate} />
                    <KPI label="Beneficio Colegio" value={fmt(calc.activeSchoolBenefit)} sub={pricingModel === 'global' ? "Comisión + Rappel" : "Margen directo"} icon="🏫" accent />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 25 }}>
                  <div style={sty.card}>
                    <h3 style={{ marginTop: 0, fontSize: 20, color: C.navy, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 25 }}>Ventas por Editorial</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={calc.prov.map(p => ({ name: sh(p.p), Venta: Math.round(p.tv) }))} layout="vertical" margin={{ left: 10 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 13, fill: C.slate, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={v => fmt(v)} />
                        <Bar dataKey="Venta" fill={C.blue} radius={[0, 8, 8, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={sty.card}>
                    <h3 style={{ marginTop: 0, fontSize: 20, color: C.navy, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 25 }}>Distribución</h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie data={calc.prov.map((p,i) => ({ name: sh(p.p), value: Math.round(p.tv), fill: C.ch[i%C.ch.length] }))} dataKey="value" cx="50%" cy="50%" innerRadius={75} outerRadius={110} paddingAngle={3} />
                        <Tooltip formatter={v => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {tab === 'detalle' && (
              <div style={{...sty.card, animation: 'fadeIn 0.3s'}}>
                {isC && (
                  <div style={{ display: 'flex', gap: 15, alignItems: 'center', background: '#f8fafc', padding: 20, borderRadius: 16, border: `1px solid ${C.muted}`, marginBottom: 25, flexWrap: 'wrap' }}>
                    <span style={{fontWeight: 800, color: C.navy, fontSize: 15}}>➕ Añadir ISBN Manual:</span>
                    <input value={manualIsbn} onChange={e=>setManualIsbn(e.target.value)} placeholder="Ej: 9788411826617" style={{...sty.input, width: 200}} />
                    <input type="number" value={manualAlumnos} onChange={e=>setManualAlumnos(e.target.value)} placeholder="Alumnos" style={{...sty.input, width: 100}} />
                    <button onClick={handleAddManualIsbn} disabled={isManualLoading} style={{...sty.btn, background: C.teal}}>{isManualLoading ? "Buscando..." : "Buscar e Incorporar"}</button>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 20, color: C.navy, fontWeight: 800 }}>Listado Oficial ({calc.t})</h3>
                  <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...sty.input, width: 300 }} />
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 600, borderRadius: 12, border: `1px solid ${C.muted}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '15px 20px', color: C.slate }}>ISBN</th>
                        <th style={{ padding: '15px 20px', color: C.slate }}>Título</th>
                        <th style={{ padding: '15px 20px', color: C.slate }}>PVP</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', color: C.teal }}>Est. ({probabilidad}%)</th>
                        <th style={{ padding: '15px 20px', textAlign: 'right', color: C.slate }}>Venta Estimada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.muted}`, background: i % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                          <td style={{ padding: '15px 20px', fontFamily: 'monospace', color: C.slate }}>{r.isbn}</td>
                          <td style={{ padding: '15px 20px', fontWeight: 600, color: C.navy }}>{r.titulo}</td>
                          <td style={{ padding: '15px 20px', color: C.navy, whiteSpace: 'nowrap' }}>{fmt(r.pvp)}</td>
                          <td style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 800, color: C.teal }}>{Math.round(r.alumsEstimados)}</td>
                          <td style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 800, color: C.navy, whiteSpace: 'nowrap' }}>{fmt(r.tv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'editoriales' && (
              <div style={{...sty.card, animation: 'fadeIn 0.3s'}}>
                {pricingModel === 'global' ? (
                  <>
                    <h3 style={{ marginTop: 0, fontSize: 24, color: C.navy, fontWeight: 800 }}>Descuentos y Rappel</h3>
                    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${C.muted}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                          <tr style={{ textAlign: 'left' }}>
                            <th style={{ padding: '20px 25px', color: C.slate }}>Proveedor Principal</th>
                            <th style={{ padding: '20px 25px', textAlign: 'center', color: C.slate }}>DTO {BRAND.name}</th>
                            <th style={{ padding: '20px 25px', textAlign: 'center', color: C.teal }}>Tu Descuento Actual</th>
                            <th style={{ padding: '20px 25px', textAlign: 'right', color: C.coral }}>Rappel a tu favor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(colDtos).sort().map((prov, i) => {
                            const d = colDtos[prov];
                            const dif = d.col > d.scho;
                            const provCalc = calc.prov.find(p => p.p === prov);
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                                <td style={{ padding: '20px 25px', fontWeight: 700, color: C.navy }}>{sh(prov)}</td>
                                <td style={{ padding: '20px 25px', textAlign: 'center', color: C.slate }}>{d.scho}%</td>
                                <td style={{ padding: '20px 25px', textAlign: 'center' }}>
                                  <input type="number" value={d.col} onChange={e => setColDtos(p => ({ ...p, [prov]: { ...p[prov], col: +e.target.value } }))} style={{ width: 55, border: 'none', outline: 'none', textAlign: 'center', fontWeight: '800', fontSize: 18, color: dif ? C.teal : C.navy, background: 'transparent' }} />%
                                </td>
                                <td style={{ padding: '20px 25px', textAlign: 'right', fontWeight: 800, color: (provCalc?.rap || 0) > 0 ? C.coral : C.slate }}>{fmt(provCalc?.rap || 0)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ marginTop: 0, fontSize: 24, color: C.navy, fontWeight: 800 }}>Beneficio Directo por Editorial</h3>
                    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${C.muted}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                          <tr style={{ textAlign: 'left' }}>
                            <th style={{ padding: '20px 25px', color: C.slate }}>Proveedor Principal</th>
                            <th style={{ padding: '20px 25px', textAlign: 'right', color: C.slate }}>Venta Estimada</th>
                            <th style={{ padding: '20px 25px', textAlign: 'center', color: C.teal }}>% Margen Colegio</th>
                            <th style={{ padding: '20px 25px', textAlign: 'right', color: C.coral }}>Beneficio Colegio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calc.prov.map((p, i) => {
                            const edMarginPct = parseFloat(editorialMargins[p.p]) || 0;
                            const benCol = p.tv * (edMarginPct / 100);
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                                <td style={{ padding: '20px 25px', fontWeight: 700, color: C.navy }}>{sh(p.p)}</td>
                                <td style={{ padding: '20px 25px', textAlign: 'right', color: C.navy }}>{fmt(p.tv)}</td>
                                <td style={{ padding: '20px 25px', textAlign: 'center', fontWeight: 800, color: C.teal }}>{edMarginPct}%</td>
                                <td style={{ padding: '20px 25px', textAlign: 'right', fontWeight: 800, color: C.coral }}>{fmt(benCol)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}