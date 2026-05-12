import { useState } from 'react';
import { AccountMenu } from '../components/AccountMenu';
import { AdminTabs } from '../components/AdminTabs';
import { CredentialsPanel } from '../components/CredentialsPanel';
import { GalleryControlPanel } from '../components/GalleryControlPanel';
import { SalesStatsPanel } from '../components/SalesStatsPanel';
import { SettingsPanel } from '../components/SettingsPanel';
import { DEFAULT_PRICING } from '../lib/pricing';

export function DashboardScreen({
  activeStage,
  adminAccessError,
  adminAccessStatus,
  adminAttemptsRemaining,
  adminHeaders,
  adminJsonHeaders,
  adminLockedUntil,
  adminRemember,
  adminRetryAfterSeconds,
  cleanupPreview,
  clientPhone,
  count,
  credentialsData,
  credentialsStatus,
  dashData,
  deleteCredential,
  fetchDashboard,
  handleFileUpload,
  hasActiveSession,
  isAdminUnlocked,
  isUploading,
  liveOps,
  loginAdmin,
  logoutAdmin,
  noticeBanner,
  notificationCenter,
  packageSettingsStatus,
  period,
  pricingOptions = DEFAULT_PRICING,
  previewCleanup,
  retentionSettings,
  runCleanup,
  saveCredential,
  saveCredentialsBatch,
  savePackageSettings,
  saveRetentionSettings,
  saveWatermarkSettings,
  saveWhatsAppTemplates,
  sessionId,
  setNotice,
  setPeriod,
  setRetentionSettings,
  setType,
  startNewSession,
  total,
  type,
  withAdminMediaToken,
  whatsAppTemplateStatus,
  whatsAppTemplates,
  watermarkSettings,
  watermarkSettingsStatus,
}) {
  const [activeTab, setActiveTab] = useState('galerias');

  const renderPanel = () => {
    if (activeTab === 'vendas') {
      return (
        <SalesStatsPanel
          activeStage={activeStage}
          adminHeaders={adminHeaders}
          clientPhone={clientPhone}
          count={count}
          dashData={dashData}
          fetchDashboard={fetchDashboard}
          hasActiveSession={hasActiveSession}
          liveOps={liveOps}
          period={period}
          pricingOptions={pricingOptions}
          sessionId={sessionId}
          setNotice={setNotice}
          setPeriod={setPeriod}
          total={total}
          type={type}
        />
      );
    }

    if (activeTab === 'configuracoes') {
      return (
        <SettingsPanel
          cleanupPreview={cleanupPreview}
          packageSettingsStatus={packageSettingsStatus}
          previewCleanup={previewCleanup}
          pricingOptions={pricingOptions}
          retentionSettings={retentionSettings}
          runCleanup={runCleanup}
          savePackageSettings={savePackageSettings}
          saveRetentionSettings={saveRetentionSettings}
          saveWatermarkSettings={saveWatermarkSettings}
          saveWhatsAppTemplates={saveWhatsAppTemplates}
          setRetentionSettings={setRetentionSettings}
          setType={setType}
          type={type}
          whatsAppTemplateStatus={whatsAppTemplateStatus}
          whatsAppTemplates={whatsAppTemplates}
          watermarkSettings={watermarkSettings}
          watermarkSettingsStatus={watermarkSettingsStatus}
        />
      );
    }

    if (activeTab === 'credenciais') {
      return (
        <CredentialsPanel
          credentialsData={credentialsData}
          credentialsStatus={credentialsStatus}
          deleteCredential={deleteCredential}
          saveCredential={saveCredential}
          saveCredentialsBatch={saveCredentialsBatch}
        />
      );
    }

    return (
      <GalleryControlPanel
        activeStage={activeStage}
        adminHeaders={adminHeaders}
        adminJsonHeaders={adminJsonHeaders}
        clientPhone={clientPhone}
        count={count}
        dashData={dashData}
        fetchDashboard={fetchDashboard}
        hasActiveSession={hasActiveSession}
        isUploading={isUploading}
        liveOps={liveOps}
        pricingOptions={pricingOptions}
        setNotice={setNotice}
        setType={setType}
        startNewSession={startNewSession}
        total={total}
        type={type}
        withAdminMediaToken={withAdminMediaToken}
      />
    );
  };

  return (
    <div className="dashboard-screen screen">
      <header className="dash-header">
        <div className="logo brand-logo">
          <img src="/logo-transparent.png" alt="SnapFlow" className="brand-logo-image" />
        </div>
        <nav className="dash-nav" aria-label="Conta">
          {notificationCenter}
          <AccountMenu
            adminAccessError={adminAccessError}
            adminAccessStatus={adminAccessStatus}
            adminAttemptsRemaining={adminAttemptsRemaining}
            adminLockedUntil={adminLockedUntil}
            adminRemember={adminRemember}
            adminRetryAfterSeconds={adminRetryAfterSeconds}
            isAdminUnlocked={isAdminUnlocked}
            loginAdmin={loginAdmin}
            logoutAdmin={logoutAdmin}
          />
        </nav>
      </header>

      {isAdminUnlocked ? (
        <AdminTabs activeTab={activeTab} onChange={setActiveTab} />
      ) : null}

      <main className="dash-main">
        {!isAdminUnlocked ? (
          <div className="summary-card admin-locked-card">
            <div className="summary-label">Painel protegido</div>
            <small className="summary-help">
              As opções de edição, upload, retenção e gerenciamento aparecem somente depois que a conta administrativa for validada.
            </small>
          </div>
        ) : renderPanel()}

        {noticeBanner}
      </main>

      <input
        type="file"
        id="hidden-upload"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
    </div>
  );
}
