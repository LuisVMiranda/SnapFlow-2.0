# SnapFlow 2.0

SnapFlow é um painel de venda, cobrança, galeria e entrega de fotos para uso presencial em eventos, turismo, escolas, ações corporativas e atendimentos rápidos. Ele ajuda o fotógrafo a selecionar fotos, cobrar o cliente, liberar a compra e entregar os arquivos pelo WhatsApp com menos passos manuais.

## Principais recursos

- Upload de fotos pelo painel, com miniaturas, pré-visualizações e armazenamento privado.
- Seleção de fotos por cliente, com contador, pacote ativo e cálculo automático de preço.
- Pacotes e preços editáveis no painel administrativo.
- Campo de cliente editável para registrar quem vai acessar e pagar pelas fotos.
- Pagamento por Pix via Mercado Pago, com QR Code e código Pix copia e cola.
- Webhook do Mercado Pago para aprovar Pix quando o pagamento muda para aprovado.
- Notificação visível para o administrador quando o Pix é confirmado.
- Pagamento em dinheiro ou cartão sempre aguardando aprovação administrativa explícita.
- Tela focada de aprovação manual em nova aba, sem travar a venda em andamento.
- Fila de entrega das fotos pelo WhatsApp como documento, preservando qualidade.
- Botão para reenviar fotos quando uma entrega falha.
- Pareamento do WhatsApp dentro do painel, com QR Code visível em Vendas/Galerias.
- Galerias compartilhadas com link temporário, código de acesso e expiração.
- Recriação/revalidação intencional de galeria sem duplicar links desnecessários.
- Edição de galeria pelo admin: visualizar fotos, adicionar, remover, alterar telefone, cliente, código, pacote, total e tempo.
- Revogar, estender, copiar e abrir links compartilhados.
- Proteções no modo cliente para reduzir cópia indevida e acesso fora da galeria.
- Dashboard de vendas com períodos diário, semanal, mensal e anual.
- Botão para limpar estatísticas de vendas com confirmação dupla, sem apagar galerias.
- Configurações de retenção e limpeza de arquivos.
- Credenciais editáveis pelo painel com um único salvamento global e confirmação de senha.
- Modelos de mensagens WhatsApp editáveis, com variáveis como `{name}`, `{link}`, `{code}`, `{count}` e `{total}`.
- Notificações responsivas: topo em celular/tablet e lateral direita em desktop, com botão de fechar.
- Botão global de voltar ao topo.

## Como o fluxo funciona

### Fluxo do fotógrafo

1. Abre o painel administrativo.
2. Seleciona ou envia as fotos.
3. Escolhe o pacote de venda.
4. Informa o nome do cliente e o WhatsApp.
5. Finaliza por Pix, dinheiro/cartão ou cria uma galeria compartilhada.
6. Acompanha a aprovação e a entrega no painel.

### Fluxo do cliente

1. Recebe um link da galeria no WhatsApp.
2. Acessa a galeria com o código de 4 caracteres.
3. Escolhe as fotos.
4. Paga por Pix ou solicita pagamento manual.
5. Recebe as fotos pelo WhatsApp depois da liberação.

### Entrega

- Pix aprovado pelo Mercado Pago libera a sessão automaticamente quando o webhook chega ao backend.
- Dinheiro/cartão só libera depois da aprovação manual do administrador.
- Depois da aprovação, a fila de entrega envia as fotos pelo WhatsApp.
- Se o WhatsApp estiver indisponível ou o número estiver incorreto, o painel mostra erro e permite reenviar.

## Requisitos

- Node.js e npm.
- Docker Desktop para subir o PostgreSQL local com `docker compose`.
- Um token administrativo forte para proteger o painel.
- Conta Mercado Pago com token de acesso, se for usar Pix real.
- WhatsApp no celular para parear o cliente WhatsApp Web usado pelo backend.

## Configuração inicial

1. Instale as dependências:

```powershell
npm install
npm --prefix backend install
```

2. Crie o arquivo local de ambiente do backend:

```powershell
copy backend\.env.example backend\.env.local
```

