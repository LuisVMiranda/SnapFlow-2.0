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
- Galerias grandes carregadas em lotes, evitando abrir centenas de fotos de uma vez.
- Recriação/revalidação intencional de galeria sem duplicar links desnecessários.
- Edição de galeria pelo admin: visualizar fotos, adicionar, remover, alterar telefone, cliente, código, pacote, total e tempo.
- Revogar, estender, copiar e abrir links compartilhados.
- Proteções no modo cliente para reduzir cópia indevida e acesso fora da galeria.
- Dashboard de vendas com períodos diário, semanal, mensal e anual.
- Botão para limpar estatísticas de vendas com confirmação dupla, sem apagar galerias.
- Botão para cancelar liberação de pedidos manuais pendentes em testes ou desistências.
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

- Windows com PowerShell ou Windows Terminal.
- Git para baixar o projeto do repositório.
- Node.js `20.19+`, `22.13+` ou `24+` com npm. Node 18 não é suficiente para as ferramentas atuais de frontend.
- Docker Desktop aberto e com o motor Linux rodando para o método recomendado com PostgreSQL via `docker compose`.
- PostgreSQL nativo no Windows apenas se você optar pelo instalador alternativo sem Docker.
- Internet na instalação inicial para baixar pacotes npm, a imagem `postgres:16-alpine` no método Docker, PostgreSQL nativo no método sem Docker e o Chromium usado pelo WhatsApp Web.
- Um token administrativo forte para proteger o painel.
- Conta Mercado Pago com token de acesso, se for usar Pix real.
- WhatsApp no celular para parear o cliente WhatsApp Web usado pelo backend.

Verifique os programas antes de instalar:

```powershell
git --version
node --version
cmd /c npm.cmd --version
docker --version
docker compose version
```

Se `docker compose` responder que não consegue conectar ao Docker API, abra o Docker Desktop e aguarde o status indicar que o engine está pronto.

## Configuração inicial

### Opção recomendada: instalador guiado com Docker

Depois de baixar o projeto, rode:

```powershell
.\INSTALAR_SNAPFLOW.bat
```

O instalador verifica Git, Node.js, npm, Docker e Docker Compose; instala dependências ausentes via `winget` quando possível; cria `.env` e `backend\.env.local`; instala pacotes npm da raiz e do backend; sobe o PostgreSQL; roda migrações; e pode iniciar o backend e o painel.

Todos os prompts mostram o padrão entre parênteses. Os segredos locais ficam em arquivos ignorados pelo Git.

Para verificar o ambiente sem instalar ou alterar arquivos:

```powershell
.\INSTALAR_SNAPFLOW.bat --verificar
```

Esse modo também confere se as dependências locais já existem em `node_modules`, incluindo `vite` no painel e `dotenv`, `express`, `whatsapp-web.js` e `sharp` no backend.

`vite` não precisa ser instalado globalmente na máquina. Ele é uma dependência local do projeto e é instalado por `cmd /c npm.cmd install` na raiz.

### Opção alternativa: instalador sem Docker

Use esta opção quando Docker Desktop não funcionar bem nesse computador. Ela instala/configura PostgreSQL nativo como serviço do Windows e mantém o restante do SnapFlow igual.

Rode o terminal como administrador se PostgreSQL ainda não estiver instalado, depois execute:

```powershell
.\INSTALAR_SNAPFLOW_SEM_DOCKER.bat
```

O instalador sem Docker verifica Git, Node.js, npm e PostgreSQL nativo; instala PostgreSQL 16 via `winget` quando necessário; cria o usuário e banco `snapflow`; escreve `backend\.env.local` com `DATABASE_URL` apontando para `127.0.0.1:5432`; instala dependências npm; roda migrações; e pode iniciar backend e painel.

O pacote usado segue a documentação da EDB para instalação de PostgreSQL no Windows via WinGet: <https://www.enterprisedb.com/docs/dev-guides/deploy/windows/>.

