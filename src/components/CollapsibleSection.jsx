import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

export function CollapsibleSection({
  children,
  defaultOpen = false,
  emoji,
  help,
  title,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const label = `${emoji ? `${emoji} ` : ''}${title}`;

  return (
    <section className={`summary-card collapsible-section ${isOpen ? 'open' : ''}`}>
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        className="collapsible-section-toggle"
        type="button"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="collapsible-section-title">
          <span aria-hidden="true" className="collapsible-section-emoji">{emoji}</span>
          <span>{title}</span>
        </span>
        <ChevronDown aria-hidden="true" className="collapsible-section-icon" size={18} />
      </button>
      {help ? <small className="summary-help collapsible-section-help">{help}</small> : null}
      <div
        aria-hidden={!isOpen}
        aria-label={label}
        className="collapsible-section-body"
        hidden={!isOpen}
        id={contentId}
      >
        {children}
      </div>
    </section>
  );
}
