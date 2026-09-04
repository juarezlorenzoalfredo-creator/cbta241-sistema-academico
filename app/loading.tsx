export default function GlobalLoading() {
  return (
    <main id="contenido" className="public-page">
      <section className="hero" aria-busy="true" aria-live="polite">
        <div className="hero-copy">
          <div className="eyebrow">CBTA 241 · Sistema Académico Digital</div>
          <h1>Cargando información…</h1>
          <p>Estamos preparando la vista solicitada.</p>
        </div>
      </section>
    </main>
  );
}
