import { Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const TEMPLATE_ITEMS = [
  {
    key: 'shareLink',
    title: 'Link da galeria',
    help: 'Usada ao criar ou recriar galerias compartilhadas.',
  },
  {
    key: 'paymentWaiting',
    title: 'Aguardando pagamento',
    help: 'Usada como mensagem de cobrança enquanto o pagamento ainda não foi confirmado.',
  },
  {
    key: 'deliveryThanks',
    title: 'Agradecimento e envio',
    help: 'Enviada antes dos arquivos finais na fila do WhatsApp.',
  },
];

const PLACEHOLDERS = [
  {
    token: '{name}',
    help: 'Nome do cliente informado na criação ou edição da galeria. Se ficar vazio, o envio usa "cliente".',
  },
  {
    token: '{link}',
    help: 'URL completa da galeria ou do pedido. No WhatsApp, precisa aparecer para ficar clicável.',
  },
  {
    token: '{linkLabel}',
    help: 'Texto curto que apresenta o link, como "Abrir galeria". Não vira link sozinho.',
  },
  {
    token: '{linkText}',
    help: 'Combina rótulo e URL em uma frase pronta, como "Abrir galeria: https://...".',
  },
  {
    token: '{code}',
    help: 'Código de acesso que o cliente digita para abrir a galeria protegida.',
  },
  {
    token: '{expiresMinutes}',
    help: 'Tempo, em minutos, antes do link da galeria expirar.',
  },
  {
    token: '{count}',
    help: 'Quantidade de fotos selecionadas ou enviadas nessa etapa.',
  },
  {
    token: '{total}',
    help: 'Valor total do pedido que será cobrado do cliente.',
  },
  {
    token: '{phone}',
    help: 'Telefone do cliente informado no pedido.',
  },
  {
    token: '{sessionId}',
    help: 'Identificador interno da venda, útil para conferência e suporte.',
  },
];

function createDraft(templates = {}) {
  return TEMPLATE_ITEMS.reduce((draft, item) => {
    const template = templates[item.key] || {};
    draft[item.key] = {
      ...template,
      label: template.label || item.title,
      body: template.body || '',
    };
    return draft;
  }, {});
}

function placeholderId(token) {
  return `template-help-${token.replace(/[^a-zA-Z0-9]/g, '')}`;
}

function textareaRows(value) {
  const rows = String(value || '')
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 76)), 0);
  return Math.max(5, rows + 1);
}

function tooltipPositionFor(element) {
  if (!element || typeof window === 'undefined') return { left: 160, top: 120 };
  const rect = element.getBoundingClientRect();
  const tooltipWidth = 260;
  const margin = 16;
  const left = Math.min(
    window.innerWidth - margin - tooltipWidth / 2,
    Math.max(margin + tooltipWidth / 2, rect.left + rect.width / 2)
  );
  const top = Math.min(window.innerHeight - 96, rect.bottom + 8);
  return { left, top };
}

function PlaceholderPill({ isActive, onActivate, onClear, placeholder, tooltipPosition }) {
  const tooltipId = placeholderId(placeholder.token);
  return (
    <span className="template-placeholder-wrap">
      <button
        type="button"
        className="template-placeholder-pill"
        aria-describedby={tooltipId}
        aria-expanded={isActive}
        onBlur={onClear}
        onClick={(event) => onActivate(event.currentTarget)}
        onFocus={(event) => onActivate(event.currentTarget)}
        onMouseEnter={(event) => onActivate(event.currentTarget)}
        onMouseLeave={onClear}
      >
        {placeholder.token}
      </button>
      <span
        aria-hidden={!isActive}
        className={`template-placeholder-tooltip ${isActive ? 'active' : ''}`}
        id={tooltipId}
        role={isActive ? 'tooltip' : undefined}
        style={
          isActive
            ? {
                '--tooltip-left': `${tooltipPosition.left}px`,
                '--tooltip-top': `${tooltipPosition.top}px`,
              }
            : undefined
        }
      >
        {placeholder.help}
      </span>
    </span>
  );
}

export function WhatsAppTemplatesPanel({
  embedded = false,
  saveWhatsAppTemplates,
  status = 'idle',
  templates,
}) {
  const [draft, setDraft] = useState(() => createDraft(templates));
  const [activeTooltip, setActiveTooltip] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ left: 160, top: 120 });
  const isSaving = status === 'saving';

  useEffect(() => {
    setDraft(createDraft(templates));
  }, [templates]);

  const canSave = useMemo(
    () => TEMPLATE_ITEMS.every((item) => String(draft[item.key].body || '').trim()),
    [draft]
  );

  const updateBody = (key, body) => {
    setDraft((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        body,
      },
    }));
  };

  const handleSave = async () => {
    if (typeof saveWhatsAppTemplates !== 'function') return;
    await saveWhatsAppTemplates(draft);
  };

  const activateTooltip = (token, element) => {
    setTooltipPosition(tooltipPositionFor(element));
    setActiveTooltip(token);
  };

  return (
    <div className={`${embedded ? '' : 'summary-card '}whatsapp-templates-card`}>
      <div className="whatsapp-templates-header">
        {!embedded ? (
          <div>
            <div className="summary-label">Mensagens do WhatsApp</div>
            <small className="summary-help">
              Personalize os textos enviados ou copiados para o cliente em cada etapa da venda.
            </small>
          </div>
        ) : <span />}
        <button
          type="button"
          className="btn-manual btn-manual-card whatsapp-template-save"
          onClick={handleSave}
          disabled={isSaving || !canSave}
        >
          <Save size={16} />
          {isSaving ? 'Salvando...' : 'Salvar mensagens'}
        </button>
      </div>

      <div className="template-placeholder-list" aria-label="Variáveis disponíveis">
        {PLACEHOLDERS.map((placeholder) => (
          <PlaceholderPill
            isActive={activeTooltip === placeholder.token}
            key={placeholder.token}
            onActivate={(element) => activateTooltip(placeholder.token, element)}
            onClear={() => setActiveTooltip('')}
            placeholder={placeholder}
            tooltipPosition={tooltipPosition}
          />
        ))}
      </div>
      <small className="summary-help">
        No WhatsApp comum, a URL precisa aparecer para ficar clicável. Use {'{linkText}'} para enviar o rótulo junto do link.
      </small>

      <div className="whatsapp-template-list">
        {TEMPLATE_ITEMS.map((item) => {
          const textareaId = `whatsapp-template-${item.key}`;
          return (
            <label className="whatsapp-template-item" htmlFor={textareaId} key={item.key}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.help}</small>
              </span>
              <textarea
                id={textareaId}
                aria-label={item.title}
                className="phone-input whatsapp-template-textarea"
                value={draft[item.key].body || ''}
                maxLength={1200}
                onChange={(event) => updateBody(item.key, event.target.value)}
                rows={textareaRows(draft[item.key].body)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
