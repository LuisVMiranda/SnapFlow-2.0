# Manifesto do Projeto SnapFlow 2.0

Atualizado em: 2026-06-04

Este documento compila a visão de produto, arquitetura, tecnologias, fluxos, recursos, vantagens e pontos de operação do SnapFlow 2.0. Ele foi escrito para ser reutilizado depois em materiais comerciais, documentação técnica, propostas, onboarding, planejamento de produto e revisões de arquitetura.

## Resumo Executivo

SnapFlow 2.0 é um sistema operacional de vendas rápidas para fotógrafos presenciais. Ele une painel administrativo, upload de fotos, galerias compartilhadas, seleção do cliente, cobrança, pagamento, aprovação, processamento de imagem e entrega por WhatsApp em uma experiência única.

O produto existe para reduzir o tempo entre fotografar, vender e entregar. Em eventos, turismo, escolas, parques, ações corporativas e operações de alta rotatividade, cada minuto de fricção custa venda. SnapFlow organiza esse ciclo para que o fotógrafo consiga atender mais pessoas, vender com menos improviso e entregar arquivos de qualidade sem perder controle comercial.

Em termos práticos, o SnapFlow faz quatro coisas muito bem:

1. Transforma fotos recém-capturadas em galerias vendáveis.
2. Permite que o cliente escolha, pague e acompanhe sua compra com menos atrito.
3. Automatiza liberação e entrega das imagens quando o pagamento é aprovado.
4. Dá ao fotógrafo controle de marca, preços, descontos, links, aprovações, retenção e operação do WhatsApp.

## Posicionamento

SnapFlow não é apenas uma galeria de fotos. Também não é um editor fotográfico completo, um CRM genérico ou uma loja virtual tradicional. Ele é uma camada operacional focada no momento da venda presencial.

Seu valor está em conectar etapas que normalmente ficam espalhadas:

- selecionar fotos;
- mostrar prévias protegidas;
- calcular pacote e desconto;
- cobrar por Pix ou pagamento presencial;
- aprovar ou bloquear liberações;
- entregar originais pelo WhatsApp;
- registrar status e histórico;
- manter galerias temporárias controladas.

O sistema é construído para ambientes onde o fotógrafo precisa vender rápido sem parecer amador, entregar rápido sem abrir mão da qualidade, e controlar o acesso sem transformar o processo em algo pesado para o cliente.

## Público e Casos de Uso

O público principal são fotógrafos e operadores que vendem fotos em volume, muitas vezes no mesmo local onde as imagens foram capturadas.

Casos de uso naturais:

- turismo pedagógico;
- eventos escolares;
- formaturas;
- parques, experiências e atrações;
- eventos corporativos;
- ativações promocionais;
- fotos de famílias e grupos em locais de passagem;
- operações com vários clientes decidindo em paralelo;
- vendas em que o cliente precisa escolher poucas fotos de um lote maior;
- cenários em que Pix, dinheiro e cartão convivem no mesmo fluxo.

O produto também serve para operações pequenas que precisam de processo profissional sem montar uma infraestrutura pesada de e-commerce.

## Princípios do Produto

- Velocidade primeiro: o fluxo deve encurtar o caminho entre foto, escolha, pagamento e entrega.
- Mobile-first: clientes e operadores muitas vezes usam celular, links compartilhados ou redes como Tailscale/Funnel.
- Controle do fotógrafo: pagamento manual não libera fotos sem aprovação explícita.
- Proteção proporcional: prévias têm marca d'água, acesso temporário e barreiras contra cópia casual, sem prometer DRM impossível.
- Qualidade na entrega: arquivos pagos são enviados como documentos no WhatsApp para preservar qualidade.
- Automação com supervisão: Pix aprovado pode liberar entrega automaticamente; dinheiro/cartão exige decisão humana.
- Operação local viável: o sistema roda em Windows com scripts BAT, Node.js e PostgreSQL local via Docker ou PostgreSQL nativo.
- Evolução incremental: recursos como funil, presets, overlays e Stories entram como camadas integradas ao fluxo existente.
- Fallbacks claros: quando WhatsApp, Pix, backend ou banco falham, o painel tenta mostrar a causa e oferecer próximo passo acionável.

## Fluxos Principais

### Fluxo de Venda Direta pelo Fotógrafo

