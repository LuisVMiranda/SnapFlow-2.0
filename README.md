# SnapFlow 2.0

SnapFlow é um sistema operacional de vendas rápidas para fotógrafos presenciais: painel de venda, cobrança, galeria, processamento e entrega de fotos para eventos, turismo, escolas, parques, ações corporativas e atendimentos de alta rotatividade. Ele ajuda o fotógrafo a selecionar fotos, encantar o cliente, cobrar, liberar a compra e entregar os arquivos pela própria galeria, com WhatsApp opcional para aviso e redundância.

## Principais recursos

- Upload de fotos pelo painel, com miniaturas, pré-visualizações e armazenamento privado.
- Auto Enhance leve opcional com Sharp após a rotação EXIF, ativável por ambiente, para deixar as fotos mais vivas sem aparência artificial quando o fotógrafo quiser.
- Seleção de fotos por cliente, com contador, pacote ativo e cálculo automático de preço.
- Pacotes e preços editáveis no painel administrativo.
- Desconto manual aplicável em qualquer venda, mesmo fora do pacote de desconto.
- Dica flutuante e sutil mostrando quando faltam poucas fotos para alcançar um pacote/desconto.
- Campo de cliente editável para registrar quem vai acessar e pagar pelas fotos.
- Pagamento por Pix via Mercado Pago, com QR Code e código Pix copia e cola.
- Webhook do Mercado Pago para aprovar Pix quando o pagamento muda para aprovado.
- Notificação visível para o administrador quando o Pix é confirmado.
- Pagamento em dinheiro ou cartão sempre aguardando aprovação administrativa explícita.
- Tela focada de aprovação manual em nova aba, sem travar a venda em andamento.
- Downloads individuais e ZIP `Baixar tudo` com as mesmas versões finais preparadas para entrega.
- Prazo pós-pagamento de 7 dias por padrão, editável globalmente, por galeria e na validade atual.
- Notificação de pagamento confirmado pelo WhatsApp com link, código e validade.
- Fila opcional de originais pelo WhatsApp como documento, preservando qualidade.
- Estados e reenvios independentes para aviso e originais no WhatsApp.
- Pareamento do WhatsApp dentro do painel, com QR Code visível em Vendas/Galerias.
- Galerias compartilhadas com link temporário, código de acesso e expiração.
- Mensagem de compartilhamento do WhatsApp com texto de link mais confiável, usando rótulos como `Acessar galeria privada`.
- Carrinho persistente no backend para galerias compartilhadas, restaurando seleções quando o cliente volta ao link.
- Galerias grandes carregadas em lotes, evitando abrir centenas de fotos de uma vez.
- Recriação/revalidação intencional de galeria sem duplicar links desnecessários.
- Edição de galeria pelo admin: visualizar fotos, adicionar, remover, alterar telefone, cliente, código, pacote, total e tempo.
- Biblioteca de marcas d'água reutilizáveis, com aplicação por galeria e fallback Plan B SnapFlow.
- Biblioteca de overlays reutilizáveis, com ajuste por galeria de imagem, posição, escala, opacidade, orientação vertical/horizontal e estado ativo/inativo.
- Revogar, estender, copiar e abrir links compartilhados.
- Proteções no modo cliente para reduzir cópia indevida e acesso fora da galeria.
- Dashboard de vendas com períodos diário, semanal, mensal e anual.
- Funil de conversão diário no dashboard, registrando abertura de link, desbloqueio, carrinho salvo, Pix, pagamento manual, aprovação e entrega.
- Botão para limpar estatísticas de vendas com confirmação dupla, sem apagar galerias.
- Botão para cancelar liberação de pedidos manuais pendentes em testes ou desistências.
- Configurações de retenção e limpeza de arquivos.
- Credenciais editáveis pelo painel com um único salvamento global e confirmação de senha.
- Modelos de mensagens WhatsApp editáveis, incluindo `Pagamento confirmado`, com variáveis como `{name}`, `{linkText}`, `{code}`, `{expiresAt}` e `{accessDays}`.
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
5. Depois da aprovação, volta à galeria para baixar cada foto ou todas em um ZIP.
6. Continua vendo as fotos compradas, sem poder selecioná-las novamente, e pode comprar as restantes.

### Entrega

