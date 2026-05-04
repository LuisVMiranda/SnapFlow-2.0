# SnapFlow

SnapFlow e um painel de vendas e entrega de fotos em tempo real para uso em eventos, turismo e atendimento presencial.

## O que o app faz

- seleciona fotos por cliente
- calcula valores por pacote
- gera QR Code do Pix
- registra pagamento manual em dinheiro ou cartão
- envia fotos no WhatsApp após confirmação
- cria link temporário compartilhado para o cliente ver apenas a galeria dele
- envia automaticamente o link para o WhatsApp do cliente
- permite liberar, estender ou revogar o acesso do link
- mostra contagem regressiva e histórico dos links compartilhados
- copia mensagem pronta para WhatsApp com link e código
- oferece ações rápidas no histórico para copiar e revogar
- exibe dashboard com vendas e sessões recentes

## Fluxos principais

- `Fotografo`
  - envia ou seleciona as fotos
  - define o pacote ativo
  - gera link temporário ou cobra via Pix
  - confirma pagamento manual quando necessário

- `Cliente`
  - recebe o link compartilhado
  - acessa com um código curto de 4 caracteres
  - escolhe as fotos
  - segue para o pagamento

- `Entrega`
  - Pix aprovado pelo Mercado Pago libera automatico
  - pagamento em dinheiro/cartão depende da confirmação no painel
  - depois disso as fotos seguem para o WhatsApp como documento

## Execução local

Use o arquivo `INICIAR_TUDO.bat` para subir servidor e painel ao mesmo tempo.

Ou inicie manualmente:

```powershell
cd backend
node server.js
```

Em outro terminal:

```powershell
npm.cmd run dev -- --host 0.0.0.0 --port 5173
```

## Acesso em dispositivos

O app foi preparado para funcionar via Tailscale.

- frontend: `https://desktop-15212c0.tail40752d.ts.net`
- a API e os uploads passam pelo mesmo dominio no modo de teste

## Estrutura

- `src/App.jsx` - interface principal e fluxos de venda
- `src/index.css` - estilos da interface
- `backend/server.js` - API, uploads, Mercado Pago, WhatsApp e link compartilhado
- `public/logo-transparent.png` - logo do app

## Observacoes

- o fluxo compartilhado usa expiração configurável
- o link compartilha apenas a galeria daquela sessão
- o código curto aumenta a segurança sem complicar a venda
- o envio via WhatsApp depende do WhatsApp Web pareado e do numero do cliente

## Status atual

O projeto segue em evolução, com foco em:

- atendimento em tablet e celular
- venda presencial rápida
- confirmação manual de pagamentos alternativos ao Pix
- acesso compartilhado temporário para o cliente
