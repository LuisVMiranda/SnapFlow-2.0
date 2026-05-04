import './index.css';
import { PhotoViewer } from './components/PhotoViewer';
import { ConfirmedScreen } from './screens/ConfirmedScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { PixScreen } from './screens/PixScreen';
import { ShareLockScreen } from './screens/ShareLockScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { useSnapFlowController } from './hooks/useSnapFlowController';

export default function App() {
  const {
    activeStage,
    adminAccessError,
    adminAccessStatus,
    adminAttemptsRemaining,
    adminHeaders,
    adminJsonHeaders,
    adminRemember,
    allPhotosSelected,
    brokenPhotoIds,
    cleanupPreview,
    clientPhone,
    count,
    currentPhoto,
    credentialsData,
    credentialsStatus,
    dashData,
    deleteCredential,
    fetchDashboard,
    handleCreateShareSession,
    handleExtendShareSession,
    handleFileUpload,
    handleGeneratePix,
    handleManualPayment,
    handleRevokeShareSession,
    handleUnlockSharedSession,
    hasActiveSession,
    hasDiscount,
    isGeneratingPix,
    isAdminUnlocked,
    isUploading,
    liveOps,
    loginAdmin,
    logoutAdmin,
    markBrokenPhoto,
    noticeBanner,
    packageSettingsStatus,
    period,
    photos,
    pricingOptions,
    pixCopyPaste,
    pixWhatsAppMessage,
    previewCleanup,
    qrCodeBase64,
    remaining,
    resetSession,
    retentionSettings,
    runCleanup,
    saveCredential,
    savePackageSettings,
    saveRetentionSettings,
    saveWhatsAppTemplates,
    screen,
    selected,
    selectedPhotoItems,
    setClientPhone,
    setNotice,
    setPeriod,
    setPixCopyPaste,
    setQrCodeBase64,
    setRetentionSettings,
    setScreen,
    setShareCodeInput,
    setShareDurationMinutes,
    setType,
    setViewerIndex,
    shareAccess,
    shareActionLoading,
    shareCodeInput,
    shareDurationMinutes,
    shareSessionInfo,
    shareToken,
    startNewSession,
    toggle,
    toggleAllPhotos,
    total,
    type,
    unit,
    whatsAppTemplateStatus,
    whatsAppTemplates,
  } = useSnapFlowController();

  if (shareToken && screen === 'share-lock') {
    return (
      <ShareLockScreen
        shareSessionInfo={shareSessionInfo}
        shareCodeInput={shareCodeInput}
        setShareCodeInput={setShareCodeInput}
        handleUnlockSharedSession={handleUnlockSharedSession}
        shareActionLoading={shareActionLoading}
        noticeBanner={noticeBanner}
      />
    );
  }

  if (currentPhoto) {
    return (
      <PhotoViewer
        currentPhoto={currentPhoto}
        selected={selected}
        brokenPhotoIds={brokenPhotoIds}
        shareToken={shareToken}
        photos={photos}
        count={count}
        total={total}
        setViewerIndex={setViewerIndex}
        markBrokenPhoto={markBrokenPhoto}
        toggle={toggle}
      />
    );
  }

  if (screen === 'dashboard') {
    return (
      <DashboardScreen
        activeStage={activeStage}
        adminAccessError={adminAccessError}
        adminAccessStatus={adminAccessStatus}
        adminAttemptsRemaining={adminAttemptsRemaining}
        adminHeaders={adminHeaders}
        adminJsonHeaders={adminJsonHeaders}
        adminRemember={adminRemember}
        cleanupPreview={cleanupPreview}
        clientPhone={clientPhone}
        count={count}
        credentialsData={credentialsData}
        credentialsStatus={credentialsStatus}
        dashData={dashData}
        deleteCredential={deleteCredential}
        fetchDashboard={fetchDashboard}
        handleFileUpload={handleFileUpload}
        hasActiveSession={hasActiveSession}
        isAdminUnlocked={isAdminUnlocked}
        isUploading={isUploading}
        liveOps={liveOps}
        loginAdmin={loginAdmin}
        logoutAdmin={logoutAdmin}
        noticeBanner={noticeBanner}
        packageSettingsStatus={packageSettingsStatus}
        period={period}
        pricingOptions={pricingOptions}
        previewCleanup={previewCleanup}
        retentionSettings={retentionSettings}
        runCleanup={runCleanup}
        saveCredential={saveCredential}
        savePackageSettings={savePackageSettings}
        saveRetentionSettings={saveRetentionSettings}
        saveWhatsAppTemplates={saveWhatsAppTemplates}
        setNotice={setNotice}
        setPeriod={setPeriod}
        setRetentionSettings={setRetentionSettings}
        setType={setType}
        startNewSession={startNewSession}
        total={total}
        type={type}
        whatsAppTemplateStatus={whatsAppTemplateStatus}
        whatsAppTemplates={whatsAppTemplates}
      />
    );
  }

  if (screen === 'gallery') {
    return (
      <GalleryScreen
        activeStage={activeStage}
        allPhotosSelected={allPhotosSelected}
        brokenPhotoIds={brokenPhotoIds}
        clientPhone={clientPhone}
        count={count}
        hasDiscount={hasDiscount}
        liveOps={liveOps}
        markBrokenPhoto={markBrokenPhoto}
        photos={photos}
        pricingOptions={pricingOptions}
        remaining={remaining}
        resetSession={resetSession}
        selected={selected}
        setScreen={setScreen}
        setViewerIndex={setViewerIndex}
        shareSessionInfo={shareSessionInfo}
        shareToken={shareToken}
        toggle={toggle}
        toggleAllPhotos={toggleAllPhotos}
        total={total}
        type={type}
        unit={unit}
      />
    );
  }

  if (screen === 'summary') {
    return (
      <SummaryScreen
        activeStage={activeStage}
        clientPhone={clientPhone}
        count={count}
        handleCreateShareSession={handleCreateShareSession}
        handleExtendShareSession={handleExtendShareSession}
        handleGeneratePix={handleGeneratePix}
        handleManualPayment={handleManualPayment}
        handleRevokeShareSession={handleRevokeShareSession}
        isGeneratingPix={isGeneratingPix}
        liveOps={liveOps}
        noticeBanner={noticeBanner}
        pricingOptions={pricingOptions}
        resetSession={resetSession}
        selectedPhotoItems={selectedPhotoItems}
        setClientPhone={setClientPhone}
        setScreen={setScreen}
        setShareDurationMinutes={setShareDurationMinutes}
        shareAccess={shareAccess}
        shareActionLoading={shareActionLoading}
        shareDurationMinutes={shareDurationMinutes}
        shareToken={shareToken}
        total={total}
        type={type}
        unit={unit}
      />
    );
  }

  if (screen === 'pix') {
    return (
      <PixScreen
        activeStage={activeStage}
        clientPhone={clientPhone}
        count={count}
        liveOps={liveOps}
        noticeBanner={noticeBanner}
        pixCopyPaste={pixCopyPaste}
        pixWhatsAppMessage={pixWhatsAppMessage}
        pricingOptions={pricingOptions}
        qrCodeBase64={qrCodeBase64}
        setNotice={setNotice}
        setPixCopyPaste={setPixCopyPaste}
        setQrCodeBase64={setQrCodeBase64}
        setScreen={setScreen}
        shareToken={shareToken}
        total={total}
        type={type}
      />
    );
  }

  if (screen === 'confirmed') {
    return (
      <ConfirmedScreen
        activeStage={activeStage}
        clientPhone={clientPhone}
        count={count}
        fetchDashboard={fetchDashboard}
        liveOps={liveOps}
        noticeBanner={noticeBanner}
        pricingOptions={pricingOptions}
        resetSession={resetSession}
        setScreen={setScreen}
        shareToken={shareToken}
        total={total}
        type={type}
      />
    );
  }

  return null;
}
