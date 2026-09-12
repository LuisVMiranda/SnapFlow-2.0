export const CONTACT_REASONS = ['Agendar sessão', 'Dúvida sobre galeria', 'Orçamento/serviços', 'Comprar/licenciar uma foto', 'Outro'];

export function contactUrl(phone, name, reason) {
  const normalized = String(name).replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 80 || !CONTACT_REASONS.includes(reason) || !/^\d{7,15}$/.test(phone)) return '';
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Meu nome é ${normalized}. Entro em contato pelo site sobre: ${reason}.`)}`;
}

export function initializeContact(doc, navigate = (url) => window.location.assign(url)) {
  const form = doc.querySelector('#contactForm');
  const button = doc.querySelector('#sendContact');
  const feedback = doc.querySelector('#formFeedback');
  const link = doc.querySelector('#photographerWhatsApp');
  let contact = { enabled: false };
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!contact.enabled) return;
    const url = contactUrl(contact.phone, form.elements.nome.value, form.elements.motivo.value);
    if (!url) { feedback.textContent = 'Preencha seu nome e selecione o motivo do contato.'; return; }
    navigate(url);
  });
  function configure(value) {
    if (!form) return;
    contact = { ...value, enabled: Boolean(value?.enabled && /^\d{7,15}$/.test(value.phone)) };
    button.disabled = !contact.enabled;
    feedback.textContent = contact.enabled ? '' : 'O contato por WhatsApp ainda não está disponível. Tente novamente mais tarde.';
    link.hidden = !contact.enabled;
    if (contact.enabled) { link.href = `https://wa.me/${contact.phone}`; link.textContent = contact.label; }
  }
  return { configure };
}
