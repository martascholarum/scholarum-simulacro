import { C, BRAND, sty } from "../config/constants";

export function AuthScreens({ step, pinInput, setPinInput, handleLogin }) {
  if (step === 98) {
    return (
      <div style={{ ...sty.card, maxWidth: 450, margin: '60px auto', textAlign: 'center', borderTop: `4px solid ${C.blue}` }}>
        <div style={{ fontSize: 45, marginBottom: 15 }}>🔐</div>
        <h2 style={{ color: C.navy, margin: '0 0 10px 0', fontSize: 26, fontWeight: 800 }}>Acceso Empleado</h2>
        <p style={{ color: C.slate, fontSize: 15, marginBottom: 25 }}>Introduce el PIN maestro para gestionar propuestas.</p>
        <input type="password" placeholder="••••" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...sty.input, textAlign: 'center', fontSize: 28, letterSpacing: 10, marginBottom: 20, padding: '15px' }} />
        <button onClick={handleLogin} style={{ ...sty.btn, width: '100%', fontSize: 16, padding: '14px' }}>Acceder al Sistema</button>
      </div>
    );
  }
  
  if (step === 99) {
    return (
      <div style={{ ...sty.card, maxWidth: 450, margin: '60px auto', textAlign: 'center', borderTop: `4px solid ${C.teal}` }}>
        <div style={{ fontSize: 45, marginBottom: 15 }}>🔒</div>
        <h2 style={{ color: C.navy, margin: '0 0 10px 0', fontSize: 26, fontWeight: 800 }}>Propuesta Privada</h2>
        <p style={{ color: C.slate, fontSize: 15, marginBottom: 25 }}>Por favor, introduce la contraseña proporcionada por tu asesor comercial de {BRAND.name}.</p>
        <input type="password" placeholder="Ej: A1B2C3" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...sty.input, textAlign: 'center', fontSize: 24, letterSpacing: 6, marginBottom: 20, textTransform: 'uppercase', padding: '15px' }} />
        <button onClick={handleLogin} style={{ ...sty.btn, width: '100%', background: `linear-gradient(to bottom, ${C.teal}, #0f766e)`, boxShadow: '0 4px 6px -1px rgba(13,148,136,0.2)', fontSize: 16, padding: '14px' }}>Ver Propuesta</button>
      </div>
    );
  }

  return null;
}