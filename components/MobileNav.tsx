'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export type PortalNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
};

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

export function MobileNav({ nav }: { nav: PortalNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primaryItems = nav.length <= 4 ? nav : nav.slice(0, 3);
  const overflowItems = nav.length <= 4 ? [] : nav.slice(3);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <nav className="mobile-bar" aria-label="Navegación móvil">
        {primaryItems.map((item) => {
          const current = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? 'page' : undefined}
              onClick={() => setOpen(false)}
              style={current ? { background: 'rgba(255,255,255,.12)', color: 'white' } : undefined}
            >
              {item.shortLabel ?? item.label}
            </Link>
          );
        })}
        {overflowItems.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-overflow-menu"
            style={{
              minHeight: 64,
              border: 0,
              background: open ? 'rgba(255,255,255,.12)' : 'transparent',
              color: 'white',
              padding: '.4rem',
              fontSize: '.69rem',
              textAlign: 'center',
              fontWeight: 700
            }}
          >
            Más
          </button>
        )}
      </nav>

      {open && overflowItems.length > 0 && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú de navegación"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: '0 0 64px 0',
              zIndex: 55,
              border: 0,
              background: 'rgba(18, 31, 20, .45)'
            }}
          />
          <section
            id="mobile-overflow-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Más módulos"
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 64,
              zIndex: 60,
              maxHeight: '72vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              borderRadius: '18px 18px 0 0',
              boxShadow: '0 -18px 45px rgba(0,0,0,.22)',
              padding: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '.75rem' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--institution-green-deep)' }}>Más módulos</strong>
                <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Todos los accesos de tu perfil permanecen disponibles.</span>
              </div>
              <button type="button" className="btn" onClick={() => setOpen(false)} aria-label="Cerrar más módulos">
                Cerrar
              </button>
            </div>
            <nav aria-label="Módulos adicionales" style={{ display: 'grid', gap: '.45rem' }}>
              {overflowItems.map((item) => {
                const current = isCurrentPath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 48,
                      padding: '.7rem .85rem',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: current ? 'var(--surface-muted)' : 'white',
                      color: 'var(--institution-green-deep)',
                      fontWeight: 800
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </section>
        </>
      )}
    </>
  );
}
