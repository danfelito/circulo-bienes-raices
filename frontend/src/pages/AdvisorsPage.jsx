import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, FileSignature, MessageSquareText } from 'lucide-react';

const COMMISSIONS_PATH = '/comisiones/';

export default function AdvisorsPage() {
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const [manualText, setManualText] = useState('');
  const manualRef = useRef(null);
  const link = new URL(COMMISSIONS_PATH, window.location.origin).href;
  const message = `Te comparto la Política de Comisiones y Honorarios Profesionales de Círculo Internacional de Bienes Raíces. Puedes consultarla y completar tus datos aquí:\n${link}`;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Asesores | Círculo Internacional de Bienes Raíces';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (manualText) {
      manualRef.current?.focus();
      manualRef.current?.select();
    }
  }, [manualText]);

  async function copy(text, kind) {
    setCopied('');
    setNotice('');
    setManualText('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setNotice(kind === 'link' ? 'Enlace copiado. Ya puedes pegarlo en tus redes.' : 'Mensaje copiado. Ya puedes pegarlo y compartirlo.');
    } catch {
      setManualText(text);
      setNotice('Selecciona y copia el texto de abajo para compartirlo.');
    }
  }

  return (
    <main className="advisors-page min-h-screen px-5 pb-24 pt-32 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="advisors-eyebrow">Círculo Internacional</p>
        <h1 className="mt-3 font-heading text-5xl italic sm:text-6xl">Asesores</h1>
        <p className="advisors-muted mt-5 max-w-xl text-base leading-relaxed">Documentos y enlaces para compartir con tus clientes.</p>

        <article className="advisors-card mt-10 p-6 sm:p-9" aria-labelledby="commissions-title">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="advisors-icon"><FileSignature size={30} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <h2 id="commissions-title" className="font-heading text-3xl sm:text-4xl">Firma de comisiones</h2>
              <p className="advisors-muted mt-3 max-w-2xl text-base leading-relaxed">Política de comisiones y honorarios profesionales para operaciones de compraventa y arrendamiento.</p>
              <a href={COMMISSIONS_PATH} target="_blank" rel="noreferrer" className="advisors-open mt-5 inline-flex items-center gap-2 font-semibold">
                Abrir formulario <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="advisors-share mt-8 pt-7">
            <label htmlFor="commissions-link" className="mb-3 block text-sm font-semibold">Enlace para compartir</label>
            <input id="commissions-link" className="advisors-link w-full rounded-xl px-4 py-3 text-base" value={link} readOnly onFocus={event => event.target.select()} />
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="advisors-button advisors-button-primary" onClick={() => copy(link, 'link')}>
                {copied === 'link' ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />} Copiar enlace
              </button>
              <button type="button" className="advisors-button advisors-button-secondary" onClick={() => copy(message, 'message')}>
                {copied === 'message' ? <Check size={18} aria-hidden="true" /> : <MessageSquareText size={18} aria-hidden="true" />} Copiar mensaje con enlace
              </button>
            </div>
            <p className="advisors-muted mt-4 min-h-6 text-sm" role="status" aria-live="polite">{notice}</p>
            {manualText && <textarea ref={manualRef} aria-label="Texto para copiar manualmente" className="advisors-link mt-2 w-full rounded-xl p-4 text-base" rows={4} readOnly value={manualText} />}
          </div>
        </article>
      </div>
    </main>
  );
}