1. O fotógrafo abre o painel administrativo.
2. Faz upload das fotos da sessão.
3. O backend processa originais, previews e miniaturas.
4. O operador escolhe o pacote e seleciona as fotos junto com o cliente.
5. O resumo calcula quantidade, preço unitário, subtotal, desconto manual e total.
6. O operador informa nome, telefone, e-mail opcional e método de pagamento.
7. O pedido pode seguir por Pix Mercado Pago ou pagamento manual.
8. Quando aprovado, a sessão entra na fila de entrega.
9. A fila prepara os arquivos finais e envia pelo WhatsApp.

### Fluxo de Galeria Compartilhada

1. O fotógrafo seleciona fotos e cria uma galeria compartilhada.
2. A galeria recebe token, link, código de acesso, expiração, metadados, pacote, total e configurações visuais.
3. O link pode ser enviado por WhatsApp com mensagem configurável.
4. O cliente abre o link, informa o código e desbloqueia o acesso temporário.
5. A galeria carrega fotos em páginas internas para evitar travar celular ou rede.
6. O cliente seleciona fotos; o carrinho pode ser salvo no backend.
7. O cliente gera Pix ou solicita pagamento manual.
8. O Pix aprovado libera entrega automaticamente; pagamento manual aguarda aprovação do fotógrafo.
9. Os arquivos pagos são enviados pelo WhatsApp.

### Fluxo Pix

1. O frontend chama a rota de Pix com sessão, fotos, total, pacote, cliente e telefone.
2. O backend cria pagamento Pix no Mercado Pago.
3. A resposta inclui QR Code e código Pix cópia e cola.
4. O cliente paga no app bancário.
5. O Mercado Pago chama o webhook público.
6. O backend valida assinatura, busca status do pagamento e aprova a sessão quando o status é aprovado.
7. A entrega é enfileirada.
8. O dashboard mostra notificação e status.

### Fluxo Dinheiro/Cartão

1. O cliente ou fotógrafo registra pedido de pagamento manual.
2. A sessão fica pendente.
3. O painel mostra a pendência para o administrador.
4. O administrador pode liberar fotos ou cancelar a liberação.
5. Ao liberar, a sessão é aprovada e a entrega entra na fila.
6. Ao cancelar, aquele pedido não pode mais ser aprovado; uma nova solicitação deve ser criada se o cliente comprar depois.

### Fluxo de Entrega

1. A aprovação cria ou ativa um job na tabela de entregas.
2. A fila processa jobs pendentes periodicamente.
3. A fila valida se a sessão está aprovada.
4. As fotos selecionadas são carregadas pelo repositório.
5. O contexto visual da galeria é resolvido: overlay ativo, Stories habilitado e demais metadados.
6. O serviço de mídia prepara arquivos temporários quando necessário.
7. O WhatsApp envia mensagem de agradecimento e arquivos como documento.
8. A fila limpa temporários, marca job como enviado e registra evento de conversão.
9. Em falha, o erro fica visível e pode ser reenviado pelo painel.

## Recursos de Produto

### Upload e Processamento de Mídia

O backend aceita imagens JPG, PNG, WebP, HEIC e HEIF. O upload passa por validação de MIME, limite de tamanho e processamento via Sharp.

Pipeline geral:

```text
Upload -> armazenamento temporário -> rotação EXIF -> Auto Enhance opcional -> presets manuais opcionais por galeria -> original processado -> preview -> thumbnail -> metadados no PostgreSQL
```

O armazenamento fica em `STORAGE_ROOT`, com pastas como:

- `originals`;
- `sources`;
- `thumbs`;
- `previews`;
- `tmp`;
- `undo`;
- `archive`;
- `overlay-assets`;
- `watermark-assets`.

O banco guarda metadados; os arquivos de imagem ficam no sistema de arquivos.

### Auto Enhance Opcional

Auto Enhance é desligado por padrão. Quando ativado por `AUTO_ENHANCE=true`, o backend usa Sharp para ajustes leves de luminosidade, saturação, contraste e nitidez.

Níveis disponíveis:

- `soft`;
- `balanced`;
- `cinematic`.

O recurso tenta melhorar imagens sem substituir o olhar do fotógrafo e sem transformar o SnapFlow em editor pesado. Ele também respeita `UPLOAD_PROCESSING_CONCURRENCY` para não saturar máquinas locais.

