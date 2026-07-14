# CONTEXT

## Glossary

- Watermark asset: imagem de marca reutilizável que o administrador envia para identificar prévias de galerias.
- Gallery watermark: marca d'água efetiva de uma galeria, escolhida pelo administrador para proteger e personalizar as prévias daquela galeria.
- Overlay asset: imagem reutilizável enviada pelo administrador para funcionar como camada visual nas prévias de galerias.
- Gallery overlay: overlay efetivo de uma galeria, com imagem, posição, escala, opacidade e estado ativo/inativo próprios.
- Overlay orientation profile: ajuste de posição, escala e opacidade da Gallery overlay específico para fotos verticais ou horizontais.
- Story overlay profile: ajuste opcional de posição, escala e opacidade da Gallery overlay para Story delivery variant, compartilhado por fotos verticais e horizontais porque a variante final sempre usa o quadro 9:16.
- Story overlay preview: prévia administrativa da Story delivery variant para validar se a Story overlay profile opcional funciona com fotos verticais e horizontais.
- Shared gallery: conjunto administrável de fotos, controles de prévia e link/código, criado por compartilhamento direto ou por venda direta.
- Delivery session: tentativa de venda/envio das fotos; pode falhar sem remover ou substituir a Shared gallery.
- Gallery delivery mode: campo de compatibilidade que registra `download`, `both` ou o legado `whatsapp`; novas Shared galleries sempre oferecem Gallery download e usam `both` apenas quando também enviam Paid originals pelo WhatsApp.
- Gallery delivery policy: configuração de cada Shared gallery formada pelo prazo pós-pagamento e pelo toggle de envio adicional dos Paid originals pelo WhatsApp.
- Default gallery delivery policy: configuração administrativa usada como valor inicial em novas Shared galleries; começa com 7 dias e sem envio dos originais pelo WhatsApp.
- Selection and payment window: prazo curto, em minutos, usado pelo cliente para selecionar fotos e iniciar o pagamento antes da compra.
- Post-payment access window: prazo de 1 a 365 dias, contado de `approvedAt`, durante o qual uma Shared gallery aprovada permanece aberta para Gallery downloads; o padrão é 7 dias e pode ser sobrescrito por galeria.
- Approval notification job: job independente que tenta enviar pelo WhatsApp uma mensagem leve com link, código e validade após a aprovação, sem bloquear Gallery downloads.
- Media delivery job: job opcional que prepara e envia Paid originals pelo WhatsApp quando a Shared gallery habilita esse canal adicional.
- Delivery job lease: período de execução de um Delivery job; jobs que permanecem `running` por mais de 10 minutos são considerados abandonados por um processo encerrado e podem ser reclamados novamente.
- Download entitlement: direito de download criado por uma Delivery session aprovada, ligado a uma Shared gallery e aos Paid originals comprados nela; múltiplos direitos podem coexistir na mesma galeria enquanto ela permitir acesso.
- Purchased photo: foto de uma Shared gallery coberta por um Download entitlement; continua visível para o cliente, mas não deve voltar ao carrinho de uma nova compra na mesma galeria.
- Purchased photo controls: estado de UI em que uma Purchased photo permanece no grid, não pode ser selecionada novamente e exibe seu Gallery download quando a galeria oferece download.
- Gallery download: canal de entrega que disponibiliza ao cliente a mesma versão final que seria enviada pelo WhatsApp, incluindo overlays ativos e Story delivery variants quando configurados.
- Download-only delivery: política em que a aprovação libera Gallery download e tenta enviar apenas o Approval notification job, sem enfileirar Media delivery job.
- Download access context: acesso do cliente pelo mesmo link/token da Shared gallery, usado para reconhecer Purchased photos e Gallery downloads enquanto a galeria permitir acesso.
- Download-all archive: pacote ZIP gerado sob demanda a partir dos Gallery downloads autorizados naquele momento, sem representar armazenamento permanente da entrega.
- Download-all availability: o Download-all archive só aparece quando há pelo menos uma Purchased photo e o Gallery delivery mode permite Gallery download.
- Payment promotion: operação idempotente compartilhada por Pix e aprovação manual que cria Download entitlements e estende `expiresAt` até, no mínimo, `approvedAt + Post-payment access window`.
- Explicit gallery revocation: bloqueio administrativo que Payment promotion não desfaz automaticamente; os direitos da compra permanecem registrados até o fotógrafo reativar a galeria.
- Startup readiness gate: contrato do `INICIAR_TUDO.bat` que exige portas exclusivas, PostgreSQL migrado, resposta identificada de `/api/health` e HTML do painel SnapFlow antes de declarar o sistema iniciado.
- WhatsApp profile recovery: falhas transitórias do Chromium e bloqueios `EBUSY`/`EPERM`/`ENOTEMPTY` dentro do perfil LocalAuth não podem encerrar a API; o browser antigo é fechado, um perfil bloqueado é isolado e a reconexão continua em segundo plano.
- Plan B watermark: marca d'água padrão da SnapFlow usada quando uma galeria não tem imagem de marca personalizada.
- Paid original: arquivo entregue ao cliente depois da liberação de pagamento, sem marca d'água de prévia; quando uma Gallery overlay está ativa, ela é aplicada também na entrega.
- Story delivery variant: cópia 9:16 de uma Paid original, gerada para compartilhamento em Instagram Stories e entregue junto com o arquivo pago normal quando a Shared gallery habilita esse modo; não depende de Gallery overlay.
