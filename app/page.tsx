import Image from 'next/image';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';

export default function HomePage() {
  return <div className="public-shell">
    <PublicHeader />
    <main id="contenido" className="hero">
      <section>
        <div className="hero-kicker">AgroTech Académico · CBTA 241</div>
        <h1>Tu trayectoria académica, <em>clara y protegida.</em></h1>
        <p>Plataforma institucional para captura, publicación y consulta de calificaciones, seguimiento académico, extraordinarios y documentos oficiales con trazabilidad.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/login">Acceder al sistema</Link>
          <Link className="btn btn-ghost" href="/verificar">Verificar documento</Link>
        </div>
      </section>
      <aside className="hero-mark" aria-label="Identidad institucional">
        <Image src="/institution/cbta241-logo.png" alt="Escudo oficial del Centro de Bachillerato Tecnológico Agropecuario No. 241" width={500} height={500} priority />
      </aside>
    </main>
    <footer className="footer">Centro de Bachillerato Tecnológico Agropecuario No. 241 · Plataforma académica institucional</footer>
  </div>;
}
