# SnapFlow - Documento de Memoria (Memory.md)
*Atualizado em: 15 de Maio de 2026*

Este documento serve como base de conhecimento do projeto SnapFlow 2.0. Ele registra como o sistema funciona, quais decisoes arquiteturais estao ativas e qual direcao de produto deve guiar as proximas implementacoes.

## Visao de produto

O SnapFlow nao deve ser tratado apenas como uma galeria de fotos. A direcao do produto e evoluir para um sistema operacional de vendas rapidas para fotografos presenciais.

O foco principal e transformar vendas presenciais de fotografia em uma experiencia extremamente rapida, emocional, premium, automatizada e lucrativa para eventos, turismo, escolas, parques, ensaios, acoes corporativas e operacoes de alta rotatividade.

## Arquitetura geral

- **Frontend React PWA:** interface mobile-first para fotografo e cliente, com foco em velocidade operacional, galeria visual, carrinho, checkout e painel administrativo.
- **Backend Node.js + Express:** API local/remota para vendas, galerias, pagamentos, processamento de imagens, WhatsApp, credenciais, retencao, dashboard e seguranca.
- **PostgreSQL:** persistencia principal de fotos, sessoes, galerias, credenciais, carrinhos compartilhados, metricas e eventos de conversao.
- **Sharp:** pipeline de midia para rotacao EXIF, Auto Enhance opcional, thumbnails e compressao otimizada.
- **Mercado Pago Pix:** geracao de Pix e aprovacao via webhook.
- **WhatsApp Web:** entrega automatica das fotos como documento, preservando qualidade.
- **Fluxo hibrido online/local:** o sistema pode operar em ambiente local com Docker/PostgreSQL e ser exposto por URL publica segura quando necessario.

## Funcionalidades ativas

### 1. Upload, processamento e Auto Enhance opcional

O upload passa pelo backend e usa Sharp antes de salvar as imagens. O fluxo atual e:

```text
Upload -> Rotate EXIF -> Auto Enhance opcional -> Thumbnail -> Save
```

O Auto Enhance e controlado por ambiente e fica desligado por padrao para evitar edicao automatica antes de o fotografo escolher presets de galeria:

- `AUTO_ENHANCE=false`
- `AUTO_ENHANCE_LEVEL=soft|balanced|cinematic`
- `UPLOAD_PROCESSING_CONCURRENCY=3`

Quando ativado manualmente com `AUTO_ENHANCE=true`, o objetivo e deixar a foto mais viva e equilibrada sem aparencia artificial. O ajuste e leve, sem IA pesada, sem GPU e sem transformar o produto em um Lightroom. O Auto Enhance mede uma amostra pequena da luminosidade da imagem e troca para um preset `low_light` ou `dim_light` quando a foto esta escura, evitando que o contraste afunde ainda mais as sombras.

O processamento de uploads usa paralelismo controlado para acelerar lotes. O padrao atual processa ate 3 fotos em paralelo, mantendo a ordem de retorno para a galeria e evitando consumo exagerado de RAM.

### 2. Galerias compartilhadas

As galerias compartilhadas possuem token, codigo de acesso, expiracao, metadados, fotos paginadas e protecoes para reduzir acesso indevido. Galerias grandes carregam fotos em lotes para preservar velocidade em celular e links publicos.

O texto enviado pelo WhatsApp usa rotulo de link mais confiavel, como `Acessar galeria privada`, para diminuir a sensacao de link suspeito quando o cliente abre depois.

### 3. Carrinho persistente no backend

O carrinho do cliente em galerias compartilhadas pode ser salvo no backend por token de galeria. Quando o cliente volta ao link e desbloqueia a galeria, as fotos selecionadas sao restauradas com mais seguranca do que depender apenas do LocalStorage.

### 4. Pacotes, desconto e nudges de conversao

O sistema suporta pacotes editaveis, calculo automatico de preco, desconto manual em qualquer venda e dica flutuante sutil quando faltam poucas fotos para o cliente atingir pacote/desconto.

A direcao de UX e manter a galeria no centro da experiencia, com estimulos comerciais discretos, rapidos e sem poluir a emocao das fotos.

### 5. Pagamentos e aprovacao

O SnapFlow suporta:

- Pix via Mercado Pago;
- webhook para aprovacao automatica;
- pagamento presencial em dinheiro/cartao;
- aprovacao manual explicita pelo administrador;
- cancelamento de liberacao manual pendente;
- reenvio de entrega quando houver falha.

Pagamentos presenciais nao devem liberar fotos sem confirmacao do administrador.

### 6. Entrega automatica via WhatsApp

Depois da aprovacao, a fila de entrega envia as fotos pelo WhatsApp como documento, preservando qualidade para impressao. O painel permite acompanhar falhas e reenviar entregas.

### 7. Dashboard comercial e analytics

O dashboard exibe vendas por periodo e agora inclui funil de conversao diario. Os eventos registrados em `conversion_events` incluem:

- `share_opened`
- `share_unlocked`
- `cart_saved`
- `pix_generated`
- `manual_payment_requested`
- `payment_approved`
- `delivery_sent`

Esse funil ajuda a entender onde a venda presencial perde velocidade: abertura do link, desbloqueio, selecao, pagamento, aprovacao ou entrega.

## Estrutura essencial

- `src/components/`: componentes do painel, dashboard, cards e controles.
- `src/screens/`: telas principais da experiencia do fotografo e cliente.
- `src/hooks/`: estado, polling, persistencia e acoes do fluxo.
- `src/lib/`: regras de preco, compartilhamento, validacoes e utilitarios.
- `backend/src/routes/`: rotas Express de admin, share, webhook e arquivos.
- `backend/src/repos/`: acesso ao PostgreSQL, incluindo sessoes, galerias, carrinhos e eventos de conversao.
- `backend/src/services/`: midia, pagamento, WhatsApp, entrega, credenciais e retencao.
- `backend/migrations/`: evolucao do schema PostgreSQL.

## Decisoes arquiteturais recentes

- Desconto manual deve poder ser aplicado em qualquer venda, nao apenas quando o cliente ativa pacote de desconto.
- O link de WhatsApp deve parecer mais seguro e humano, usando texto de acesso a galeria privada.
- O carrinho compartilhado deve sobreviver alem do LocalStorage.
- Auto Enhance deve ser rapido, natural, seguro para pele/impressao e desligavel por ambiente.
- Analytics deve comecar simples, registrando eventos de funil antes de evoluir para inteligencia comercial mais profunda.

## Backlog recomendado

- Dashboard comercial inteligente com conversao por galeria/evento, ticket medio, fotos mais vendidas e perda por etapa.
- Recuperacao de carrinho via WhatsApp quando o cliente seleciona fotos e nao paga.
- Upsell automatico de pacotes com comparacao visual de economia.
- Favoritos do cliente e ranking de fotos mais desejadas.
- Virtualizacao extrema da galeria para centenas ou milhares de fotos.
- Thumbnails WebP e estrategia de cache/CDN para operacao com muitos clientes simultaneos.
- IA futura para selecao automatica, deteccao de olhos fechados, agrupamento por rosto e sugestao de melhores fotos.
