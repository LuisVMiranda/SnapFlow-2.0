import './index.css';
import { PhotoViewer } from './components/PhotoViewer';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { AdminApprovalScreen } from './screens/AdminApprovalScreen';
import { ConfirmedScreen } from './screens/ConfirmedScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { ManualPaymentPendingScreen } from './screens/ManualPaymentPendingScreen';
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
    adminLockedUntil,
    adminRemember,
    adminRetryAfterSeconds,
    allPhotosSelected,
    brokenPhotoIds,
    cleanupPreview,
    clientName,
    clientEmail,
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
    isLoadingPhotos,
    isUploading,
    liveOps,
    loadMorePhotos,
    loginAdmin,
    logoutAdmin,
    markBrokenPhoto,
    noticeBanner,
    packageSettingsStatus,
    period,
    photoPageCounts,
    photoPageError,
    photos,
    photosPage,
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
    saveCredentialsBatch,
    savePackageSettings,
    saveRetentionSettings,
    saveWatermarkSettings,
    saveWhatsAppTemplates,
    screen,
    selected,
    selectedPhotoItems,
    sessionId,
    setClientEmail,
    setClientName,
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
    watermarkSettings,
    watermarkSettingsStatus,
    withAdminMediaToken,
  } = useSnapFlowController();

  const adminApprovalSessionId =
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('adminApproval');
  const renderScreen = (content) => (
    <>
      {content}
      <ScrollToTopButton />
    </>
  );

  if (adminApprovalSessionId) {
    return renderScreen(
      <AdminApprovalScreen
        adminAccessError={adminAccessError}
        adminAccessStatus={adminAccessStatus}
        adminAttemptsRemaining={adminAttemptsRemaining}
        adminHeaders={adminHeaders}
        adminLockedUntil={adminLockedUntil}
        adminRemember={adminRemember}
        adminRetryAfterSeconds={adminRetryAfterSeconds}
        fetchDashboard={fetchDashboard}
        isAdminUnlocked={isAdminUnlocked}
        loginAdmin={loginAdmin}
        logoutAdmin={logoutAdmin}
        noticeBanner={noticeBanner}
        pricingOptions={pricingOptions}
        sessionId={adminApprovalSessionId}
        setNotice={setNotice}
      />
    );
  }

  if (shareToken && screen === 'share-lock') {
    return renderScreen(
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
    return renderScreen(
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
        watermarkSettings={shareSessionInfo?.watermarkSettings || watermarkSettings}
      />
    );
  }

  if (screen === 'dashboard') {
    return renderScreen(
      <DashboardScreen
        activeStage={activeStage}
        adminAccessError={adminAccessError}
        adminAccessStatus={adminAccessStatus}
        adminAttemptsRemaining={adminAttemptsRemaining}
        adminHeaders={adminHeaders}
        adminJsonHeaders={adminJsonHeaders}
        adminLockedUntil={adminLockedUntil}
        adminRemember={adminRemember}
        adminRetryAfterSeconds={adminRetryAfterSeconds}
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
        saveCredentialsBatch={saveCredentialsBatch}
        savePackageSettings={savePackageSettings}
        saveRetentionSettings={saveRetentionSettings}
        saveWatermarkSettings={saveWatermarkSettings}
        saveWhatsAppTemplates={saveWhatsAppTemplates}
        sessionId={sessionId}
        setNotice={setNotice}
        setPeriod={setPeriod}
        setRetentionSettings={setRetentionSettings}
        setType={setType}
        startNewSession={startNewSession}
        total={total}
        type={type}
        withAdminMediaToken={withAdminMediaToken}
        whatsAppTemplateStatus={whatsAppTemplateStatus}
        whatsAppTemplates={whatsAppTemplates}
        watermarkSettings={watermarkSettings}
        watermarkSettingsStatus={watermarkSettingsStatus}
      />
    );
  }

  if (screen === 'gallery') {
    return renderScreen(
      <GalleryScreen
        activeStage={activeStage}
        allPhotosSelected={allPhotosSelected}
        brokenPhotoIds={brokenPhotoIds}
        clientPhone={clientPhone}
        count={count}
        hasDiscount={hasDiscount}
        liveOps={liveOps}
        markBrokenPhoto={markBrokenPhoto}
        isLoadingPhotos={isLoadingPhotos}
        loadMorePhotos={loadMorePhotos}
        photoPageCounts={photoPageCounts}
        photoPageError={photoPageError}
        photosPage={photosPage}
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
        watermarkSettings={shareSessionInfo?.watermarkSettings || watermarkSettings}
      />
    );
  }

  if (screen === 'summary') {
    return renderScreen(
      <SummaryScreen
        activeStage={activeStage}
        clientName={clientName}
        clientEmail={clientEmail}
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
        setClientEmail={setClientEmail}
        setClientName={setClientName}
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

  if (screen === 'manual-pending') {
    return renderScreen(
      <ManualPaymentPendingScreen
        activeStage={activeStage}
        clientName={clientName}
        clientPhone={clientPhone}
        count={count}
        liveOps={liveOps}
        noticeBanner={noticeBanner}
        pricingOptions={pricingOptions}
        sessionId={sessionId}
        setScreen={setScreen}
        shareToken={shareToken}
        total={total}
        type={type}
      />
    );
  }

  if (screen === 'pix') {
    return renderScreen(
      <PixScreen
        activeStage={activeStage}
        clientName={clientName}
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
    return renderScreen(
      <ConfirmedScreen
        activeStage={activeStage}
        clientName={clientName}
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
