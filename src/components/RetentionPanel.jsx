export function RetentionPanel({
  cleanupPreview,
  previewCleanup,
  retentionSettings,
  runCleanup,
  saveRetentionSettings,
  setRetentionSettings,
}) {
  return (
    <div className="summary-card" style={{ margin: '0 0 16px 0' }}>
      <div className="summary-label">Retenção e sanitização</div>
      <div className="ops-grid">
        <div className="ops-stat">
          <span>Galerias novas</span>
          <input
            type="number"
            min="1"
            className="phone-input"
            value={retentionSettings.defaultGalleryRetentionDays}
            onChange={(event) =>
              setRetentionSettings((previous) => ({
                ...previous,
                defaultGalleryRetentionDays: Number(event.target.value) || 30,
              }))
            }
          />
        </div>
        <div className="ops-stat">
          <span>Compartilhamentos expirados</span>
          <input
            type="number"
            min="1"
            className="phone-input"
            value={retentionSettings.expiredShareRetentionDays}
            onChange={(event) =>
              setRetentionSettings((previous) => ({
                ...previous,
                expiredShareRetentionDays: Number(event.target.value) || 7,
              }))
            }
          />
        </div>
      </div>
      <label className="summary-help retention-checkbox">
        <input
          type="checkbox"
          checked={Boolean(retentionSettings.archiveBeforeDelete)}
          onChange={(event) =>
            setRetentionSettings((previous) => ({
              ...previous,
              archiveBeforeDelete: event.target.checked,
            }))
          }
        />
        Arquivar antes de remover definitivamente
      </label>
      <div className="share-actions">
        <button className="btn-manual btn-manual-card" onClick={saveRetentionSettings}>
          Salvar retenção
        </button>
        <button className="btn-manual btn-manual-card" onClick={previewCleanup}>
          Prever limpeza
        </button>
        <button className="btn-manual btn-manual-cash" onClick={runCleanup}>
          Executar limpeza
        </button>
      </div>
      {cleanupPreview ? (
        <small className="summary-help">
          {cleanupPreview.photosCount || 0} foto(s), {cleanupPreview.filesCount || 0} arquivo(s), {Math.round((cleanupPreview.bytesCount || 0) / 1024 / 1024)} MB.
        </small>
      ) : null}
    </div>
  );
}