- Pix aprovado pelo Mercado Pago libera a sessão automaticamente quando o webhook chega ao backend.
- Dinheiro/cartão só libera depois da aprovação manual do administrador.
- Na primeira aprovação, a galeria permanece acessível por pelo menos 7 dias contados de `approvedAt`; compras posteriores podem ampliar esse prazo.
- Downloads são liberados antes de qualquer tentativa de WhatsApp e não dependem do pareamento desse canal.
- O WhatsApp tenta enviar um aviso leve. Os originais só entram na fila quando o fotógrafo ativa `Enviar também os originais pelo WhatsApp`.
- Falhas de aviso e de envio dos originais aparecem separadamente no painel e podem ser reenviadas sem desfazer a aprovação.

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
docker-compose --version
```

Se `docker compose` não existir, mas `docker-compose --version` funcionar, os scripts npm usam automaticamente o comando disponível. Se o comando responder que não consegue conectar ao Docker API, abra o Docker Desktop e aguarde o status indicar que o engine está pronto.

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

Esse script prepara dependências locais, recusa portas já ocupadas, inicia o PostgreSQL, roda migrações pendentes uma única vez, abre o backend e aguarda uma resposta identificada do SnapFlow em `/api/health`. O painel só é aberto depois disso, sempre na porta configurada; se o Vite não puder usar essa porta, o início falha com orientação em vez de mudar silenciosamente para outra. Ao final, o próprio HTML do painel também é validado.

Para verificar os scripts do banco e a sintaxe das sondas de inicialização sem iniciar serviços:

```powershell
.\INICIAR_BANCO.bat --verificar
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
ADMIN_LOCK_MINUTES=30
CREDENTIALS_SECRET=outro-segredo-longo-para-criptografar-credenciais
MP_ACCESS_TOKEN=APP_USR-seu-token-mercado-pago
MP_WEBHOOK_SECRET=seu-segredo-de-webhook
PUBLIC_BASE_URL=http://localhost:5173
HOST=127.0.0.1
PORT=3000
STORAGE_ROOT=./storage
AUTO_ENHANCE=false
AUTO_ENHANCE_LEVEL=balanced
UPLOAD_PROCESSING_CONCURRENCY=3
```

5. Crie ou edite o arquivo `.env` na raiz para o Docker Compose. Use a mesma senha configurada em `DATABASE_URL`:

```env
POSTGRES_DB=snapflow
POSTGRES_USER=snapflow
POSTGRES_PASSWORD=sua-senha-local
POSTGRES_PORT=55432
SNAPFLOW_API_PORT=3000
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

## Auto Enhance

O backend pode aplicar um tratamento leve e automático nas imagens durante o upload, mas esse recurso é opcional e vem desligado por padrão para não editar fotos sem intenção do fotógrafo:

```text
Upload -> Rotate EXIF -> Auto Enhance opcional -> Thumbnail -> Save
```

O objetivo é permitir uma melhoria leve quando o operador quiser, sem misturar isso com os presets escolhidos manualmente em cada galeria. O pipeline usa Sharp com análise leve de luminosidade, ajustes suaves de brilho/saturação, contraste linear, sharpen leve e JPEG otimizado. Fotos escuras entram automaticamente em um preset `low_light`, que levanta sombras com mais cuidado e evita contraste negativo demais.

Configuração em `backend\.env.local`:

```env
AUTO_ENHANCE=false
AUTO_ENHANCE_LEVEL=balanced
```

Níveis disponíveis:

- `soft`: ajuste mais discreto.
- `balanced`: opção recomendada para evento e venda rápida quando o Auto Enhance for ativado.
- `cinematic`: um pouco mais presente, ainda sem HDR artificial.

Para ativar o recurso, use `AUTO_ENHANCE=true` e reinicie o backend. Quando ativo, o backend registra logs como `[AUTO_ENHANCE] Processing image...`. Se a intenção for usar apenas presets manuais por galeria, mantenha `AUTO_ENHANCE=false`.

O processamento de lotes usa paralelismo controlado por `UPLOAD_PROCESSING_CONCURRENCY`. O padrão recomendado é `3`. Em máquinas mais fortes, teste `4`; em notebooks fracos ou com pouca memória, use `2` ou `1`.

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

Depois de 5 tentativas inválidas, o backend bloqueia temporariamente aquele endereço IP administrativo. O padrão é `ADMIN_LOCK_MINUTES=30`, e o valor pode ficar entre 30 e 60 minutos em `backend\.env.local`. A resposta da API informa o horário de liberação e o painel limpa tokens antigos salvos no navegador para evitar novos bloqueios automáticos.

Depois de entrar, o administrador pode:

- gerenciar galerias;
- acompanhar vendas;
- acompanhar o funil de conversão do dia;
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
- `{expiresAt}`: data e hora final do acesso pós-pagamento.
- `{accessDays}`: quantidade de dias configurada após a aprovação.
- `{count}`: quantidade de fotos.
- `{total}`: valor total.
- `{phone}`: telefone do cliente.
- `{sessionId}`: identificador interno da venda.

