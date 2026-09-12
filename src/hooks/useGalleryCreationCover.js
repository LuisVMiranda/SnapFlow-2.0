import { useCallback, useState } from 'react';
import { uploadGalleryCover } from '../lib/websiteApi';

export function useGalleryCreationCover(adminHeaders) {
  const [draft, setDraft] = useState({ galleryName: '', galleryDescription: '', file: null });
  const [attempts, setAttempts] = useState([]);
  const [busy, setBusy] = useState(false);

  async function save(attempt) {
    setBusy(true);
    try {
      await uploadGalleryCover(attempt.token, attempt.file, adminHeaders);
      setAttempts((current) => current.filter((item) => item.token !== attempt.token));
    } catch (failure) {
      setAttempts((current) => [...current.filter((item) => item.token !== attempt.token), { ...attempt, error: failure.message }]);
    } finally { setBusy(false); }
  }
  async function onGalleryCreated(token) {
    if (!draft.file || !token) return;
    await save({ token, file: draft.file });
  }
  const reset = useCallback(() => {
    setDraft({ galleryName: '', galleryDescription: '', file: null });
  }, []);
  const pending = attempts[0] || null;
  return { draft, setDraft, pending, busy, error: pending?.error || '', reset, retry: () => save(pending),
    options: { galleryName: draft.galleryName, galleryDescription: draft.galleryDescription, onGalleryCreated } };
}
