export const fmt = n => (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
export const sh = p => (p || '').replace(/Comercial (de ediciones |Grupo )/g, '').replace(/ S\.A\.U?\./g, '').replace(/ SL$/,'').replace(/ S\.L\.U?\./g,'').replace(/Ediciones /,'').replace(/Editorial /,'');

export function setFavicon(faviconUrl) {
  document.title = `La Tienda del Cole | Propuestas`;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.href = faviconUrl;
}

export function injectClarity(id) {
  if (!id || typeof window === 'undefined') return;
  (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];
      if(y && y.parentNode) y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", id);
}

// Normaliza un nombre de curso para comparación flexible
// Quita º/ª, "de", "Educación"/"Educacion", y espacios extra
// Así "4 Primaria" === "4º de Educación Primaria" tras normalizar
const normCurso = s => s.toLowerCase()
  .replace(/[ºª°]/g, '')
  .replace(/\b(de|educaci[oó]n)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export function parseInput(text, asignarPorCurso = false, cursosDisponibles = []) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  const invalid = [];
  let currentCursoDetectado = null; // curso activo según el último encabezado detectado

  const findCurso = (str) => {
    if (!cursosDisponibles.length) return null;
    const norm = normCurso(str);
    return cursosDisponibles.find(c => norm.includes(normCurso(c))) || null;
  };

  for (const line of lines) {
    let lineWithoutHyphens = line.replace(/-/g, '');
    const isbns = lineWithoutHyphens.match(/(?:97[89])?\d{9}[\dX]/gi);

    if (!isbns) {
      // Línea sin ISBN: comprobar si es un encabezado de curso
      const cursoEncontrado = findCurso(line);
      if (cursoEncontrado) {
        currentCursoDetectado = cursoEncontrado;
      } else if (/\d/.test(line) && line.length > 3 && line.length < 30) {
        invalid.push(line);
      }
      continue;
    }

    // Detectar curso solo en el texto POSTERIOR al último ISBN de la línea.
    // Así "Matemáticas 1º ESO  978..." no contamina, pero "978...  2º ESO" sí funciona.
    const lastIsbnMatch = [...lineWithoutHyphens.matchAll(/(?:97[89])?\d{9}[\dX]/gi)].pop();
    const textAfterIsbns = lastIsbnMatch
      ? lineWithoutHyphens.slice(lastIsbnMatch.index + lastIsbnMatch[0].length)
      : '';
    const cursoInline = findCurso(textAfterIsbns);
    const cursoDeEstaLinea = cursoInline || currentCursoDetectado;

    let cleanLine = lineWithoutHyphens;
    isbns.forEach(i => { cleanLine = cleanLine.replace(i, ' '); });
    // Quitar también el nombre del curso del contexto para no ensuciarlo
    if (cursoDeEstaLinea) cleanLine = cleanLine.replace(new RegExp(cursoDeEstaLinea.replace(/[ºª]/g, '.?'), 'gi'), ' ');

    const numbers = [];
    const numRe = /\b(\d{1,3})\b/g;
    let m;
    while ((m = numRe.exec(cleanLine)) !== null) {
      const val = parseInt(m[1]);
      if (val > 0 && val < 1000) numbers.push(val);
    }

    let contextText = cleanLine;
    numbers.forEach(n => { contextText = contextText.replace(new RegExp(`\\b${n}\\b`), ' '); });
    contextText = contextText.replace(/\s+/g, ' ').trim();

    for (let idx = 0; idx < isbns.length; idx++) {
      let isbn = isbns[idx].toUpperCase();
      if (isbn.length === 10) isbn = '978' + isbn;

      // Si hay curso detectado o el modo cursos está activo, ignoramos unidades y ponemos 1
      const alumnos = (asignarPorCurso || cursoDeEstaLinea) ? 1 : (idx < numbers.length ? numbers[idx] : (numbers.length === 1 ? numbers[0] : 1));

      let existing = entries.find(e => e.isbn === isbn);
      if (existing) {
        existing.alumnos += alumnos;
        if (contextText && !existing.context) existing.context = contextText;
        if (cursoDeEstaLinea && !existing.cursoDetectado) existing.cursoDetectado = cursoDeEstaLinea;
      } else {
        entries.push({ isbn, alumnos, context: contextText, cursoDetectado: cursoDeEstaLinea });
      }
    }
  }
  return { entries, invalid };
}

export function generatePIN() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 6; i++) pin += chars.charAt(Math.floor(Math.random() * chars.length));
  return pin;
}

export function refreshDtosReal(foundArray, currentDtos) {
  const dtos = {};
  foundArray.forEach(b => {
    // MEJORA 5: "Otros" en lugar de "Sin proveedor"
    const prov = b.proveedor || 'Otros';
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