export function calculateBusinessModel({ editableData, colDtos, costePapel, costeDigital, probabilidad, pricingModel, editorialMargins }) {
  if (!editableData?.found) return null;
  const probSegura = parseFloat(probabilidad) || 0;
  const probFactor = probSegura / 100;

  const rows = editableData.found.map(book => {
    const coste = parseFloat(book.coste) || 0; 
    const pvp = parseFloat(book.pvp) || 0;
    const alumnos = parseFloat(book.alumnos) || 0;
    const dtoScho = parseFloat(book.dto) || 0;
    
    // MEJORA 5: "Otros"
    const provName = book.proveedor || 'Otros';
    const d = colDtos[provName] || { scho: dtoScho, col: dtoScho };
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
    
    const edMarginPct = parseFloat(editorialMargins[provName]) || 0;
    const bookSchoolMargin = tv * (edMarginPct / 100);

    return { ...book, pvp, alumnos, tv, tcs, tcc, costOp, rap: tcs - tcc, isPapel, alumsEstimados, bookSchoolMargin };
  });

  const tv = rows.reduce((s, r) => s + (r.tv || 0), 0);
  const tcs = rows.reduce((s, r) => s + (r.tcs || 0), 0);
  const tcc = rows.reduce((s, r) => s + (r.tcc || 0), 0);
  
  const totalCostOp = rows.reduce((s, r) => s + (r.costOp || 0), 0);
  const rap = tcs - tcc;
  const comision = tv - tcs - totalCostOp;
  
  const totalSchoolMarginEd = rows.reduce((s, r) => s + (r.bookSchoolMargin || 0), 0);

  const activeSchoolBenefit = pricingModel === 'global' ? (comision + rap) : totalSchoolMarginEd;
  const activeDeliberBenefit = pricingModel === 'global' ? totalCostOp : (tv - tcs - totalSchoolMarginEd);
  const activeDeliberMarginPct = tv > 0 ? ((activeDeliberBenefit / tv) * 100).toFixed(1) : 0;

  const bp = {};
  rows.forEach(r => {
    // MEJORA 5: "Otros"
    const k = r.proveedor || 'Otros';
    if (!bp[k]) bp[k] = { p: k, n: 0, tv: 0, tcs: 0, tcc: 0, costOp: 0, rap: 0 };
    bp[k].n++; bp[k].tv += r.tv; bp[k].tcs += r.tcs; bp[k].tcc += r.tcc; bp[k].costOp += r.costOp; bp[k].rap += r.rap;
  });
  const prov = Object.values(bp).map(p => ({ ...p, m: p.tv - p.tcs, ben: (p.tv - p.tcs - p.costOp) + p.rap })).sort((a,b) => b.tv - a.tv);
  const totalAlumnos = rows.reduce((s, r) => s + (r.alumnos || 0), 0);
  
  return { rows, prov, tv, tcs, tcc, totalCostOp, activeSchoolBenefit, activeDeliberBenefit, activeDeliberMarginPct, comision, rap, benColegio: (comision+rap), t: rows.length, totalAlumnos };
}