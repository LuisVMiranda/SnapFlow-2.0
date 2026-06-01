import './index.css';
import { PhotoViewer } from './components/PhotoViewer';
import { PendingManualApprovalPrompt } from './components/PendingManualApprovalPrompt';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { AdminApprovalScreen } from './screens/AdminApprovalScreen';
import { ConfirmedScreen } from './screens/ConfirmedScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { ManualPaymentPendingScreen } from './screens/ManualPaymentPendingScreen';
import { PixScreen } from './screens/PixScreen';
import { ShareLockScreen } from './screens/ShareLockScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { usePhotoPresets } from './hooks/usePhotoPresets';
import { useSnapFlowController } from './hooks/useSnapFlowController';
import { useOverlayAssets } from './hooks/useOverlayAssets';
import { useWatermarkAssets } from './hooks/useWatermarkAssets';
import { useEffect, useState } from 'react';
import { buildAdminApprovalUrl, readAdminApprovalSessionId } from './lib/adminApproval';

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
    approvePendingManualSession,
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
    discountAmount,
    discountValidation,
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
    manualDiscountDraft,
    manualDiscountEnabled,
    loadMorePhotos,
    loginAdmin,
    logoutAdmin,
    markBrokenPhoto,
    noticeBanner,
    notificationCenter,
    packageSettingsStatus,
    pendingManualSessions,
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
    setManualDiscountDraft,
    setManualDiscountEnabled,
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
    subtotal,
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
  const {
    createPhotoPreset,
    deletePhotoPreset,
    photoPresets,
    photoPresetStatus,
    updatePhotoPreset,
  } = usePhotoPresets({ adminJsonHeaders, isAdminUnlocked, setNotice });
  const {
    deleteOverlayAsset,
    overlayAssets,
    overlayAssetStatus,
    updateOverlayAsset,
    uploadOverlayAsset,
  } = useOverlayAssets({
    adminHeaders,
    adminJsonHeaders,
    isAdminUnlocked,
    setNotice,
    withAdminMediaToken,
  });
  const {
    deleteWatermarkAsset,
    updateWatermarkAsset,
    uploadWatermarkAsset,
    watermarkAssets,
    watermarkAssetStatus,
  } = useWatermarkAssets({
    adminHeaders,
    adminJsonHeaders,
    isAdminUnlocked,
    setNotice,
    withAdminMediaToken,
  });
  const [selectedPhotoPresetIds, setSelectedPhotoPresetIds] = useState([]);
  const [selectedOverlayAssetId, setSelectedOverlayAssetId] = useState('');
  const [selectedOverlaySettings, setSelectedOverlaySettings] = useState({});
  const [busyPendingApprovalId, setBusyPendingApprovalId] = useState('');
  const safeShareSessionInfo = shareSessionInfo && typeof shareSessionInfo === 'object' ? shareSessionInfo : {};
  const effectiveWatermarkSettings = safeShareSessionInfo.watermarkSettings || watermarkSettings;
  const effectiveOverlaySettings = safeShareSessionInfo.overlaySettings || { enabled: false };

  useEffect(() => {
    if (screen === 'dashboard' || shareToken) {
      setSelectedPhotoPresetIds([]);
      setSelectedOverlayAssetId('');
      setSelectedOverlaySettings({});
    }
  }, [screen, shareToken]);

  const adminApprovalSessionId = readAdminApprovalSessionId();
  const approveFromPrompt = async (targetSessionId) => {
    setBusyPendingApprovalId(targetSessionId);
    try {
      await approvePendingManualSession(targetSessionId);
    } finally {
      setBusyPendingApprovalId('');
    }
  };
  const openApprovalFromPrompt = (targetSessionId) => {
    if (!targetSessionId || typeof window === 'undefined') return;
    window.open(buildAdminApprovalUrl(targetSessionId), '_blank', 'noopener,noreferrer');
  };
  const pendingApprovalPrompt = isAdminUnlocked ? (
    <PendingManualApprovalPrompt
      busySessionId={busyPendingApprovalId}
      onApprove={approveFromPrompt}
      onOpenApproval={openApprovalFromPrompt}
      sessions={adminApprovalSessionId ? [] : pendingManualSessions}
    />
  ) : null;
  const renderScreen = (content) => (
    <>
      {content}
      {pendingApprovalPrompt}
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
        total={subtotal}
        setViewerIndex={setViewerIndex}
        markBrokenPhoto={markBrokenPhoto}
        overlaySettings={effectiveOverlaySettings}
        toggle={toggle}
        watermarkSettings={effectiveWatermarkSettings}
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
        createPhotoPreset={createPhotoPreset}
        dashData={dashData}
        deletePhotoPreset={deletePhotoPreset}
        deleteOverlayAsset={deleteOverlayAsset}
        deleteWatermarkAsset={deleteWatermarkAsset}
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
        notificationCenter={notificationCenter}
        packageSettingsStatus={packageSettingsStatus}
        photoPresets={photoPresets}
        photoPresetStatus={photoPresetStatus}
        overlayAssets={overlayAssets}
        overlayAssetStatus={overlayAssetStatus}
        watermarkAssets={watermarkAssets}
        watermarkAssetStatus={watermarkAssetStatus}
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
        updatePhotoPreset={updatePhotoPreset}
        updateOverlayAsset={updateOverlayAsset}
        updateWatermarkAsset={updateWatermarkAsset}
        uploadOverlayAsset={uploadOverlayAsset}
        uploadWatermarkAsset={uploadWatermarkAsset}
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
        shareSessionInfo={safeShareSessionInfo}
        shareToken={shareToken}
        subtotal={subtotal}
        toggle={toggle}
        toggleAllPhotos={toggleAllPhotos}
        total={subtotal}
        type={type}
        unit={unit}
        overlaySettings={effectiveOverlaySettings}
        watermarkSettings={effectiveWatermarkSettings}
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
        discountAmount={discountAmount}
        discountValidation={discountValidation}
        handleCreateShareSession={handleCreateShareSession}
        handleExtendShareSession={handleExtendShareSession}
        handleGeneratePix={handleGeneratePix}
        handleManualPayment={handleManualPayment}
        handleRevokeShareSession={handleRevokeShareSession}
        isGeneratingPix={isGeneratingPix}
        liveOps={liveOps}
        manualDiscountDraft={manualDiscountDraft}
        manualDiscountEnabled={manualDiscountEnabled}
        noticeBanner={noticeBanner}
        overlayAssets={overlayAssets}
        photoPresets={photoPresets}
        pricingOptions={pricingOptions}
        resetSession={resetSession}
        selectedPhotoItems={selectedPhotoItems}
        selectedOverlayAssetId={selectedOverlayAssetId}
        selectedOverlaySettings={selectedOverlaySettings}
        selectedPhotoPresetIds={selectedPhotoPresetIds}
        setClientEmail={setClientEmail}
        setClientName={setClientName}
        setClientPhone={setClientPhone}
        setManualDiscountDraft={setManualDiscountDraft}
        setManualDiscountEnabled={setManualDiscountEnabled}
        setNotice={setNotice}
        setSelectedOverlayAssetId={setSelectedOverlayAssetId}
        setSelectedOverlaySettings={setSelectedOverlaySettings}
        setSelectedPhotoPresetIds={setSelectedPhotoPresetIds}
        setScreen={setScreen}
        setShareDurationMinutes={setShareDurationMinutes}
        shareAccess={shareAccess}
        shareActionLoading={shareActionLoading}
        shareDurationMinutes={shareDurationMinutes}
        shareToken={shareToken}
        subtotal={subtotal}
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
        discountAmount={discountAmount}
        liveOps={liveOps}
        noticeBanner={noticeBanner}
        pricingOptions={pricingOptions}
        sessionId={sessionId}
        setScreen={setScreen}
        shareToken={shareToken}
        subtotal={subtotal}
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
        discountAmount={discountAmount}
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
        subtotal={subtotal}
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
        discountAmount={discountAmount}
        fetchDashboard={fetchDashboard}
        liveOps={liveOps}
        noticeBanner={noticeBanner}
        pricingOptions={pricingOptions}
        resetSession={resetSession}
        setScreen={setScreen}
        shareToken={shareToken}
        subtotal={subtotal}
        total={total}
        type={type}
      />
    );
  }

  return null;
}
