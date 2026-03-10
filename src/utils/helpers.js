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

export function parseInput(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  const invalid = []; 
  
  for (const line of lines) {
    let lineWithoutHyphens = line.replace(/-/g, ''); 
    const isbns = lineWithoutHyphens.match(/(?:97[89])?\d{9}[\dX]/gi); 
    
    if (!isbns) {
      if (/\d/.test(line) && line.length > 3 && line.length < 30) invalid.push(line);
      continue;
    }
    
    let cleanLine = lineWithoutHyphens;
    isbns.forEach(i => { cleanLine = cleanLine.replace(i, ' '); });
    const numbers = [];
    const numRe = /\b(\d{1,3})\b/g;
    let m;
    while ((m = numRe.exec(cleanLine)) !== null) {
      const val = parseInt(m[1]);
      if (val > 0 && val < 1000) numbers.push(val);
    }
    
    for (let idx = 0; idx < isbns.length; idx++) {
      let isbn = isbns[idx].toUpperCase();
      if (isbn.length === 10) isbn = '978' + isbn; 
      const alumnos = idx < numbers.length ? numbers[idx] : (numbers.length === 1 ? numbers[0] : 0);
      
      let existing = entries.find(e => e.isbn === isbn);
      if (existing) existing.alumnos += alumnos;
      else entries.push({ isbn, alumnos, curso: '' });
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