## Galerias compartilhadas

Cada galeria tem token/link, código, prazo curto de seleção e prazo de download após o pagamento. Recriar ou revalidar uma galeria deve reaproveitar o registro correto, evitando acúmulo de galerias duplicadas. Em `Configurações > Entrega da galeria`, o fotógrafo define o padrão global; em criação e edição, pode sobrescrever os dias e ativar o envio adicional dos originais pelo WhatsApp.

Galerias com muitas fotos são carregadas em páginas internas de até 40 imagens por vez. O cliente vê a primeira leva rapidamente e pode usar `Carregar mais fotos` conforme navega, sem forçar o navegador, o backend ou o link Tailscale/Funnel a transferirem a galeria inteira de uma só vez. O Tailscale/Funnel deve ser tratado como camada de acesso/rede, não como CDN; para centenas de fotos e vários clientes simultâneos, prefira uma VPS ou conexão estável.

Quando o cliente desbloqueia a galeria, o carrinho pode ser salvo no backend. Assim, se ele fechar o navegador, trocar de aparelho ou voltar ao link depois, as fotos selecionadas podem ser restauradas com mais segurança do que depender apenas do LocalStorage.

As mensagens de compartilhamento usam `{linkText}` para exibir um texto de link mais confiável no WhatsApp, por exemplo `Acessar galeria privada: https://...`. Isso reduz a sensação de link suspeito quando o cliente decide acessar a galeria mais tarde.

O dashboard registra eventos de conversão dessas galerias em `conversion_events`, permitindo acompanhar onde a venda presencial perde velocidade: link aberto, galeria desbloqueada, carrinho salvo, Pix gerado, pagamento manual solicitado, pagamento aprovado e entrega enviada.

Marca d'água por galeria: em `Configurações`, o administrador envia imagens de marca uma vez e reutiliza em galerias futuras. Em `Ver/Editar`, cada galeria pode receber uma marca própria com largura, altura, opacidade e repetição; sem imagem personalizada, as prévias usam automaticamente o Plan B SnapFlow. A personalização protege prévias e visualização pública, enquanto os originais pagos continuam limpos.

Overlay por galeria: em `Configurações`, o administrador envia overlays com identificador próprio em uma biblioteca separada das marcas d'água. Em `Ver/Editar`, cada galeria pode adicionar, modificar, ativar, desativar ou remover o overlay; o modal mostra prévias vertical e horizontal para ajustar posição, tamanho e opacidade antes de aplicar em todas as fotos. O overlay é camada visual de composição, não substitui a marca d'água; quando ambos existem, a ordem é edição da foto, overlay e depois marca d'água. As prévias/display são reprocessadas e os originais pagos entregues ao cliente recebem o overlay ativo.

No modo admin, `Ver/Editar` permite:

- ver prévias das fotos daquela galeria;
- adicionar fotos;
- remover fotos;
- alterar cliente;
- alterar WhatsApp;
- alterar pacote e total;
- alterar código de acesso;
- aplicar, pausar, modificar ou remover overlay visual;
- aplicar ou remover marca d'água personalizada;
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
- `A porta 3000/5173 já está em uso`: feche a janela antiga do servidor/painel ou o outro aplicativo indicado. O SnapFlow não troca de porta silenciosamente porque isso quebraria o proxy e o endereço publicado pelo Tailscale.
- `HTTP 502/503` logo após reiniciar: o painel tenta novamente sem notificar nas duas primeiras falhas transitórias. Se a indisponibilidade persistir, confira a janela do servidor; quando a API voltar, o cartão do WhatsApp se recupera automaticamente.
- `EBUSY ... .wwebjs_auth ... lockfile`: o Chromium ainda estava liberando o perfil do WhatsApp no Windows. O backend fecha o browser antigo, tenta a limpeza novamente e, se o perfil continuar bloqueado, isola-o e reconecta com um perfil novo sem derrubar a API. Aguarde o novo QR Code em `Vendas > WhatsApp de envio`; encerre processos antigos de Chrome/Node somente se o bloqueio reaparecer continuamente.
- Se a porta do backend for alterada em `backend\.env.local`, os BATs usam esse `PORT` como fonte de verdade e o repassam ao proxy Vite como `SNAPFLOW_API_PORT`.
- `connect ECONNREFUSED 127.0.0.1:55432`: o PostgreSQL não está rodando; abra o Docker Desktop e execute `.\INICIAR_BANCO.bat` ou `.\INICIAR_TUDO.bat`.
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
