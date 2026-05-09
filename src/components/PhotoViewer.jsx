import { formatMoney } from '../lib/formatters';
import { WatermarkOverlay } from './WatermarkOverlay';

export function PhotoViewer({
  currentPhoto,
  selected,
  brokenPhotoIds,
  shareToken,
  photos,
  count,
  total,
  setViewerIndex,
  markBrokenPhoto,
  toggle,
  watermarkSettings,
}) {
  const isSelected = selected.includes(currentPhoto.id);
  const currentPhotoBroken = brokenPhotoIds.includes(currentPhoto.id);
  const handlePrev = () =>
    setViewerIndex((previous) => (previous > 0 ? previous - 1 : photos.length - 1));
  const handleNext = () =>
    setViewerIndex((previous) => (previous < photos.length - 1 ? previous + 1 : 0));

  return (
    <div className={`viewer-screen ${shareToken ? 'share-protected' : ''}`}>
      <header className="viewer-topbar">
        <button className="viewer-close" onClick={() => setViewerIndex(null)}>
          Fechar
        </button>
        <div className="viewer-cart-preview">
          <span className="cart-count">{count} foto(s)</span>
          <strong className="cart-total">{formatMoney(total)}</strong>
        </div>
      </header>

      <div className="viewer-body">
        <button
          className="viewer-nav left"
          onClick={handlePrev}
          type="button"
          aria-label="Foto anterior"
        >
          <span className="nav-btn">&#8249;</span>
        </button>

        <div className={`viewer-image-container ${currentPhotoBroken ? 'image-broken-frame' : ''}`}>
          {currentPhotoBroken ? (
            <div className="image-broken-message">Não foi possível carregar esta foto.</div>
          ) : (
            <>
              <img
                src={currentPhoto.url}
                alt="Foto selecionada"
                onError={() => markBrokenPhoto(currentPhoto.id)}
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
        </div>

        <button
          className="viewer-nav right"
          onClick={handleNext}
          type="button"
          aria-label="Próxima foto"
        >
          <span className="nav-btn">&#8250;</span>
        </button>
      </div>

      <footer className="viewer-bottom">
        <button
          className={`btn-giant ${isSelected ? 'btn-remove' : 'btn-add'}`}
          onClick={() => toggle(currentPhoto.id)}
        >
          {isSelected ? 'Remover da sacola' : 'Adicionar foto a sacola'}
        </button>
      </footer>
    </div>
  );
}
