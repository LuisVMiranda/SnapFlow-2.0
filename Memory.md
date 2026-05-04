# SnapFlow - Documento de Memória (Memory.md)
*Atualizado em: 30 de Abril de 2026*

Este documento serve como a base de conhecimento e memória do projeto SnapFlow. Contém o mapeamento de como o sistema funciona, suas integrações e as decisões arquiteturais tomadas para garantir a entrega rápida e profissional das fotografias.

## 🚀 Arquitetura Geral do Sistema
O SnapFlow é composto por um ecossistema Híbrido focado em Alta Velocidade de Campo (eventos, ensaios):
- **Frontend (PWA):** Construído em ReactJS (Vite). Desenhado "Mobile-First" para o celular do fotógrafo ou do cliente. O visual é predominantemente Dark Mode (`#121212`) focado no contraste das fotos.
- **Backend (Node.js):** Um servidor Express que roda localmente no notebook do fotógrafo. Ele funciona como o "Cérebro" de pagamentos, processamento de imagens e disparos via WhatsApp.
- **Conectividade:** Pode ser acessado localmente pelo Fotógrafo e exposto para o Cliente (via Tailscale/Ngrok) de forma segura através do recurso *Share Link*.

## 🔑 Principais Funcionalidades

### 1. Processamento de Imagens e Correção de Orientação (EXIF)
Toda imagem que o fotógrafo faz Upload (`/api/upload`) passa por um processamento em memória pela biblioteca `sharp` no Node.js ANTES de ser salva no HD.
- **Ações Atuais:** A única manipulação feita é a leitura da etiqueta EXIF para aplicar a **Rotação Automática** da imagem (resolvendo o problema de fotos verticais de smartphones que ficavam deitadas).
- **Decisão Arquitetural:** Os filtros automáticos (como Saturação e Contraste) foram removidos do pipeline para garantir maior fidelidade à captura original da câmera e mais velocidade de upload. As fotos e os thumbnails são salvos brutos, apenas na posição correta.

### 2. Dashboard e Finanças (db.json)
O banco de dados é um arquivo simples e portátil (`db.json`) mantido na raiz do Backend. Ele mapeia as métricas de venda do dia, da semana e do mês de acordo com as transações confirmadas (Pix aprovado).

### 3. Integração Transparente com Mercado Pago
Quando uma sessão é gerada (`/api/pix`), o backend utiliza o `MP_ACCESS_TOKEN` para criar uma transação com QR Code Dinâmico (Copia e Cola). 
- **Sem Webhooks complexos:** O próprio Frontend faz "Polling" a cada 3 segundos (`/api/status/:sessionId`) que verifica direto no Mercado Pago se o Pix foi compensado. Quando aprova, a tela do cliente "pula" instantaneamente para a tela de Conclusão.

### 4. Disparo Automático (whatsapp-web.js)
Quando o Pix cai (ou pagamento manual é dado), o Backend aciona o "Robô do WhatsApp" invisível.
- Ele confere a existência do número fornecido pelo cliente (`wapp.getNumberId`).
- Pega os URLs das fotos já editadas pelo `sharp` da pasta de uploads.
- Dispara as fotos **Como Documento** direto no WhatsApp do cliente para manter a qualidade original de impressão.

### 5. Layout Inteligente Invertido
A tela da Galeria (`gallery-grid`) foi desenhada com base em testes reais: a grade de fotografias sempre aparece **no topo** logo de cara, enquanto os detalhes burocráticos do pacote, carrinho e botão de pagamento ficam reclusos na base ou abaixo das fotos (`info-bottom-area`). O foco do cliente é sempre 100% nas emoções das fotos.

### 6. Ponto de Venda (POS) e Pagamento Físico
O PWA suporta vendas presenciais com segurança (Dinheiro/Máquina de Cartão). Quando o link é enviado para o celular do cliente, ele **só pode gerar Pix**. Se ele quiser pagar fisicamente, ele aciona o botão de "Solicitar Pagamento", que dispara um **Banner Global (Pop-up)** em tempo real (Polling a cada 5s) na tela do painel do fotógrafo. O fotógrafo então clica em "Liberar Fotos", confirmando o pagamento fisicamente e engatilhando o disparo do WhatsApp na hora.

### 7. Memória Persistente (Anti-Queda)
O PWA utiliza salvamento extremo em cache (`LocalStorage`). Isso previne acidentes em campo. Se o cliente estiver na metade de uma compra, e a tela do celular dele desligar, acabar a bateria ou ele atualizar a aba sem querer, ao abrir o link novamente ele voltará **exatamente para a mesma tela**, com as fotos marcadas e o código Pix ainda gerados. Nada é perdido.

## 📁 Estrutura Essencial de Arquivos
- `/src/App.jsx`: O arquivo gigantesco e principal que controla o React. Controla o Dashboard do Fotógrafo, o Visualizador Tela-Cheia e a Tela de Compartilhamento do Cliente.
- `/src/index.css`: Todo o Design System está aqui. Trabalha com CSS Vanilla e Variáveis de CSS (ex: `--blue`, `--green`). Traz efeitos poderosos como o `mix-blend-mode: screen` para a logo e classes de "Watermark".
- `/backend/server.js`: Roteador Express, integrações do WhatsApp, Mercado Pago e Multer (Motor `sharp`).
- `/backend/uploads/`: A pasta mágica onde as imagens caem antes de irem pro mundo.

## 📝 Próximos Passos (Backlog)
- Otimização contínua de performance ao carregar mais de 100 fotos na galeria (Paginação / Lazy Loading aprimorado).
- Possibilidade de configurar o Preset do `sharp` de forma dinâmica em uma página de Settings do PWA.