### Presets de Edição de Fotos

O administrador pode criar presets de edição e aplicar até três ajustes por galeria. O sistema preserva informações para reprocessamento e undo, permitindo aplicar ou desfazer stacks de presets sem perder a origem.

Presets são especialmente úteis para padronizar lotes de eventos, escolas ou turismo sem editar foto por foto.

### Galerias Compartilhadas

Uma galeria compartilhada é o objeto central do SnapFlow. Ela agrupa fotos, link, código de acesso, expiração, pacote, total, telefone, cliente, carrinho, presets, watermark, overlay e Stories.

Controles disponíveis:

- criar link;
- copiar e abrir link;
- revogar link;
- estender tempo;
- recriar/revalidar galeria;
- editar nome, descrição, cliente, telefone, pacote, total, desconto e código;
- adicionar e remover fotos;
- carregar fotos em lotes;
- aplicar ou desfazer presets;
- aplicar, desativar ou remover watermark;
- aplicar, desativar ou remover overlay;
- ativar ou desativar entrega Stories.

Galerias são temporárias por desenho. Expiração, revogação e retenção ajudam a limitar exposição e reduzir lixo operacional.

### Seleção e Carrinho

O cliente ou operador seleciona fotos com contador, total em tempo real e destaque de pacote ativo. Em galerias compartilhadas, o carrinho pode ser salvo no backend para recuperar seleções quando o cliente volta ao link.

O sistema também mostra nudges comerciais quando faltam poucas fotos para ativar um pacote ou desconto.

### Preços, Pacotes e Desconto Manual

Pacotes ficam em configurações e podem ser editados pelo painel. O cálculo de preço usa quantidade selecionada, tipo de pacote, preço unitário normal, preço promocional por volume e descontos manuais.

O desconto manual pode ser aplicado em qualquer venda administrativa. O sistema valida limites para evitar desconto maior que o subtotal e pede confirmação quando o desconto deixa o pedido gratuito.

### Pix Mercado Pago

SnapFlow integra com Mercado Pago para criar pagamentos Pix. Ele suporta:

- QR Code;
- Pix cópia e cola;
- e-mail opcional do pagador;
- webhook assinado;
- gravação de eventos de pagamento;
- aprovação automática da sessão;
- enfileiramento automático de entrega.

Credenciais podem vir do ambiente ou do painel de credenciais.

### Pagamento Manual

Pagamento manual cobre dinheiro e cartão presenciais. A regra de produto é deliberada: pagamento manual não libera fotos sem aprovação administrativa.

O painel também permite cancelar liberações pendentes, o que evita pedidos travados quando o cliente desiste, testa o fluxo ou fecha a galeria sem pagar.

### WhatsApp

O envio usa `whatsapp-web.js` no backend com sessão local do WhatsApp Web. O painel mostra status e QR Code.

Operações disponíveis:

- consultar status;
- reconectar;
- parear novamente;
- resetar autenticação local;
- enviar texto;
- enviar fotos como documentos;
- tentar reconectar após falhas transientes.

As mensagens são configuráveis e aceitam variáveis como `{name}`, `{link}`, `{linkText}`, `{code}`, `{expiresMinutes}`, `{count}`, `{total}`, `{phone}` e `{sessionId}`.

### Fila de Entrega

A fila de entrega isola aprovação de pagamento do envio real. Isso evita que uma falha do WhatsApp quebre a venda inteira.

Responsabilidades da fila:

- reclamar job pendente;
- validar sessão aprovada;
- buscar fotos selecionadas;
- resolver contexto da galeria;
- preparar arquivos finais;
- enviar pelo WhatsApp;
- limpar temporários;
- marcar sucesso ou falha;
- permitir retry.

### Marcas d'Água

Watermark protege e personaliza previews. Existem dois níveis:

- configuração global de watermark;
- biblioteca de imagens reutilizáveis aplicáveis por galeria.

Quando a galeria não tem imagem personalizada, o sistema usa o Plan B watermark da SnapFlow. Watermark atua em previews e visualização pública; os originais pagos não recebem watermark de preview.

### Overlays

Overlay é uma camada visual de imagem aplicada sobre previews e, quando ativo, também sobre arquivos pagos entregues. Ele é separado da watermark.

O administrador pode:

- enviar overlays para biblioteca;
- nomear e renomear assets;
- aplicar overlay por galeria;
- ajustar posição, escala e opacidade;
- configurar perfis por orientação vertical e horizontal;
- ativar ou desativar sem apagar configuração;
- remover da galeria.

Quando overlay e watermark coexistem, a ordem de preview é: edição da foto, overlay e watermark.

### Entrega Stories 9:16

O modo Stories gera uma cópia adicional 9:16 da foto paga, pensada para Instagram Stories. Quando ativo, a entrega inclui o original pago normal e a variante Stories.

Comportamento da variante Stories:

- saída aproximada de 1080 x 1920;
- foto principal em `contain`, sem cortar o assunto;
- fundo da própria foto em `cover`, desfocado e escurecido;
- overlay de Stories opcional se o asset tiver perfil 9:16 configurado;
- funcionamento independente do overlay da galeria.

Isso significa que Stories pode estar ativo mesmo quando o overlay da galeria está desativado ou ausente. Se houver overlay com perfil Stories, ele entra na variante. Se não houver, a variante Stories sai sem overlay.

### Proteções de Galeria

As proteções reduzem cópia casual e acesso indevido:

- código de acesso de 4 caracteres;
- links temporários;
- revogação;
- tokens curtos de acesso a mídia;
- previews e thumbs em vez de originais;
- watermark em visualização;
- bloqueio de menu de contexto e arraste em modo cliente;
- restrições de teclado como barreiras de conveniência;
- headers e mensagens de erro controladas.

Essas proteções não são DRM absoluto. Elas dificultam uso indevido comum, mas não impedem screenshot, foto da tela ou usuário altamente técnico.

### Dashboard e Analytics

O painel acompanha vendas, sessões recentes, galerias compartilhadas, status de pagamento, status de entrega e estatísticas por período.

Períodos:

- hoje;
- semana;
- mês;
- ano.

O funil de conversão registra eventos como:

- `share_opened`;
- `share_unlocked`;
- `cart_saved`;
- `pix_generated`;
- `manual_payment_requested`;
- `payment_approved`;
- `delivery_sent`.

Esse funil ajuda a entender onde a venda perde velocidade.

### Credenciais e Configurações

O painel permite gerenciar:

- token Mercado Pago;
- segredo do webhook Mercado Pago;
- URL pública;
- nome do fotógrafo;
- nome do estúdio/marca;
- telefone comercial;
- contato comercial;
- dados Pix;
- pacotes;
- retenção;
- watermark;
- overlays;
- presets;
- Stories;
- modelos de mensagens WhatsApp.

Credenciais sensíveis são criptografadas usando `CREDENTIALS_SECRET`. O painel mostra valores mascarados.

### Retenção e Limpeza

O sistema tem configurações para:

- retenção padrão de galerias;
- retenção de fotos entregues;
- retenção de links expirados;
- arquivar antes de deletar;
- limpeza automática;
- preview e execução manual de cleanup.

Isso é importante porque fotos reais são pesadas, sensíveis e não devem ficar no projeto para sempre.

## Arquitetura

### Visão em Camadas

```text
React/Vite frontend
  -> Express API
    -> Services de domínio
      -> Repositórios PostgreSQL
      -> Sharp/file storage
      -> Mercado Pago
      -> WhatsApp Web
```

O frontend concentra experiência e estado de tela. O backend concentra regras de segurança, persistência, pagamentos, processamento de imagem e entrega.

### Frontend

Tecnologias principais:

- React 19;
- Vite;
- lucide-react;
- qrcode;
- Vitest;
- Testing Library;
- fast-check para testes de propriedade.

Estrutura:

- `src/screens`: telas principais como dashboard, galeria, resumo, Pix, aprovação, link compartilhado e confirmação.
- `src/components`: painéis, cards, modais, controles e visualizações.
- `src/hooks`: estado, polling, ações, credenciais, settings, persistência e proteções.
- `src/lib`: regras puras de preço, telefone, email, descontos, galerias, navegação, API e formatação.

Telas principais:

- Dashboard administrativo;
- Galeria de seleção;
- Resumo/cobrança;
- Tela Pix;
- Tela de pendência manual;
- Tela de aprovação administrativa;
- Tela de link compartilhado com código;
- Tela confirmada.

### Backend

Tecnologias principais:

- Node.js CommonJS;
- Express 5;
- PostgreSQL via `pg`;
- Sharp;
- Mercado Pago SDK;
- whatsapp-web.js;
- Multer;
- dotenv;
- node:test;
- supertest.

Entrada:

- `backend/server.js`.

Rotas:

- `healthRoutes`: saúde da API.
- `adminRoutes`: upload, dashboard, Pix admin, pagamento manual admin, aprovação, galerias, settings.
- `adminOpsRoutes`: WhatsApp, limpeza, retry de entrega, cancelamento manual, estatísticas.
- `shareRoutes`: acesso público a galeria, unlock, fotos paginadas, carrinho, Pix e pagamento manual do cliente.
- `paymentRoutes`: status de pagamento, sessão admin e webhook Mercado Pago.
- `mediaRoutes`: previews, thumbs, assets e original admin.
- `overlayAssetRoutes`: biblioteca e aplicação de overlays.
- `watermarkAssetRoutes`: biblioteca e aplicação de watermarks.
- `photoPresetRoutes`: presets e aplicação por galeria.
- `storyDeliveryRoutes`: configuração global de Stories.
- `credentialRoutes`: credenciais editáveis.
- `packageRoutes`: pacotes públicos.

Serviços:

- `mediaService`: upload, armazenamento, previews, thumbnails, presets, watermarks, overlays, cleanup.
- `mediaDeliveryService`: preparação de arquivos finais, overlays de entrega e variantes Stories.
- `paymentService`: Pix Mercado Pago e webhook.
- `deliveryQueue`: fila de entrega e retry.
- `whatsappClient`: pareamento e envio via WhatsApp Web.
- `galleryOverlayService`: overlay por galeria.
- `galleryWatermarkService`: watermark por galeria.
- `photoEditingPresetService`: presets de edição.
- `credentialsService`: segredos editáveis e mascarados.
- `retentionService`: limpeza e retenção.
- `whatsappTemplatesService`: mensagens configuráveis.
- `storyDeliverySettingsService`: defaults de Stories.

### PostgreSQL

O PostgreSQL é a fonte de verdade para metadados. O schema evolui por migrações em `backend/migrations`.

Entidades importantes:

- `sessions`: vendas, pagamentos, status e entrega;
- `photos`: metadados e caminhos de mídia;
- `share_sessions`: galerias compartilhadas;
- `delivery_jobs`: fila de envio;
- `payment_events`: eventos do provedor;
- `app_settings`: configurações;
- `cleanup_runs`: histórico de limpeza;
- `share_carts`: seleções persistidas do cliente;
- `conversion_events`: funil;
- `watermark_assets`: biblioteca de marcas;
- `overlay_assets`: biblioteca de overlays;
- campos de presets, undo, watermark, overlay e Stories.

### Armazenamento

Fotos não ficam no Git nem no banco como blobs. Elas ficam em `STORAGE_ROOT`, com caminhos relativos gravados no PostgreSQL. Isso simplifica backup, limpeza e separação entre metadados e arquivos pesados.

### Segurança

Principais mecanismos:

- `ADMIN_ACCESS_TOKEN` para rotas administrativas;
- comparação segura de token;
- bloqueio temporário por IP após cinco tentativas inválidas;
- `CREDENTIALS_SECRET` para criptografar credenciais;
- webhook Mercado Pago com verificação HMAC;
- tokens de acesso de cliente para mídia;
- expiração e revogação de galerias;
- armazenamento privado;
- `.gitignore` para secrets, storage, auth do WhatsApp e dumps;
- API com erros JSON controlados, inclusive fallback para rotas inexistentes.

## Tecnologias e Dependências

Frontend:

- React;
- React DOM;
- Vite;
- lucide-react;
- qrcode.

Backend:

- Node.js;
- Express;
- PostgreSQL;
- Sharp;
- Mercado Pago SDK;
- whatsapp-web.js;
- Multer;
- dotenv;
- CORS.

Qualidade:

- ESLint;
- Vitest;
- Testing Library;
- node:test;
- supertest;
- fast-check.

Operação local:

- Windows BAT;
- Docker Compose com PostgreSQL 16 Alpine;
- opção de PostgreSQL nativo;
- npm scripts;
- Vite proxy para `/api`.

## Workflows de Desenvolvimento e Operação

### Instalação Recomendada