Para verificar o ambiente sem alterar arquivos:

```powershell
.\INSTALAR_SNAPFLOW_SEM_DOCKER.bat --verificar
```

Depois de configurado, o início continua igual:

```powershell
.\INICIAR_TUDO.bat
```

### Opção manual

1. Baixe o projeto e entre na pasta:

```powershell
git clone https://github.com/LuisVMiranda/SnapFlow-2.0.git
cd SnapFlow-2.0
```

2. Instale as dependências:

```powershell
cmd /c npm.cmd install
cmd /c npm.cmd --prefix backend install
```

3. Crie o arquivo local de ambiente do backend:

```powershell
copy backend\.env.example backend\.env.local
```

4. Edite `backend\.env.local` com valores reais ou locais:

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

5. Crie ou edite o arquivo `.env` na raiz para o Docker Compose. Use a mesma senha configurada em `DATABASE_URL`:

```env
POSTGRES_DB=snapflow
POSTGRES_USER=snapflow
POSTGRES_PASSWORD=sua-senha-local
POSTGRES_PORT=55432
SNAPFLOW_DEV_HOST=127.0.0.1
SNAPFLOW_DEV_PORT=5173
SNAPFLOW_ALLOWED_HOSTS=
```

Para testar o sistema sem Pix real, mantenha valores de exemplo em `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`; Pix real só funciona depois de configurar Mercado Pago e webhook público. Pagamento manual, edição de galerias, upload e administração continuam úteis localmente.

6. Suba o PostgreSQL:

```powershell
cmd /c npm.cmd run db:up
```

7. Rode as migrações:

```powershell
cmd /c npm.cmd run db:migrate
```

8. Inicie backend e painel:

```powershell
.\INICIAR_TUDO.bat
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
cmd /c npm.cmd run start
```

Terminal 2, frontend:

```powershell
cmd /c npm.cmd run dev -- --host 127.0.0.1 --port 5173
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
cmd /c npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

Use essa opção somente com `ADMIN_ACCESS_TOKEN` forte, firewall configurado e `PUBLIC_BASE_URL` apontando para a URL confiável.

## Primeiro acesso

1. Abra `http://localhost:5173`.
2. Clique em `Conta`.
3. Digite o mesmo valor configurado em `ADMIN_ACCESS_TOKEN`.
4. Vá em `Vendas` ou `Galerias` para acompanhar sessões, WhatsApp, pagamentos e galerias compartilhadas.

O backend só carrega `.env` e `.env.local` dentro da pasta `backend`. O arquivo `backend\.env.local` é local, ignorado pelo Git e não deve ser enviado para o repositório.

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

Em desenvolvimento local, `http://localhost:3000/api/webhook` não é acessível pelo Mercado Pago pela internet. Para Pix real, use HTTPS público com domínio, proxy reverso, ngrok, túnel seguro ou infraestrutura equivalente, configure `PUBLIC_BASE_URL` com essa URL pública e mantenha `MP_WEBHOOK_SECRET` forte.

## WhatsApp

O envio usa `whatsapp-web.js` no backend.

Na primeira instalação, o pacote do backend também instala o Chromium usado pelo WhatsApp Web. Esse download pode demorar e pode ser bloqueado por antivírus, proxy corporativo ou firewall. Depois de parear, a sessão fica em diretórios locais ignorados pelo Git.

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

Galerias com muitas fotos são carregadas em páginas internas de até 40 imagens por vez. O cliente vê a primeira leva rapidamente e pode usar `Carregar mais fotos` conforme navega, sem forçar o navegador, o backend ou o link Tailscale/Funnel a transferirem a galeria inteira de uma só vez. O Tailscale/Funnel deve ser tratado como camada de acesso/rede, não como CDN; para centenas de fotos e vários clientes simultâneos, prefira uma VPS ou conexão estável.

