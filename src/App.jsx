import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// ── CONFIGURACIÓN DE MARCA (La sección que faltaba) ──
const BRAND = {
  name: "SCHOLARUM",
  primary: "#1b6b93",    // Azul corporativo
  secondary: "#00897b",  // Teal
  accent: "#e5a100",     // Dorado/Oro
  bg: "#f4f6fa",
  card: "#ffffff"
};

const API = "https://script.google.com/macros/s/AKfycbwCYoLIusztmA7AXeEx8HnVprZoQJFMW-vIslvmgFNdvzt_NoY5d8w9nNOLP2btQ0b0/exec";

// Colores derivados de BRAND
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

// ── SMART PARSER: Extracción de ISBN y Alumnos ──
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

// ── API CALL (Corregida para evitar "Failed to Fetch") ──
async function apiCall(action, params = {}) {
  const url = new URL(API);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    // FIX: No codificamos dos veces el JSON
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

  // ── CARGA INICIAL ──
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
      setStep(2);
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
    } catch (e) { alert('Error al guardar: ' + e.message); }
    finally { setSaving(false); }
  }, [editableData, nombre, costePapel, costeDigital, colDtos]);

  // ── MOTOR DE CÁLCULO (Ajustado al Excel) ──
  const calc = useMemo(() => {
    if (!editableData?.found) return null;
    const rows = editableData.found.map(book => {
      const coste = book.coste; // Precio Compra Sin IVA real del Master DB
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

      return { ...book, tv, tcs, tcc, costOp, rap: tcs - tcc, dtoScho, dtoCol };
    });

    const tv = rows.reduce((s, r) => s + r.tv, 0);
    const tcs = rows.reduce((s, r) => s + r.tcs, 0);
    const tcc = rows.reduce((s, r) => s + r.tcc, 0);
    const totalCostOp = rows.reduce((s, r) => s + r.costOp, 0);
    const rap = tcs - tcc;
    
    // Beneficio Colegio = (Venta - Coste Colegio - Coste Op Scholarum)
    const benColegio = tv - tcc - totalCostOp;

    return { rows, tv, tcs, tcc, totalCostOp, rap, benColegio, t: rows.length };
  }, [editableData, colDtos, costePapel, costeDigital]);

  // ... (Aquí iría el resto del componente Visual: Header, KPIs, Tablas)
  return (
    <div style={{ background: C.light, minHeight: '100vh', fontFamily: 'Outfit, sans-serif' }}>
        {/* Tu interfaz visual aquí usando las constantes de BRAND */}
        <h1 style={{ color: C.blue }}>{BRAND.name} - Simulacro</h1>
        {/* Renderizado de steps y tablas... */}
    </div>
  );
}
