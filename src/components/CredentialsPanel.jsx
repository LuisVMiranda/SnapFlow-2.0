import { EyeOff, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildCredentialDrafts, changedCredentialDrafts } from '../lib/credentials';

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

function SaveAllButton({ disabled, onClick, placement }) {
  return (
    <button
      className="btn-primary credentials-save-all"
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-placement={placement}
    >
      <Save size={16} />
      Salvar alterações
    </button>
  );
}

export function CredentialsPanel({
  credentialsData = { api: [], profile: [] },
  credentialsStatus,
  deleteCredential,
  saveCredential,
  saveCredentialsBatch,
}) {
  const [drafts, setDrafts] = useState({});
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [saveResults, setSaveResults] = useState({});
  const dirtyChanges = changedCredentialDrafts(credentialsData, drafts);

  useEffect(() => {
    setDrafts(buildCredentialDrafts(credentialsData));
  }, [credentialsData]);

  const openSaveAll = () => {
    if (!dirtyChanges.length) return;
    setPendingAction({ type: 'saveAll', changes: dirtyChanges });
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
    let ok;
    if (pendingAction.type === 'saveAll') {
      const saver = saveCredentialsBatch || (async ({ changes }) => {
        const results = {};
        for (const change of changes) {
          results[change.key] = await saveCredential({ ...change, confirmation })
            ? { status: 'saved' }
            : { status: 'failed', error: 'Falha ao salvar.' };
        }
        return { ok: Object.values(results).every((result) => result.status === 'saved'), results };
      });
      const result = await saver({ changes: pendingAction.changes, confirmation });
      setSaveResults(result.results || {});
      setDrafts((previous) => {
        const next = { ...previous };
        for (const change of pendingAction.changes) {
          if (result.results?.[change.key]?.status === 'failed') next[change.key] = change.value;
        }
        return next;
      });
      closeConfirmation();
      return;
    } else {
      const payload = { key: pendingAction.credential.key, confirmation };
      ok = await deleteCredential(payload);
    }
    if (ok) closeConfirmation();
  };

  return (
    <section className="admin-panel credentials-panel">
      <div className="credentials-global-actions">
        <SaveAllButton
          disabled={credentialsStatus !== 'idle' || dirtyChanges.length === 0}
          onClick={openSaveAll}
          placement="top"
        />
        <small className="summary-help">
          {dirtyChanges.length ? `${dirtyChanges.length} campo(s) pendente(s).` : 'Nenhuma alteração pendente.'}
        </small>
      </div>

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
                    className="share-quick-btn share-quick-btn-danger"
                    type="button"
                    onClick={() => openDelete(credential)}
                    disabled={!credential.configured}
                  >
                    <Trash2 size={14} />
                    Deletar
                  </button>
                </div>

                {saveResults[credential.key] ? (
                  <small className={`summary-help credential-result ${saveResults[credential.key].status}`}>
                    {saveResults[credential.key].status === 'saved'
                      ? 'Salvo.'
                      : saveResults[credential.key].error || 'Falha ao salvar.'}
                  </small>
                ) : null}

                {credential.updatedAt ? (
                  <small className="summary-help">Atualizado em {new Date(credential.updatedAt).toLocaleString('pt-BR')}</small>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ))}

      <div className="credentials-global-actions bottom">
        <SaveAllButton
          disabled={credentialsStatus !== 'idle' || dirtyChanges.length === 0}
          onClick={openSaveAll}
          placement="bottom"
        />
      </div>

      {pendingAction ? (
        <div className="account-modal-backdrop" role="presentation">
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="credential-confirmation-title">
            <header className="account-modal-header">
              <div>
                <h2 id="credential-confirmation-title">Confirmar alteração</h2>
                <small>
                  Digite a senha administrativa para{' '}
                  {pendingAction.type === 'saveAll'
                    ? `salvar ${pendingAction.changes.length} alteração(ões)`
                    : 'deletar este dado'}.
                </small>
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