No modo admin, `Ver/Editar` permite:

- ver prévias das fotos daquela galeria;
- adicionar fotos;
- remover fotos;
- alterar cliente;
- alterar WhatsApp;
- alterar pacote e total;
- alterar código de acesso;
- reabrir a galeria por mais minutos.

Em `Vendas`, pedidos pendentes em dinheiro/cartão mostram `Liberar fotos` e `Cancelar liberação`. Use `Cancelar liberação` quando o cliente desistir, quando a solicitação for só um teste ou quando o pagamento não for concluído. A sessão fica registrada como cancelada e não pode mais ser aprovada por aquele pedido; se o cliente quiser comprar depois, gere uma nova solicitação.

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

## Solução de problemas inicial

- `'vite' não é reconhecido`: as dependências do painel não foram instaladas. Rode `.\INSTALAR_SNAPFLOW.bat` ou `cmd /c npm.cmd install` na raiz.
- `Cannot find module 'dotenv'`: as dependências do backend não foram instaladas. Rode `.\INSTALAR_SNAPFLOW.bat` ou `cmd /c npm.cmd --prefix backend install`.
- Se `INICIAR_TUDO.bat`, `INICIAR_PAINEL.bat` ou `INICIAR_SERVIDOR.bat` detectarem dependências ausentes, eles oferecem instalar os pacotes locais antes de continuar.
- `connect ECONNREFUSED 127.0.0.1:55432`: o PostgreSQL não está rodando; abra o Docker Desktop e execute `cmd /c npm.cmd run db:up`.
- `Docker Desktop foi encontrado, mas o engine não respondeu`: abra o Docker Desktop e aguarde o status indicar que está pronto. Na primeira abertura após instalação ou atualização isso pode levar alguns minutos.
- `container name "/snapflow-postgres" is already in use`: existe um container antigo com o mesmo nome; pare/remova esse container pelo Docker Desktop antes de subir novamente.
- `psql não encontrado` no instalador sem Docker: instale PostgreSQL pelo `INSTALAR_SNAPFLOW_SEM_DOCKER.bat` como administrador ou adicione `C:\Program Files\PostgreSQL\16\bin` ao `PATH`.
- `A senha padrão do usuário postgres não funcionou`: digite a senha definida na instalação do PostgreSQL. Se não souber, redefina pelo pgAdmin ou reinstale PostgreSQL conscientemente.
- `Serviço PostgreSQL detectado, mas parado`: rode `INSTALAR_SNAPFLOW_SEM_DOCKER.bat` como administrador para permitir iniciar o serviço.
- `A porta 5432 já está ocupada`: informe outra porta no instalador sem Docker ou pare o serviço que está usando a porta. O instalador não altera portas de serviços existentes automaticamente.
- `DATABASE_URL ausente`: confirme se `backend\.env.local` existe e se o comando está sendo rodado a partir da pasta correta.
- `ADMIN_ACCESS_TOKEN ausente`: defina um token longo em `backend\.env.local` e reinicie o backend.
- WhatsApp não mostra QR Code: aguarde o backend terminar de iniciar, clique em `Atualizar` no cartão `WhatsApp de envio` e, se necessário, use `Parear novamente`.
- Pix não aprova sozinho em localhost: configure um webhook HTTPS público no Mercado Pago ou use o fluxo manual enquanto estiver testando localmente.

## Observações de produção

- Use HTTPS para `PUBLIC_BASE_URL` em produção.
- Configure o webhook do Mercado Pago apontando para a URL pública real.
- Use segredos únicos e longos.
- Mantenha `HOST=127.0.0.1` para uso local; use `HOST=0.0.0.0` somente quando quiser expor a API de forma consciente.
- Faça backup do PostgreSQL e do diretório de imagens.
- Monitore a fila de entrega e o pareamento do WhatsApp.
- Não reutilize senhas locais em VPS ou produção.
