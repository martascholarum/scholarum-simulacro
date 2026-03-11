import { BRAND, C } from "../config/constants";
import { LogoHoverLink } from "./UI";

export function Header({ nombre, isAuthenticated, step, isC, setViewMode, handleNewProposal }) {
  return (
    <div style={{ padding: '20px 20px 0 20px', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 20, padding: '12px 30px', maxWidth: 1200, margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05), 0 0 0 1px rgba(15,23,42,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          {BRAND.companyLogo ? (
            <img src={BRAND.companyLogo} alt={BRAND.name} style={{ height: 35, objectFit: 'contain', padding: 2 }} />
          ) : (
            <div style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.teal})`, color: '#fff', fontWeight: 900, fontSize: 20, padding: '4px 12px', borderRadius: 8 }}>D.</div>
          )}
          <div style={{ borderLeft: `1px solid ${C.muted}`, paddingLeft: 15, marginLeft: 5 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: C.slate, textTransform: 'uppercase', marginBottom: 2 }}>LA TIENDA DEL COLE</div>
            {/* MEJORA 4: Título cambiado a TEST MEJORAS */}
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy, letterSpacing: '-0.3px' }}>{nombre ? `Propuesta: ${nombre}` : "TEST MEJORAS"}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAuthenticated && (
            <button onClick={handleNewProposal} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: C.blue, color: '#fff', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: 13, boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>➕ Nueva Propuesta</button>
          )}
          {isAuthenticated && step >= 2 && step !== 3 && (
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 10, border: `1px solid ${C.muted}` }}>
              <button onClick={() => setViewMode('comercial')} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: isC ? '#fff' : 'transparent', color: isC ? C.navy : C.slate, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 13, boxShadow: isC ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>🔧 Comercial</button>
              <button onClick={() => setViewMode('colegio')} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: !isC ? '#fff' : 'transparent', color: !isC ? C.navy : C.slate, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 13, boxShadow: !isC ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>🏫 Vista Cliente</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <div style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '50px 20px 40px', marginTop: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 20, padding: '30px', gap: 40, boxShadow: '0 10px 25px rgba(0,0,0,0.02)' }}>
          <div style={{ borderRight: '1px solid #f1f5f9', paddingRight: 40 }}>
            <a href="https://www.scholarum.es" target="_blank" rel="noreferrer"><img src="https://www.scholarum.es/wp-content/uploads/footer/logo-scholarum.svg" alt="Scholarum" style={{ height: 45 }} /></a>
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
        <p style={{ textAlign: 'center', color: C.slate, fontSize: 14, marginTop: 30, fontWeight: 500 }}>© Copyright {new Date().getFullYear()} | Scholarum Educación. Todos los derechos reservados.</p>
      </div>
    </div>
  );
}