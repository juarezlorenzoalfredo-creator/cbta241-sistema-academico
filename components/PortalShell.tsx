import Image from 'next/image';
import Link from 'next/link';
import { signOutAction } from '@/app/actions';
import type { AuthContext } from '@/lib/auth/session';
import { MobileNav, type PortalNavItem } from '@/components/MobileNav';

export type { PortalNavItem } from '@/components/MobileNav';

export function PortalShell({context, roleLabel, nav, children}: {
  context: AuthContext;
  roleLabel: string;
  nav: PortalNavItem[];
  children: React.ReactNode;
}) {
  const currentPrefix = nav[0]?.href ?? '/';
  return <div className="portal">
    <aside className="rail" aria-label="Navegación principal">
      <Link className="rail-brand" href={currentPrefix}>
        <Image src="/institution/cbta241-logo.png" alt="Escudo CBTA 241" width={50} height={50}/>
        <div><strong>CBTA 241</strong><span>AgroTech Académico</span></div>
      </Link>
      <nav>{nav.map((item)=><Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      <div className="rail-footer">
        <div><strong>{context.displayName}</strong><br/>{roleLabel}</div>
        <form action={signOutAction}><button className="signout" type="submit">Cerrar sesión</button></form>
      </div>
    </aside>
    <section className="workspace">
      <header className="workspace-top">
        <div className="identity"><strong>{roleLabel}</strong><span>{context.email ?? 'Sesión institucional'}</span></div>
        <div className="badge">Sesión protegida</div>
      </header>
      <main id="contenido" className="main">{children}</main>
    </section>
    <MobileNav nav={nav}/>
  </div>;
}
