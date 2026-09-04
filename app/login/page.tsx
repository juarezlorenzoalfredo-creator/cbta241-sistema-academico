import Image from 'next/image';
import Link from 'next/link';
import { signInAction } from '@/app/actions';

export const metadata = { title: 'Ingresar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?: string}> }) {
  const { error } = await searchParams;
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return <main id="contenido" className="login-stage">
    <section className="login-context">
      <div className="brand" style={{marginBottom:'2rem'}}>
        <Image src="/institution/cbta241-logo.png" alt="Escudo CBTA 241" width={82} height={82}/>
        <div className="brand-copy"><strong>CBTA 241</strong><span>Centro de Bachillerato Tecnológico Agropecuario No. 241</span></div>
      </div>
      <div className="hero-kicker">Acceso institucional</div>
      <h1>Un sistema para cada momento académico.</h1>
      <p>Alumnos consultan únicamente su información. Docentes trabajan sobre sus asignaciones. Control Escolar conserva la integridad del proceso.</p>
    </section>
    <section className="login-panel" aria-labelledby="login-title">
      <div className="eyebrow">Sistema Académico Digital</div>
      <h2 id="login-title" style={{fontSize:'1.8rem',margin:'.5rem 0'}}>Ingresar</h2>
      <p className="form-note">Usa las credenciales asignadas por la institución.</p>
      {!configured && <div className="alert">La aplicación está en modo de preparación: configura las variables de Supabase indicadas en <code>.env.example</code>.</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form action={signInAction}>
        <div className="field"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
        <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} /></div>
        <button className="btn btn-primary" type="submit" style={{width:'100%',marginTop:'.5rem'}} disabled={!configured}>Ingresar</button>
      </form>
      <p className="form-note" style={{marginTop:'1rem'}}><Link href="/recuperar" style={{color:'var(--institution-green)',fontWeight:800}}>¿Olvidaste tu contraseña?</Link></p>
      <p className="form-note"><Link href="/">← Volver al portal</Link></p>
    </section>
  </main>;
}
