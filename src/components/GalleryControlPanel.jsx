import { SessionOpsCard } from './SessionOpsCard';
import { SharedLinksPanel } from './SharedLinksPanel';
import { WhatsAppStatusCard } from './WhatsAppStatusCard';

export function GalleryControlPanel({
  activeStage,
  adminHeaders,
  adminJsonHeaders,
  clientPhone,
  count,
  dashData,
  fetchDashboard,
  hasActiveSession,
  isUploading,
  liveOps,
  photoPresets,
  pricingOptions,
  setNotice,
  setType,
  startNewSession,
  total,
  type,
  withAdminMediaToken,
}) {
  const activePackage = pricingOptions[type] || pricingOptions[Object.keys(pricingOptions)[0]];

  return (
    <section className="admin-panel">
      <div className="package-alert">
        <div>
          <span>Pacote ativo agora:</span>
          <strong>{activePackage.label}</strong>
        </div>
      </div>

      <div className="package-selector">
        {Object.entries(pricingOptions).map(([key, packageConfig]) => (
          <button
            key={key}
            className={`package-card package-card-select ${type === key ? 'active' : ''}`}
            type="button"
            onClick={() => setType(key)}
          >
            <strong>{packageConfig.label}</strong>
            <small>{packageConfig.description}</small>
          </button>
        ))}
      </div>

      <WhatsAppStatusCard adminHeaders={adminHeaders} setNotice={setNotice} />

      {hasActiveSession ? (
        <SessionOpsCard
          title="Sessão atual"
          stage={activeStage}
          count={count}
          total={total}
          phone={clientPhone}
          packageType={type}
          pricingOptions={pricingOptions}
          paymentMethod={liveOps.paymentMethod}
          paymentStatus={liveOps.paymentStatus}
          deliveryStatus={liveOps.deliveryStatus}
          deliveryError={liveOps.deliveryError}
        />
      ) : null}

      <button className="btn-primary dashboard-upload-button" onClick={startNewSession} disabled={isUploading}>
        {isUploading ? 'Carregando imagens...' : 'Escolher fotos da câmera / galeria'}
      </button>

      <SharedLinksPanel
        adminHeaders={adminHeaders}
        adminJsonHeaders={adminJsonHeaders}
        dashData={dashData}
        fetchDashboard={fetchDashboard}
        photoPresets={photoPresets}
        pricingOptions={pricingOptions}
        setNotice={setNotice}
        withAdminMediaToken={withAdminMediaToken}
      />
    </section>
  );
}
