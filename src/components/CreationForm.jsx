import { C, COMERCIALES, sty } from "../config/constants";

export function CreationForm({ comercialName, setComercialName, nombre, setNombre, responsable, setResponsable, logoUrl, setLogoUrl, inputText, setInputText, fileRef, handleFile, error, handleCruzar }) {
  return (
    <div style={{...sty.card, animation: 'fadeIn 0.4s ease-out'}}>
      <h2 style={{ marginTop: 0, fontSize: 24, color: C.navy, borderBottom: `1px solid ${C.muted}`, paddingBottom: 20, fontWeight: 800 }}>Crear Nueva Propuesta</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 30, background: '#f8fafc', padding: 25, borderRadius: 16, border: `1px solid ${C.muted}` }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: C.navy }}>👤 Comercial Responsable</label>
          <select style={{...sty.input}} value={comercialName} onChange={e => setComercialName(e.target.value)}>
            <option value="">Selecciona tu nombre...</option>
            {COMERCIALES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
        <button onClick={handleCruzar} disabled={!inputText.trim() || !comercialName} style={{ ...sty.btn, opacity: (inputText.trim() && comercialName) ? 1 : 0.5, fontSize: 16, padding: '14px 32px' }}>
          {!comercialName ? "Selecciona comercial para continuar" : "Cruzar datos y generar →"}
        </button>
      </div>
    </div>
  );
}