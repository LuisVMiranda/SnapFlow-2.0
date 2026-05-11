import { ShareCountdown } from '../components/ShareCountdown';
import { SessionOpsCard } from '../components/SessionOpsCard';
import { WatermarkOverlay } from '../components/WatermarkOverlay';
import { formatMoney } from '../lib/formatters';
import { DEFAULT_PRICING } from '../lib/pricing';

export function GalleryScreen({
  activeStage,
  allPhotosSelected,
  brokenPhotoIds,
  clientPhone,
  count,
  discountAmount = 0,
  hasDiscount,
  isLoadingPhotos = false,
  liveOps,
  loadMorePhotos = () => {},
  markBrokenPhoto,
  photoPageCounts,
  photoPageError = '',
  photos,
  photosPage,
  pricingOptions = DEFAULT_PRICING,
  remaining,
  resetSession,
  selected,
  setScreen,
  setViewerIndex,
  shareSessionInfo,
  shareToken,
  subtotal = 0,
  toggle,
  toggleAllPhotos,
  total,
  type,
  unit,
  watermarkSettings,
}) {
  const activePackage = pricingOptions[type] || pricingOptions[Object.keys(pricingOptions)[0]];
  const hasMorePhotos = Boolean(shareToken && photosPage?.hasMore);
  const loadedCount = photoPageCounts?.loadedCount ?? photos.length;
  const totalPhotoCount = photoPageCounts?.totalCount ?? photos.length;
  const selectedLoadedCount = photoPageCounts?.selectedLoadedCount ?? selected.length;
  const manualPaymentNotice = shareToken
    ? 'Pedido enviado ao fotógrafo. Assim que o pagamento for aprovado, o envio das fotos será liberado automaticamente.'
    : undefined;

  return (
    <div className={`screen ${shareToken ? 'share-protected' : ''}`}>
      <header className="topbar">
        {!shareToken ? (
          <button
            className="back-btn"
            onClick={() => {
              if (confirm('Deseja realmente cancelar esta sessão? Todas as fotos selecionadas serão perdidas.')) {
                resetSession();
                setScreen('dashboard');
              }
            }}
            style={{ color: '#ff4444' }}
          >
            Cancelar
          </button>
        ) : null}
        {shareToken && shareSessionInfo?.expiresAt ? (
          <div style={{ marginLeft: 'auto' }}>
            <ShareCountdown isoDate={shareSessionInfo.expiresAt} />
          </div>
        ) : null}
      </header>

      <main
        className="gallery-grid"
        style={{ paddingBottom: '16px', userSelect: shareToken ? 'none' : 'auto' }}
        onContextMenu={(event) => {
          if (shareToken) event.preventDefault();
        }}
        onDragStart={(event) => {
          if (shareToken) event.preventDefault();
        }}
        onSelectStart={(event) => {
          if (shareToken) event.preventDefault();
        }}
      >
        {photos.map((photo, index) => {
          const isSelected = selected.includes(photo.id);
          const isBroken = brokenPhotoIds.includes(photo.id);

          return (
            <div
              key={photo.id}
              className={`photo-tile ${isSelected ? 'sel' : ''}`}
              onClick={() => setViewerIndex(index)}
              style={{ position: 'relative' }}
            >
              {isBroken ? (
                <div className="image-broken-message image-broken-tile">Imagem indisponível</div>
              ) : (
                <>
                  <img
                    src={photo.thumbUrl || photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    onError={() => markBrokenPhoto(photo.id)}
                    className={shareToken ? 'protected-media' : undefined}
                    onDragStart={(event) => {
                      if (shareToken) event.preventDefault();
                    }}
                    onContextMenu={(event) => {
                      if (shareToken) event.preventDefault();
                    }}
                  />
                  {shareToken ? (
                    <WatermarkOverlay settings={watermarkSettings} />
                  ) : null}
                </>
              )}
              <div
                className={`tile-check-circle ${isSelected ? 'active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(photo.id);
                }}
              >
                {isSelected ? '●' : ''}
              </div>
            </div>
          );
        })}
      </main>

      <div className="info-bottom-area" style={{ padding: '0 16px 100px 16px' }}>
        {shareToken ? (
          <div className="share-view-notice">
            <div className="share-view-notice-title">Modo de Visualização</div>
            <div className="share-view-notice-copy">
              Selecione suas fotos favoritas. As imagens originais em alta qualidade serão enviadas após o pagamento.
            </div>
          </div>
        ) : null}

        <div className="gallery-toolbar" style={{ marginBottom: '16px' }}>
          <button className="gallery-toolbar-btn" onClick={toggleAllPhotos}>
            {allPhotosSelected ? 'Limpar seleção' : hasMorePhotos ? 'Selecionar fotos carregadas' : 'Selecionar tudo'}
          </button>
          <span className="gallery-toolbar-hint">
            {shareToken
              ? `${selected.length} selecionada(s) • ${loadedCount} de ${totalPhotoCount} fotos carregadas`
              : `${selected.length} de ${photos.length} fotos selecionadas`}
          </span>
        </div>

        {shareToken && hasMorePhotos ? (
          <div className="gallery-pagination-panel">
            <button className="gallery-toolbar-btn" type="button" disabled={isLoadingPhotos} onClick={loadMorePhotos}>
              {isLoadingPhotos ? 'Carregando mais fotos...' : 'Carregar mais fotos'}
            </button>
            <small>{selectedLoadedCount} foto(s) selecionada(s) entre as carregadas.</small>
          </div>
        ) : null}

        {shareToken && photoPageError ? (
          <div className="ops-error gallery-page-error">
            <span>{photoPageError}</span>
            <button className="share-quick-btn approve-session-btn" type="button" onClick={loadMorePhotos}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {count > 0 ? (
          <div className={`promo-banner ${hasDiscount ? 'active' : ''}`} style={{ borderRadius: '8px', marginBottom: '8px' }}>
            {hasDiscount
              ? `Desconto ativo: ${formatMoney(unit)} por foto`
              : `Faltam ${remaining} foto(s) para o desconto`}
          </div>
        ) : null}

        <div className="package-alert compact" style={{ marginBottom: '16px' }}>
          <span>Pacote em uso:</span>
          <strong>{activePackage.label}</strong>
        </div>

        <SessionOpsCard
          title="Sessão atual"
          stage={activeStage}
          count={count}
          subtotal={subtotal}
          discountAmount={discountAmount}
          total={total}
          phone={clientPhone}
          packageType={type}
          pricingOptions={pricingOptions}
          paymentMethod={liveOps.paymentMethod}
          paymentStatus={liveOps.paymentStatus}
          deliveryStatus={liveOps.deliveryStatus}
          deliveryError={liveOps.deliveryError}
          manualPaymentNotice={manualPaymentNotice}
        />
      </div>

      <footer className="bottombar">
        <div className="bottombar-info">
          <span className="count-label">{count} foto(s)</span>
          <span className="total-label">{formatMoney(total)}</span>
        </div>
        <button className="btn-primary" disabled={count === 0} onClick={() => setScreen('summary')}>
          Finalizar pedido
        </button>
      </footer>
    </div>
  );
}
