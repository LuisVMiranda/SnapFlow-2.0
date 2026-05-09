import { formatMoney } from '../lib/formatters';

export function ShareGalleryEditor({
  closeEditor,
  deletePhoto,
  detail,
  draft,
  isLoading,
  isPhotoBusy,
  pricingOptions,
  saveShare,
  shareSession,
  updateDraft,
  uploadPhotos,
}) {
  const photos = detail?.photos || [];
  const sales = detail?.sales || shareSession.sales || {};
  const soldPhotoCount = Number(sales.soldPhotoCount || 0);
  const soldOrderCount = Number(sales.soldOrderCount || 0);
  const soldAmount = Number(sales.soldAmount || 0);
  const uploadInputId = `share-upload-${shareSession.galleryId || shareSession.token}`;
  const clientInputId = `share-client-${shareSession.galleryId || shareSession.token}`;
  const clientHelpId = `${clientInputId}-help`;

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
        <input
          className="phone-input"
          value={draft.phone}
          onChange={(event) => updateDraft(shareSession.token, 'phone', event.target.value)}
          placeholder="DDD + número"
        />
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
        Total
        <input
          className="phone-input"
          min="0"
          step="0.01"
          type="number"
          value={draft.total}
          onChange={(event) => updateDraft(shareSession.token, 'total', event.target.value)}
        />
      </label>
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
      </section>

      <div className="share-edit-actions">
        <button className="btn-primary" type="submit">Salvar galeria</button>
        <button className="btn-manual btn-manual-card" type="button" onClick={closeEditor}>Cancelar</button>
      </div>
    </form>
  );
}
