import { EyeOff, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const GROUP_META = {
  api: {
    title: 'Chaves e APIs',
    description: 'Segredos ficam mascarados e nunca retornam completos depois de salvos.',
  },
  profile: {
    title: 'Dados do fotógrafo',
    description: 'Informações comerciais usadas para identificação, contato e exibição de pagamento.',
  },
};

function emptyDrafts(groups) {
  return [...(groups.api || []), ...(groups.profile || [])].reduce((acc, item) => {
    acc[item.key] = item.sensitive ? '' : item.maskedValue || '';
    return acc;
  }, {});
}

export function CredentialsPanel({
  credentialsData = { api: [], profile: [] },
  credentialsStatus,
  deleteCredential,
  saveCredential,
}) {
  const [drafts, setDrafts] = useState({});
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    setDrafts(emptyDrafts(credentialsData));
  }, [credentialsData]);

  const openSave = (credential) => {
    setPendingAction({ type: 'save', credential, value: drafts[credential.key] || '' });
    setConfirmation('');
  };

  const openDelete = (credential) => {
    setPendingAction({ type: 'delete', credential });
    setConfirmation('');
  };

  const closeConfirmation = () => {
    setPendingAction(null);
    setConfirmation('');
  };

  const confirmAction = async (event) => {
    event.preventDefault();
    if (!pendingAction) return;
    const payload = { key: pendingAction.credential.key, confirmation };
    const ok = pendingAction.type === 'save'
      ? await saveCredential({ ...payload, value: pendingAction.value })
      : await deleteCredential(payload);
    if (ok) closeConfirmation();
  };

  return (
    <section className="admin-panel credentials-panel">
      {['api', 'profile'].map((groupKey) => (
        <div className="summary-card credentials-group" key={groupKey}>
          <div className="credentials-group-header">
            <div>
              <div className="summary-label">{GROUP_META[groupKey].title}</div>
              <small className="summary-help">{GROUP_META[groupKey].description}</small>
            </div>
          </div>

          <div className="credentials-grid">
            {(credentialsData[groupKey] || []).map((credential) => (
              <article className="credential-card" key={credential.key}>
                <div className="credential-card-header">
                  <div>
                    <strong>{credential.label}</strong>
                    <small>{credential.source === 'database' ? 'Banco de dados' : credential.source === 'ambiente' ? 'Arquivo de ambiente' : 'Não configurado'}</small>
                  </div>
                  {credential.sensitive ? <EyeOff size={18} aria-label="Valor sensível mascarado" /> : null}
                </div>

                <div className="credential-mask">
                  {credential.configured ? credential.maskedValue : 'Não configurado'}
                </div>

                <label className="credential-input-label">
                  Novo valor
                  <input
                    className="phone-input"
                    type={credential.sensitive ? 'password' : 'text'}
                    value={drafts[credential.key] || ''}
                    onChange={(event) =>
                      setDrafts((previous) => ({ ...previous, [credential.key]: event.target.value }))
                    }
                    placeholder={credential.sensitive ? 'Digite um novo valor' : 'Editar valor'}
                  />
                </label>

                <div className="credential-actions">
                  <button
                    className="share-quick-btn"
                    type="button"
                    onClick={() => openSave(credential)}
                    disabled={!String(drafts[credential.key] || '').trim()}
                  >
                    <Save size={14} />
                    Salvar
                  </button>
                  <button
                    className="share-quick-btn share-quick-btn-danger"
                    type="button"
                    onClick={() => openDelete(credential)}
                    disabled={!credential.configured}
                  >
                    <Trash2 size={14} />
                    Deletar
                  </button>
                </div>

                {credential.updatedAt ? (
                  <small className="summary-help">Atualizado em {new Date(credential.updatedAt).toLocaleString('pt-BR')}</small>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ))}

      {pendingAction ? (
        <div className="account-modal-backdrop" role="presentation">
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="credential-confirmation-title">
            <header className="account-modal-header">
              <div>
                <h2 id="credential-confirmation-title">Confirmar alteração</h2>
                <small>Digite a senha administrativa para {pendingAction.type === 'save' ? 'salvar' : 'deletar'} este dado.</small>
              </div>
              <button type="button" className="account-icon-button" onClick={closeConfirmation} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            <form className="account-form" onSubmit={confirmAction}>
              <label htmlFor="credential-confirmation">Senha administrativa</label>
              <input
                id="credential-confirmation"
                className="phone-input"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="current-password"
              />

              <button className="btn-primary" type="submit" disabled={credentialsStatus !== 'idle' || !confirmation.trim()}>
                {credentialsStatus === 'idle' ? 'Confirmar' : 'Processando...'}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
