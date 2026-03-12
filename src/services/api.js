import { API, AZURE_API_URL, AZURE_API_KEY } from '../config/constants';

export async function apiCall(action, data = {}) {
  // --- NUEVA RUTA RÁPIDA (AZURE) SOLO PARA CRUZAR ISBNs ---
  if (action === 'cruzar') {
    // 1. Desempaquetamos los ISBNs y los alumnos que nos manda App.jsx
    const pairs = (data.isbns || '').split(',');
    const isbnArray = [];
    const alumnosMap = {};
    
    pairs.forEach(p => {
      const [isbn, al] = p.split(':');
      if (isbn) {
        isbnArray.push(isbn);
        alumnosMap[isbn] = parseInt(al) || 1;
      }
    });

    // 2. Llamamos al Ferrari (Azure)
    const response = await fetch(AZURE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Oct8neAPIKey': AZURE_API_KEY
      },
      body: JSON.stringify({
        CampannaId: 2025,
        Isbns: isbnArray
      })
    });

    if (!response.ok) throw new Error("Error al conectar con el catálogo de Azure");
    const json = await response.json();

    // 3. Traducimos la respuesta de Azure al idioma de nuestra app
    const found = (json.Found || []).map(item => {
      // Calculamos el coste sumándole el IVA
      const costeConIva = item.PrecioCompraSinIva * (1 + (item.IvaAplicable / 100));
      
      return {
        isbn: item.Isbn,
        titulo: item.Titulo,
        pvp: item.PvpFinalConIva,
        coste: costeConIva,
        proveedor: item.EditorialNombre,
        dto: item.DtoCompra,
        formato: item.Formato === 1 ? 'Digital' : 'Papel', 
        alumnos: alumnosMap[item.Isbn] || 1 // Inyectamos los alumnos originales
      };
    });

    return { found, notFound: json.NotFound || [] };
  }

  // --- RUTA CLÁSICA (GOOGLE APPS SCRIPT) PARA GUARDAR Y CARGAR ---
  // Serializar objetos complejos como JSON strings, pero enviar en URLSearchParams (compatible con Apps Script)
  const dataToSend = { action };
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null) {
      dataToSend[key] = JSON.stringify(value);
    } else {
      dataToSend[key] = value;
    }
  }
  
  const params = new URLSearchParams(dataToSend);
  const req = await fetch(`${API}?${params.toString()}`, { method: 'POST' });
  const text = await req.text();
  try { return JSON.parse(text); } 
  catch { throw new Error(text); }
}