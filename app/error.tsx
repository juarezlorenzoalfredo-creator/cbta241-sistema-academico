'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('CBTA241_UI_ERROR', { digest: error.digest ?? null });
  }, [error]);

  return (
    <main id="contenido" className="public-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Incidencia controlada</div>
          <h1>No fue posible cargar esta sección</h1>
          <p>La aplicación no mostrará detalles internos del error. Puedes intentar nuevamente.</p>
          {error.digest && <p className="secondary">Error ID: {error.digest}</p>}
          <button className="btn btn-primary" onClick={reset}>Reintentar</button>
        </div>
      </section>
    </main>
  );
}