`INSTALAR_SNAPFLOW.bat` verifica ambiente, instala dependências, cria arquivos locais, sobe PostgreSQL, roda migrações e pode iniciar backend e painel.

### Instalação sem Docker

`INSTALAR_SNAPFLOW_SEM_DOCKER.bat` prepara PostgreSQL nativo no Windows quando Docker Desktop não é desejado.

### Início Diário

`INICIAR_TUDO.bat`:

1. prepara dependências locais;
2. carrega configurações de host do `.env`;
3. inicia ou valida PostgreSQL;
4. roda migrações;
5. abre backend;
6. abre painel Vite.

Scripts separados:

- `INICIAR_BANCO.bat`;
- `INICIAR_SERVIDOR.bat`;
- `INICIAR_PAINEL.bat`;
- `PREPARAR_DEPENDENCIAS_LOCAIS.bat`.

### Comandos de Validação

```powershell
cmd /c npm.cmd test -- --run
cmd /c node --test backend\test\*.test.js
cmd /c npm.cmd run lint
cmd /c npm.cmd run build
cmd /c npm.cmd run db:migrate
```

## Diferenciais

- Integra venda, cobrança e entrega em um fluxo único.
- Serve operações presenciais, não apenas e-commerce frio.
- Mantém controle humano para dinheiro/cartão.
- Automatiza Pix com webhook.
- Entrega pelo canal que o cliente já usa: WhatsApp.
- Preserva qualidade enviando como documento.
- Usa galerias temporárias com código e expiração.
- Salva carrinho no backend para retorno do cliente.
- Permite marca visual por galeria sem misturar watermark e overlay.
- Gera variantes Stories 9:16 com fundo desfocado.
- Tem scripts Windows pensados para usuário operacional.
- Usa PostgreSQL para durabilidade e crescimento além de JSON local.
- Possui testes unitários, integração, UI e propriedade.

## Limitações e Cuidados

- WhatsApp Web depende de pareamento, Chromium e estabilidade da sessão local.
- Pix automático exige webhook público HTTPS corretamente configurado.
- Proteções contra cópia reduzem abuso casual, mas não impedem screenshot ou foto da tela.
- Storage local exige backup e estratégia de retenção.
- Expor o painel em rede pública exige token forte, firewall e `PUBLIC_BASE_URL` correta.
- O sistema não substitui edição fotográfica profissional profunda.
- Em operações com muitos clientes simultâneos, Tailscale/Funnel deve ser visto como acesso/rede, não CDN.

## Roadmap Natural

Possíveis evoluções coerentes com a arquitetura:

- recuperação automática de carrinho abandonado por WhatsApp;
- analytics por galeria, evento, origem e operador;
- ticket médio e conversão por etapa;
- ranking de fotos mais desejadas;
- upsell de pacotes com comparação visual;
- cache/CDN para operações maiores;
- thumbnails WebP;
- virtualização extrema para milhares de fotos;
- relatórios por evento;
- múltiplos operadores e permissões;
- IA futura para melhores fotos, olhos fechados, agrupamento por rosto e sugestões comerciais.

## Glossário Essencial

- Shared gallery: galeria administrável com link, código, fotos e configurações.
- Delivery session: venda/tentativa de entrega vinculada a fotos e pagamento.
- Paid original: arquivo entregue após pagamento aprovado.
- Watermark asset: imagem de marca reutilizável para previews.
- Gallery watermark: watermark efetivo de uma galeria.
- Plan B watermark: watermark padrão da SnapFlow.
- Overlay asset: imagem reutilizável para camada visual.
- Gallery overlay: overlay efetivo de uma galeria, com estado e posicionamento.
- Overlay orientation profile: perfil de overlay para foto vertical ou horizontal.
- Story overlay profile: perfil opcional para overlay em quadro 9:16.
- Story delivery variant: cópia 9:16 entregue junto com o original pago.
- Share cart: carrinho salvo no backend para galeria compartilhada.
- Delivery job: item da fila de entrega.

## Essência

SnapFlow 2.0 é uma ferramenta para vender fotografia enquanto a emoção da foto ainda está viva. Ele troca improviso por fluxo, espera por automação, e entrega manual por operação rastreável. Seu papel é deixar o fotógrafo mais rápido, mais organizado e mais profissional sem afastar o cliente do momento da compra.




