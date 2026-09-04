import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="contenido" className="public-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">CBTA 241</div>
          <h1>Página no encontrada</h1>
          <p>La dirección solicitada no existe o ya no está disponible.</p>
          <Link className="btn btn-primary" href="/">Volver al inicio</Link>
        </div>
      </section>
    </main>
  );
}
