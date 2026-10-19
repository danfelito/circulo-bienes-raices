// Conserva sólo etiquetas de campaña; nunca guarda nombres, teléfonos ni correos.
const KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid'];
const STORAGE_KEY = 'circulo_campaign_attribution_v1';
const safeText = value => typeof value === 'string' ? value.slice(0, 180) : '';
const clean = obj => Object.fromEntries(Object.entries(obj).filter(([,value]) => value));

export const captureAttribution = () => {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const campaign = clean(Object.fromEntries(KEYS.map(key => [key, safeText(params.get(key))])));
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
    if (!Object.keys(campaign).length && stored.firstTouch) return;
    const touch = {
      ...campaign,
      landingPath: window.location.pathname.slice(0, 250),
      referrerHost: document.referrer ? new URL(document.referrer).hostname.slice(0, 180) : '',
    };
    const firstTouch = stored.firstTouch || touch;
    const lastTouch = Object.keys(campaign).length ? touch : (stored.lastTouch || touch);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({firstTouch,lastTouch}));
  } catch {
    // Storage puede estar deshabilitado; el formulario sigue funcionando.
  }
};

export const getAttribution = () => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
};

export const marketingEvent = (eventName, propertyId, extra = {}) => {
  if (typeof window === 'undefined') return;
  const detail = {event: eventName, property_id: propertyId, ...extra};
  if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
};
