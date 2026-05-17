export const DEFAULT_PRICING = {
  eventos: {
    label: 'Pacote 5+ fotos',
    shortLabel: 'Eventos',
    description: 'R$ 15 por foto, cai para R$ 10 a partir de 5 fotos.',
    unit: 15,
    bulk: 10,
    threshold: 5,
  },
  escola: {
    label: 'Pacote 3+ fotos',
    shortLabel: 'Escola / Corp',
    description: 'R$ 15 por foto, cai para R$ 10 a partir de 3 fotos.',
    unit: 15,
    bulk: 10,
    threshold: 3,
  },
};

export const PRICING = DEFAULT_PRICING;

export const PAYMENT_META = {
  draft: { label: 'Montando sessão', tone: 'neutral' },
  pending: { label: 'Aguardando PIX', tone: 'info' },
  approved: { label: 'Pagamento aprovado', tone: 'success' },
  cancelled: { label: 'Liberação cancelada', tone: 'danger' },
};

export const DELIVERY_META = {
  idle: { label: 'Envio ainda não iniciado', tone: 'neutral' },
  queued: { label: 'Fila de envio preparada', tone: 'info' },
  sending: { label: 'Enviando no WhatsApp', tone: 'info' },
  sent: { label: 'Fotos entregues', tone: 'success' },
  failed: { label: 'Falha no envio', tone: 'danger' },
  cancelled: { label: 'Envio cancelado', tone: 'danger' },
};

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePricingOptions(value) {
  const entries = Object.entries(value || {}).slice(0, 12);
  const normalized = {};

  for (const [key, option] of entries) {
    const safeKey = String(key || '').trim();
    if (!safeKey) continue;
    const unit = positiveNumber(option?.unit, 15);
    const bulk = positiveNumber(option?.bulk, unit);
    const threshold = Math.max(1, Math.round(positiveNumber(option?.threshold, 1)));
    const label = String(option?.label || option?.shortLabel || safeKey).trim();
    const shortLabel = String(option?.shortLabel || label).trim();
    normalized[safeKey] = {
      label,
      shortLabel,
      description: String(
        option?.description || `R$ ${unit} por foto, cai para R$ ${bulk} a partir de ${threshold} fotos.`
      ).trim(),
      unit,
      bulk,
      threshold,
    };
  }

  return Object.keys(normalized).length ? normalized : DEFAULT_PRICING;
}

export function firstPackageKey(pricingOptions = DEFAULT_PRICING) {
  return Object.keys(pricingOptions)[0] || 'eventos';
}

export function pricingForType(type, pricingOptions = DEFAULT_PRICING) {
  return pricingOptions[type] || pricingOptions[firstPackageKey(pricingOptions)];
}

export function packageLabel(type, pricingOptions = DEFAULT_PRICING, fallback = 'Sem pacote') {
  return type && pricingOptions[type] ? pricingOptions[type].shortLabel : fallback;
}

export function calcTotal(count, type, pricingOptions = DEFAULT_PRICING) {
  const pricing = pricingForType(type, pricingOptions);
  const unit = count >= pricing.threshold ? pricing.bulk : pricing.unit;
  return { unit, total: count * unit };
}

export function reachesPackageThreshold(count, type, pricingOptions = DEFAULT_PRICING) {
  const pricing = pricingForType(type, pricingOptions);
  return {
    eligible: Number(count || 0) >= Number(pricing.threshold || 0),
    threshold: Number(pricing.threshold || 0),
  };
}

export function buildPackageNudge(count, type, pricingOptions = DEFAULT_PRICING) {
  const pricing = pricingForType(type, pricingOptions);
  const safeCount = Math.max(0, Number(count) || 0);
  const threshold = Math.max(1, Number(pricing.threshold) || 1);
  const unit = Number(pricing.unit) || 0;
  const bulk = Number(pricing.bulk) || unit;
  const missing = Math.max(0, threshold - safeCount);
  const packageTotal = threshold * bulk;
  const unitTotalAtThreshold = threshold * unit;
  const savingsAtThreshold = Math.max(0, unitTotalAtThreshold - packageTotal);

  if (safeCount <= 0) {
    return {
      active: false,
      missing,
      recommended: true,
      title: 'Pacote recomendado',
      message: `Escolha ${threshold} foto(s) para ativar ${formatPackagePrice(bulk)} por foto.`,
      savings: savingsAtThreshold,
    };
  }

  if (missing > 0) {
    const currentTotal = safeCount * unit;
    const extraCostToThreshold = Math.max(0, packageTotal - currentTotal);
    return {
      active: false,
      missing,
      recommended: true,
      title: 'Melhor oportunidade',
      message: `Adicione ${missing} foto(s) para pagar ${formatPackagePrice(bulk)} por foto no pacote.`,
      extraCostToThreshold,
      savings: savingsAtThreshold,
    };
  }

  return {
    active: true,
    missing: 0,
    recommended: true,
    title: 'Melhor escolha ativa',
    message: `Pacote ativado: ${formatPackagePrice(bulk)} por foto.`,
    savings: Math.max(0, safeCount * unit - safeCount * bulk),
  };
}

function formatPackagePrice(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
