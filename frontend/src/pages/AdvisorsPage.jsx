import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Clock3, LockKeyhole, MailCheck, ShieldCheck, Upload } from 'lucide-react';
import api from '../api';

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#d71920] focus:ring-4 focus:ring-red-100';

const AdvisorsPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('register');
  const [registerData, setRegisterData] = useState({ name: '', email: '', phone: '', password: '' });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const submitRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.registerAdvisor(registerData);
      setMessage({ type: 'success', text: result.message });
      setRegisterData({ name: '', email: '', phone: '', password: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.login(loginData.email, loginData.password);
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      navigate(result.user.role === 'admin' ? '/admin' : '/asesores/panel');
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pt-[78px]">
      <section className="bg-slate-950 py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
          <div className="self-center">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-red-400">Portal de asesores</span>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Publica propiedades desde un flujo profesional y conectado.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Solicita tu acceso. La administración recibe un correo para autorizarte y, una vez aprobado, podrás subir fotografías, videos y todos los detalles de cada inmueble.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { icon: MailCheck, title: '1. Solicitud', text: 'Registras tus datos.' },
                { icon: ShieldCheck, title: '2. Autorización', text: 'La empresa aprueba el acceso.' },
                { icon: Upload, title: '3. Publicación', text: 'La propiedad aparece en el catálogo.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                  <Icon className="text-red-400" />
                  <h2 className="mt-3 font-bold">{title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button onClick={() => { setMode('register'); setMessage(null); }} className={`rounded-lg px-4 py-3 text-sm font-bold ${mode === 'register' ? 'bg-white text-[#d71920] shadow-sm' : 'text-slate-600'}`}>Solicitar acceso</button>
              <button onClick={() => { setMode('login'); setMessage(null); }} className={`rounded-lg px-4 py-3 text-sm font-bold ${mode === 'login' ? 'bg-white text-[#d71920] shadow-sm' : 'text-slate-600'}`}>Iniciar sesión</button>
            </div>

            {message && (
              <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}

            {mode === 'register' ? (
              <form onSubmit={submitRegister} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Nombre completo</label>
                  <input className={fieldClass} required value={registerData.name} onChange={(event) => setRegisterData({ ...registerData, name: event.target.value })} placeholder="Nombre del asesor" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Correo</label>
                  <input className={fieldClass} type="email" required value={registerData.email} onChange={(event) => setRegisterData({ ...registerData, email: event.target.value })} placeholder="nombre@correo.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Teléfono</label>
                  <input className={fieldClass} value={registerData.phone} onChange={(event) => setRegisterData({ ...registerData, phone: event.target.value })} placeholder="+52 229..." />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Contraseña</label>
                  <input className={fieldClass} type="password" minLength={8} required value={registerData.password} onChange={(event) => setRegisterData({ ...registerData, password: event.target.value })} placeholder="Mínimo 8 caracteres" />
                </div>
                <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d71920] px-5 py-3.5 font-bold text-white transition hover:bg-[#b91319] disabled:opacity-60">
                  {loading ? <Clock3 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Enviar solicitud
                </button>
                <p className="text-center text-xs leading-5 text-slate-500">La solicitud será enviada a circulointernacionalveracruz1@gmail.com para autorización.</p>
              </form>
            ) : (
              <form onSubmit={submitLogin} className="mt-6 space-y-4">
                <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-900"><LockKeyhole className="mb-2 text-[#d71920]" /> Solo los asesores autorizados pueden ingresar al panel de publicación.</div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Correo</label>
                  <input className={fieldClass} type="email" required value={loginData.email} onChange={(event) => setLoginData({ ...loginData, email: event.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Contraseña</label>
                  <input className={fieldClass} type="password" required value={loginData.password} onChange={(event) => setLoginData({ ...loginData, password: event.target.value })} />
                </div>
                <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white transition hover:bg-[#d71920] disabled:opacity-60">
                  <Building2 size={18} /> Entrar al panel
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default AdvisorsPage;
