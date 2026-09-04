import Link from 'next/link';
import { requestPasswordResetAction } from '@/app/actions';

export default async function RecoveryPage({searchParams}:{searchParams:Promise<{sent?:string,error?:string}>}) {
  const params=await searchParams;
  return <main id="contenido" className="login-stage" style={{gridTemplateColumns:'minmax(0,1fr)',maxWidth:'520px'}}>
    <section className="login-panel">
      <div className="eyebrow">Recuperación segura</div><h1 style={{fontSize:'2rem'}}>Restablecer contraseña</h1>
      {params.sent && <div className="alert">Si el correo existe y está habilitado, recibirás instrucciones para continuar.</div>}
      {params.error && <div className="alert alert-danger">{params.error}</div>}
      <form action={requestPasswordResetAction}><div className="field"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" required /></div><button className="btn btn-primary" style={{width:'100%'}}>Enviar instrucciones</button></form>
      <p className="form-note"><Link href="/login">← Volver a iniciar sesión</Link></p>
    </section>
  </main>;
}
