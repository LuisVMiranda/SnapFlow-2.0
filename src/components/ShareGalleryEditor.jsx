import { useState } from 'react';
import { applyManualDiscount } from '../lib/discounts';
import { formatMoney } from '../lib/formatters';
import { resolvePresetStack } from '../lib/photoPresets';
import { buildStoredPhone, phoneDigits, splitStoredPhone } from '../lib/phone';
import { PhotoPresetPreview } from './PhotoPresetPreview';

export function ShareGalleryEditor({
  applyPhotoPresets = () => {},
  closeEditor,
  deletePhoto,
  detail,
  draft,
  isLoading,
  isPhotoBusy,
  loadMorePhotos = () => {},
  photoPresets = [],
  pricingOptions,
  removePhotoPresets = () => {},
  saveShare,
  shareSession,
  toggleDraftPreset = () => {},
  undoPhotoPresetApplication = () => {},
  updateDraft,
  uploadPhotos,
}) {
  const galleryDetail = detail || {};
  const photos = galleryDetail.photos || [];
  const firstPreviewPhoto = photos.find((photo) => photo.url || photo.thumbUrl);
  const presetPreviewUrl = firstPreviewPhoto ? firstPreviewPhoto.url || firstPreviewPhoto.thumbUrl : '';
  const photosPage = galleryDetail.photosPage || {};
  const sales = galleryDetail.sales || shareSession.sales || {};
  const soldPhotoCount = Number(sales.soldPhotoCount || 0);
  const soldOrderCount = Number(sales.soldOrderCount || 0);
  const soldAmount = Number(sales.soldAmount || 0);
  const uploadInputId = `share-upload-${shareSession.galleryId || shareSession.token}`;
  const clientInputId = `share-client-${shareSession.galleryId || shareSession.token}`;
  const clientHelpId = `${clientInputId}-help`;
  const subtotal = Number(draft.subtotal || 0);
  const discountAmount = Number(draft.discountAmount || 0);
  const totals = applyManualDiscount(subtotal, discountAmount);
  const selectedPresetIds = draft.photoPresetIds || galleryDetail.photoPresetIds || shareSession.photoPresetIds || [];
  const activePresetIds = galleryDetail.photoPresetIds || shareSession.photoPresetIds || [];
  const selectedPresetStack = resolvePresetStack(photoPresets, selectedPresetIds);
  const activePresetStack = galleryDetail.photoPresetSnapshot || shareSession.photoPresetSnapshot || [];
  const [phoneDraft, setPhoneDraft] = useState(() => splitStoredPhone(draft.phone));
  const updatePhoneValue = (nextParts) => {
    const nextDraft = { ...phoneDraft, ...nextParts };
    setPhoneDraft(nextDraft);
    if (!nextDraft.countryCode) return;
    updateDraft(shareSession.token, 'phone', buildStoredPhone(nextDraft));
  };

  return (
    <form className="share-edit-panel" onSubmit={(event) => saveShare(event, shareSession)}>
      <label>
        Nome da galeria
        <input
          className="phone-input"
          maxLength={120}
          value={draft.galleryName || ''}
          onChange={(event) =>
            updateDraft(
              shareSession.token,
              'galleryName',
              event.target.value.replace(/\s+/g, ' ').slice(0, 120)
            )
          }
          placeholder="Ex.: Formatura turma 2026"
        />
      </label>
      <label>
        Descrição da galeria
        <textarea
          className="phone-input"
          maxLength={800}
          rows={3}
          value={draft.galleryDescription || ''}
          onChange={(event) => updateDraft(shareSession.token, 'galleryDescription', event.target.value.slice(0, 800))}
          placeholder="Detalhes opcionais para orientar o cliente"
        />
      </label>
      <div className="share-sales-summary">
        {soldPhotoCount} foto(s) vendidas até agora em {soldOrderCount} pedido(s) - {formatMoney(soldAmount)}
      </div>
      <label>
        Código de acesso
        <input
          className="phone-input"
          maxLength={4}
          value={draft.accessCode}
          onChange={(event) => updateDraft(shareSession.token, 'accessCode', event.target.value)}
          placeholder="1234"
        />
      </label>
      <div className="share-edit-field">
        <label htmlFor={clientInputId}>Cliente</label>
        <input
          id={clientInputId}
          className="phone-input"
          maxLength={80}
          value={draft.clientName}
          aria-describedby={clientHelpId}
          onChange={(event) => {
            updateDraft(
              shareSession.token,
              'clientName',
              event.target.value.replace(/\s+/g, ' ').slice(0, 80)
            );
          }}
          placeholder="Nome de quem acessa e paga"
        />
        <small className="summary-help" id={clientHelpId}>Este nome alimenta o parâmetro {'{name}'} nos modelos de WhatsApp.</small>
      </div>
      <label>
        E-mail do cliente
        <input
          className="phone-input"
          maxLength={120}
          value={draft.clientEmail || ''}
          onChange={(event) => updateDraft(shareSession.token, 'clientEmail', event.target.value)}
          placeholder="cliente@exemplo.com"
          type="email"
        />
      </label>
      <label>
        WhatsApp
        <div className="phone-field-grid">
          <input
            className="phone-input"
            value={phoneDraft.countryCode}
            onChange={(event) => updatePhoneValue({ countryCode: phoneDigits(event.target.value).slice(0, 4) })}
            placeholder="DDI"
          />
          <input
            className="phone-input"
            value={phoneDraft.localNumber}
            onChange={(event) => updatePhoneValue({ localNumber: phoneDigits(event.target.value).slice(0, 14) })}
            placeholder={phoneDraft.countryCode === '55' ? 'DDD + número' : 'Número sem o DDI'}
          />
        </div>
        <small className="summary-help">DDI editável. O padrão inicial continua Brasil (55).</small>
      </label>
      <label>
        Pacote
        <select
          className="phone-input"
          value={draft.packageType}
          onChange={(event) => updateDraft(shareSession.token, 'packageType', event.target.value)}
        >
          {Object.entries(pricingOptions).map(([key, option]) => (
            <option key={key} value={key}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        Subtotal base
        <input
          className="phone-input"
          min="0"
          step="0.01"
          type="number"
          value={draft.subtotal}
          onChange={(event) => updateDraft(shareSession.token, 'subtotal', event.target.value)}
        />
      </label>
      <label>
        Desconto manual
        <input
          className="phone-input"
          min="0"
          step="0.01"
          type="number"
          value={draft.discountAmount || ''}
          onChange={(event) => updateDraft(shareSession.token, 'discountAmount', event.target.value)}
          placeholder="Deixe em branco para remover"
        />
      </label>
      <div className="share-sales-summary">
        Total final para o cliente: {formatMoney(totals.total)}
      </div>
      <section className="gallery-preset-tools" aria-label="Presets de edição da galeria">
        <div>
          <strong>Presets de edição</strong>
          <small className="summary-help" style={{ display: 'block' }}>
            Selecione até 3 presets, reaplique nas fotos da galeria e use desfazer se o resultado não ajudar.
          </small>
        </div>
        {photoPresets.length ? (
          <div className="gallery-preset-grid">
            {photoPresets.map((preset) => {
              const isSelected = selectedPresetIds.includes(preset.id);
              return (
                <label className={`gallery-preset-option ${isSelected ? 'selected' : ''}`} key={preset.id}>
                  <input
                    checked={isSelected}
                    className="gallery-preset-checkbox"
                    type="checkbox"
                    onChange={() => toggleDraftPreset(shareSession.token, preset.id)}
                  />
                  <span className="gallery-preset-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                  <span className="gallery-preset-name">{preset.name}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="share-gallery-empty">Crie presets em Configurações antes de aplicar ajustes nesta galeria.</div>
        )}
        {activePresetIds.length ? (
          <small className="summary-help success">
            Ativo agora: {activePresetStack.map((preset) => preset.name || preset.id).join(' + ')}
          </small>
        ) : (
          <small className="summary-help">Nenhum preset ativo nesta galeria.</small>
        )}
        {selectedPresetStack.length ? (
          <PhotoPresetPreview
            compact
            imageAlt="Prévia da primeira foto da galeria"
            imageUrl={presetPreviewUrl}
            presetStack={selectedPresetStack}
          />
        ) : null}
        <div className="gallery-preset-actions">
          <button className="share-quick-btn approve-session-btn" disabled={isPhotoBusy || !selectedPresetIds.length} type="button" onClick={() => applyPhotoPresets(shareSession)}>
            Reaplicar preset
          </button>
          <button className="share-quick-btn share-quick-btn-danger" disabled={isPhotoBusy || !activePresetIds.length} type="button" onClick={() => removePhotoPresets(shareSession)}>
            Remover presets
          </button>
          <button className="share-quick-btn" disabled={isPhotoBusy} type="button" onClick={() => undoPhotoPresetApplication(shareSession)}>
            Desfazer reaplicação
          </button>
        </div>
      </section>
      <label>
        Reabrir por minutos
        <input
          className="phone-input"
          min="5"
          max="180"
          type="number"
          value={draft.expiresMinutes}
          onChange={(event) => updateDraft(shareSession.token, 'expiresMinutes', event.target.value)}
          placeholder="Deixe vazio para manter"
        />
      </label>

      <section className="share-gallery-editor" aria-label="Fotos da galeria">
        <div className="share-gallery-editor-header">
          <strong>Fotos da galeria</strong>
          <label className="share-upload-control" htmlFor={uploadInputId}>
            {isPhotoBusy ? 'Enviando...' : 'Adicionar fotos'}
            <input
              id={uploadInputId}
              type="file"
              multiple
              accept="image/*"
              disabled={isPhotoBusy}
              onChange={(event) => uploadPhotos(event, shareSession)}
            />
          </label>
        </div>

        {isLoading ? <div className="share-gallery-empty">Carregando fotos...</div> : null}
        {!isLoading && photos.length === 0 ? (
          <div className="share-gallery-empty">Nenhuma foto vinculada a esta galeria.</div>
        ) : null}
        {!isLoading && photos.length > 0 ? (
          <div className="share-photo-grid">
            {photos.map((photo, index) => (
              <div className="share-photo-item" key={photo.id}>
                <img src={photo.thumbUrl || photo.url} alt={`Foto ${index + 1}`} />
                <button
                  className="share-photo-remove"
                  type="button"
                  disabled={isPhotoBusy}
                  onClick={() => deletePhoto(shareSession, photo)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {photosPage.hasMore ? (
          <button
            className="share-quick-btn"
            type="button"
            disabled={isLoading}
            onClick={() => loadMorePhotos(shareSession)}
          >
            {isLoading ? 'Carregando mais fotos...' : 'Carregar mais fotos'}
          </button>
        ) : null}
      </section>

      <div className="share-edit-actions">
        <button className="btn-primary" type="submit">Salvar galeria</button>
        <button className="btn-manual btn-manual-card" type="button" onClick={closeEditor}>Cancelar</button>
      </div>
    </form>
  );
}
