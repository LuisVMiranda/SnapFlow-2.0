export function StoryDeliveryToggle({
  checked,
  onChange,
}) {
  return (
    <label className="summary-label story-delivery-toggle">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      Ativar Stories na galeria
    </label>
  );
}
