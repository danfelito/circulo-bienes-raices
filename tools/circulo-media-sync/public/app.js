const $ = selector => document.querySelector(selector);
const state = { properties: [], settings: {} };

const formatBytes = bytes => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const api = async (url, options = {}) => {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Ocurrió un error');
  return payload;
};
const showBusy = text => { $('#busyText').textContent = text; $('#busy').classList.remove('hidden'); };
const hideBusy = () => $('#busy').classList.add('hidden');
const notify = (message, error = false) => {
  const notice = $('#notice');
  notice.textContent = message;
  notice.className = `notice${error ? ' error-notice' : ''}`;
  window.setTimeout(() => notice.classList.add('hidden'), 7000);
};

const renderSummary = () => {
  const totalOriginal = state.properties.reduce((sum, item) => sum + (item.originalBytes || 0), 0);
  const totalOptimized = state.properties.reduce((sum, item) => sum + (item.optimizedBytes || 0), 0);
  const optimized = state.properties.filter(item => item.optimized).length;
  const synced = state.properties.filter(item => item.syncedAt).length;
  const saved = totalOptimized ? Math.max(0, 100 - (totalOptimized / totalOriginal * 100)) : 0;
  $('#summary').innerHTML = [
    ['Propiedades', state.properties.length],
    ['Optimizadas', optimized],
    ['Sincronizadas', synced],
    ['Ahorro preparado', totalOptimized ? `${saved.toFixed(1)} %` : '—'],
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
};

const statusLabel = status => ({ available: 'Disponible', reserved: 'Reservada', sold: 'Vendida', rented: 'Rentada' }[status] || status);

const renderProperties = () => {
  $('#catalogMessage').textContent = state.properties.length
    ? `${state.properties.length} propiedad${state.properties.length === 1 ? '' : 'es'} encontrada${state.properties.length === 1 ? '' : 's'}.`
    : state.settings.rootFolder ? 'No se encontraron carpetas con README.md.' : 'Selecciona una carpeta para comenzar.';
  $('#properties').innerHTML = state.properties.map(property => {
    const status = property.draft?.status || 'available';
    const savings = property.optimizedBytes && property.originalBytes
      ? Math.max(0, 100 - property.optimizedBytes / property.originalBytes * 100)
      : null;
    const syncText = property.syncedAt ? `Sincronizada ${new Date(property.syncedAt).toLocaleString('es-MX')}` : 'Aún no sincronizada';
    return `<article class="property ${property.error ? 'has-error' : ''}" data-id="${escapeHtml(property.sourceId)}">
      <div>
        <h3>${escapeHtml(property.draft?.title || property.folderName)}</h3>
        <div class="property-meta"><span>${escapeHtml(property.sourceId)}</span><span>${escapeHtml(property.draft?.city || 'Ciudad pendiente')}</span><span>${syncText}</span></div>
        <div class="badges"><span class="badge ${status}">${statusLabel(status)}</span><span class="badge">${property.draft?.published === false ? 'Oculta' : 'Publicada'}</span>${property.remote ? '<span class="badge">En portal</span>' : ''}</div>
        <div class="property-stats">
          <span><strong>${property.images}</strong> fotos</span><span><strong>${property.videos}</strong> videos</span>
          <span>Original: <strong>${formatBytes(property.originalBytes)}</strong></span>
          <span>Optimizado: <strong>${property.optimized ? formatBytes(property.optimizedBytes) : 'Pendiente'}</strong></span>
          ${savings !== null ? `<span class="savings">Ahorro ${savings.toFixed(1)} %</span>` : ''}
        </div>
        ${property.error ? `<p class="error">${escapeHtml(property.error)}</p>` : ''}
      </div>
      <div class="property-controls">
        <button class="primary optimize" ${property.error ? 'disabled' : ''}>${property.optimized ? 'Volver a optimizar' : 'Optimizar medios'}</button>
        <button class="secondary sync" ${property.error ? 'disabled' : ''}>Sincronizar con portal</button>
        ${property.remote?.url ? `<a class="button-link secondary" href="${escapeHtml(property.remote.url)}" target="_blank" rel="noreferrer">Ver en portal</a>` : ''}
        <div class="status-row">
          <select class="status-select">
            ${['available','reserved','sold','rented'].map(value => `<option value="${value}" ${value === status ? 'selected' : ''}>${statusLabel(value)}</option>`).join('')}
          </select>
          <button class="secondary save-status" title="Guardar estado en README">Guardar</button>
        </div>
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.property').forEach(card => {
    const sourceId = card.dataset.id;
    card.querySelector('.optimize')?.addEventListener('click', () => optimize(sourceId));
    card.querySelector('.sync')?.addEventListener('click', () => sync(sourceId));
    card.querySelector('.save-status')?.addEventListener('click', () => saveStatus(sourceId, card.querySelector('.status-select').value));
  });
};

const render = () => {
  $('#rootFolder').textContent = state.settings.rootFolder || 'Sin seleccionar';
  $('#portalUrl').value = state.settings.portalUrl || 'https://circulo-bienes-raices-2.onrender.com';
  if (!$('#email').value) $('#email').value = state.settings.email || '';
  renderSummary();
  renderProperties();
};

const load = async () => {
  const data = await api('/api/state');
  state.properties = data.properties || [];
  state.settings = data.settings || {};
  render();
};

const selectFolder = async () => {
  showBusy('Abriendo selector de carpeta…');
  try {
    await api('/api/select-folder', { method: 'POST', body: '{}' });
    await load();
    notify('Carpeta conectada correctamente.');
  } catch (error) { notify(error.message, true); }
  finally { hideBusy(); }
};

const scan = async () => {
  showBusy('Revisando carpetas y archivos…');
  try { await api('/api/scan', { method: 'POST', body: '{}' }); await load(); notify('Biblioteca actualizada.'); }
  catch (error) { notify(error.message, true); }
  finally { hideBusy(); }
};

const optimize = async sourceId => {
  showBusy(`Optimizando ${sourceId}… Los videos pueden tardar varios minutos.`);
  try {
    const result = await api(`/api/properties/${encodeURIComponent(sourceId)}/optimize`, { method: 'POST', body: '{}' });
    await load();
    const saved = result.originalBytes ? Math.max(0, 100 - result.optimizedBytes / result.originalBytes * 100) : 0;
    notify(`Optimización terminada: ${formatBytes(result.originalBytes)} → ${formatBytes(result.optimizedBytes)} (${saved.toFixed(1)} % menos).`);
  } catch (error) { notify(error.message, true); }
  finally { hideBusy(); }
};

const sync = async sourceId => {
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const portalUrl = $('#portalUrl').value.trim();
  if (!email || !password) return notify('Ingresa el correo y la contraseña administrativos.', true);
  showBusy(`Preparando y sincronizando ${sourceId} con Círculo Internacional…`);
  try {
    await api(`/api/properties/${encodeURIComponent(sourceId)}/optimize`, { method: 'POST', body: '{}' });
    const result = await api(`/api/properties/${encodeURIComponent(sourceId)}/sync`, {
      method: 'POST', body: JSON.stringify({ email, password, portalUrl }),
    });
    await load();
    notify(`${result.created ? 'Propiedad creada' : 'Propiedad actualizada'}: ${result.summary.images} fotos y ${result.summary.videos} videos.`);
  } catch (error) { notify(error.message, true); }
  finally { hideBusy(); }
};

const saveStatus = async (sourceId, status) => {
  showBusy(`Guardando estado de ${sourceId}…`);
  try {
    await api(`/api/properties/${encodeURIComponent(sourceId)}/status`, { method: 'PATCH', body: JSON.stringify({ status, published: true }) });
    await load();
    notify('Estado guardado en el README. Sincroniza para reflejarlo en el portal.');
  } catch (error) { notify(error.message, true); }
  finally { hideBusy(); }
};

$('#selectFolder').addEventListener('click', selectFolder);
$('#scanFolder').addEventListener('click', scan);
load().catch(error => notify(error.message, true));