3. Edite `backend\.env.local` com valores reais ou locais:

```env
DATABASE_URL=postgres://snapflow:sua-senha-local@127.0.0.1:55432/snapflow
ADMIN_ACCESS_TOKEN=um-token-longo-e-secreto
CREDENTIALS_SECRET=outro-segredo-longo-para-criptografar-credenciais
MP_ACCESS_TOKEN=APP_USR-seu-token-mercado-pago
MP_WEBHOOK_SECRET=seu-segredo-de-webhook
PUBLIC_BASE_URL=http://localhost:5173
HOST=127.0.0.1
PORT=3000
STORAGE_ROOT=./storage
```

4. Suba o PostgreSQL:

```powershell
cmd /c npm.cmd run db:up
```

5. Rode as migrações:

```powershell
cmd /c npm.cmd run db:migrate
```

## Como rodar localmente

### Opção rápida no Windows

Use:

```powershell
.\INICIAR_TUDO.bat
```

Esse arquivo abre o backend e o painel em janelas separadas.

### Opção manual

Terminal 1, backend:

```powershell
cd backend
npm run start
```

Terminal 2, frontend:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Depois acesse:

```text
http://localhost:5173
```

A API roda por padrão em:

```text
http://localhost:3000
```

Por segurança, o backend e o painel de desenvolvimento iniciam presos ao próprio computador (`127.0.0.1`). Para usar em VPS, Tailscale ou rede local confiável, abra esse acesso de forma intencional:

```env
HOST=0.0.0.0
```

```powershell
$env:SNAPFLOW_DEV_HOST="0.0.0.0"
$env:SNAPFLOW_ALLOWED_HOSTS="seu-host-publico.example"
npm run dev -- --host 0.0.0.0 --port 5173
```

Use essa opção somente com `ADMIN_ACCESS_TOKEN` forte, firewall configurado e `PUBLIC_BASE_URL` apontando para a URL confiável.

## Comandos úteis

```powershell
cmd /c npm.cmd run db:up
cmd /c npm.cmd run db:down
cmd /c npm.cmd run db:logs
cmd /c npm.cmd run db:migrate
cmd /c npm.cmd test -- --run
cmd /c npm.cmd --prefix backend test
cmd /c npm.cmd run lint
cmd /c npm.cmd run build
```

## PostgreSQL e armazenamento

- O banco local roda em `127.0.0.1:55432`.
- O banco padrão é `snapflow`.
- Os metadados ficam no PostgreSQL.
- As imagens ficam no diretório configurado em `STORAGE_ROOT`.
- O volume Docker se chama `snapflow_postgres_data`.
- Para detalhes de manutenção, veja `POSTGRESQL_MAINTENANCE.md`.

## Mercado Pago e Pix

O SnapFlow cria pagamentos Pix usando a API do Mercado Pago. Para confirmação automática:

1. Configure `MP_ACCESS_TOKEN`.
2. Configure `MP_WEBHOOK_SECRET`.
3. Cadastre no Mercado Pago o webhook público:

```text
https://SEU_DOMINIO/api/webhook
```

4. Habilite eventos de pagamento, como criação/atualização de pagamento.

Quando o Mercado Pago avisar que o pagamento foi aprovado, o backend aprova a sessão, coloca a entrega na fila e o painel mostra uma notificação ao administrador.

Importante: essa automação vale para pagamentos gerados pelo Mercado Pago. Uma transferência bancária avulsa que não esteja vinculada a um pagamento Mercado Pago não necessariamente entra nesse webhook.

## WhatsApp

O envio usa `whatsapp-web.js` no backend.

Como parear:

1. Inicie backend e frontend.
2. Abra o painel e valide o acesso administrativo.
3. Vá em `Vendas` ou `Galerias`.
4. No cartão `WhatsApp de envio`, escaneie o QR Code pelo celular em WhatsApp > Aparelhos conectados.
5. Aguarde o status ficar `PRONTO`.

Botões disponíveis:

- `Atualizar`: consulta o status atual.
- `Reconectar WhatsApp`: tenta reiniciar a conexão mantendo o pareamento.
- `Parear novamente`: inicia uma sessão local nova e exige novo QR Code.

Os diretórios de sessão do WhatsApp são locais e ignorados pelo Git.

## Painel administrativo

O painel é protegido por `ADMIN_ACCESS_TOKEN`.

Depois de entrar, o administrador pode:

- gerenciar galerias;
- acompanhar vendas;
- editar configurações;
- editar credenciais;
- aprovar pagamentos manuais;
- reenviar entregas com falha;
- limpar estatísticas;
- executar limpeza de retenção.

## Credenciais pelo painel

Em `Credenciais`, é possível salvar:

- token do Mercado Pago;
- segredo do webhook Mercado Pago;
- URL pública;
- nome do fotógrafo;
- nome do estúdio ou marca;
- telefone comercial;
- contato comercial;
- dados Pix para exibição.

As credenciais sensíveis ficam criptografadas com `CREDENTIALS_SECRET`. O painel mostra apenas valores mascarados.

## Modelos de WhatsApp

Em `Configurações`, os textos enviados ou copiados para o cliente podem ser editados.

Variáveis disponíveis:

- `{name}`: nome do cliente.
- `{link}`: URL da galeria ou pedido.
- `{linkLabel}`: rótulo curto do link.
- `{linkText}`: rótulo e link juntos.
- `{code}`: código de acesso da galeria.
- `{expiresMinutes}`: tempo de expiração.
- `{count}`: quantidade de fotos.
- `{total}`: valor total.
- `{phone}`: telefone do cliente.
- `{sessionId}`: identificador interno da venda.

## Galerias compartilhadas

Cada galeria tem token/link, código e identificador de metadados. Recriar ou revalidar uma galeria deve reaproveitar o registro correto, evitando acúmulo de galerias duplicadas.

No modo admin, `Ver/Editar` permite:

- ver prévias das fotos daquela galeria;
- adicionar fotos;
- remover fotos;
- alterar cliente;
- alterar WhatsApp;
- alterar pacote e total;
- alterar código de acesso;
- reabrir a galeria por mais minutos.

## Privacidade e Git

Arquivos pessoais, sensíveis e de runtime não devem ser enviados para o repositório.

O `.gitignore` cobre:

- `.env` e `.env.*`;
- banco local;
- uploads e storage;
- cache e autenticação do WhatsApp;
- mídias pessoais;
- dumps, backups, chaves e certificados.

Não versione fotos reais de clientes, QR Codes privados, tokens, sessões do WhatsApp, bancos locais ou arquivos de exportação.

## Estrutura do projeto

```text
src/                         Interface React
src/components/              Componentes do painel e da galeria
src/screens/                 Telas principais
src/hooks/                   Estado, polling e ações do app
src/lib/                     Utilitários, validações e regras de negócio do frontend
backend/server.js            Entrada da API
backend/src/routes/          Rotas Express
backend/src/repos/           Acesso ao PostgreSQL
backend/src/services/        Mercado Pago, mídia, WhatsApp, retenção e credenciais
backend/migrations/          Migrações do banco
public/                      Assets visuais do app
```

## Testes e validação

Antes de publicar mudanças, rode:

```powershell
cmd /c npm.cmd test -- --run
cmd /c npm.cmd --prefix backend test
cmd /c npm.cmd run lint
cmd /c npm.cmd run build
```

O projeto também tem testes de propriedades com `fast-check` para normalização de códigos, telefones, credenciais e comportamento do WhatsApp.

## Observações de produção

- Use HTTPS para `PUBLIC_BASE_URL` em produção.
- Configure o webhook do Mercado Pago apontando para a URL pública real.
- Use segredos únicos e longos.
- Mantenha `HOST=127.0.0.1` para uso local; use `HOST=0.0.0.0` somente quando quiser expor a API de forma consciente.
- Faça backup do PostgreSQL e do diretório de imagens.
- Monitore a fila de entrega e o pareamento do WhatsApp.
- Não reutilize senhas locais em VPS ou produção.
