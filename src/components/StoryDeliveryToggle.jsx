import { STORY_DELIVERY_SETUP_MESSAGE, overlayAssetHasStoryProfile } from '../lib/storyDelivery';

export function StoryDeliveryToggle({
  activeOverlayAsset,
  activeOverlayEnabled,
  checked,
  onChange,
  setNotice = () => {},
}) {
  const handleChange = (event) => {
    if (event.target.checked && (!activeOverlayEnabled || !overlayAssetHasStoryProfile(activeOverlayAsset))) {
      setNotice(STORY_DELIVERY_SETUP_MESSAGE);
      return;
    }
    onChange(event.target.checked);
  };

  return (
    <label className="summary-label story-delivery-toggle">
      <input checked={checked} type="checkbox" onChange={handleChange} />
      Ativar Stories na galeria
    </label>
  );
}
