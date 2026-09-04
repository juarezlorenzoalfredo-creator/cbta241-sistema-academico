import Image from 'next/image';
import Link from 'next/link';

export function PublicHeader() {
  return <>
    <div className="brand-strip" aria-hidden="true" />
    <header className="public-header">
      <Link className="brand" href="/" aria-label="CBTA 241, inicio">
        <Image src="/institution/cbta241-logo.png" alt="Escudo del CBTA 241" width={56} height={56} priority />
        <div className="brand-copy"><strong>CBTA 241</strong><span>Sistema Académico Digital</span></div>
      </Link>
      <Link className="btn btn-primary" href="/login">Ingresar</Link>
    </header>
  </>;
}
