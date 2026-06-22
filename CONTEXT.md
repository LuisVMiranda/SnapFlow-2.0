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
- Gallery delivery mode: escolha da Shared gallery que define se os Paid originals aprovados ficam disponíveis por WhatsApp, por Download entitlement ou pelos dois canais.
- Default delivery mode: configuração administrativa usada como valor inicial do Gallery delivery mode em novas Shared galleries, podendo ser sobrescrita em cada galeria.
- Download entitlement: direito de download criado por uma Delivery session aprovada, ligado a uma Shared gallery e aos Paid originals comprados nela; múltiplos direitos podem coexistir na mesma galeria enquanto ela permitir acesso.
- Purchased photo: foto de uma Shared gallery coberta por um Download entitlement; continua visível para o cliente, mas não deve voltar ao carrinho de uma nova compra na mesma galeria.
- Purchased photo controls: estado de UI em que uma Purchased photo permanece no grid, não pode ser selecionada novamente e exibe seu Gallery download quando a galeria oferece download.
- Gallery download: canal de entrega que disponibiliza ao cliente a mesma versão final que seria enviada pelo WhatsApp, incluindo overlays ativos e Story delivery variants quando configurados.
- Download-only delivery: Gallery delivery mode em que a aprovação libera Gallery download sem acionar entrega por WhatsApp.
- Download access context: acesso do cliente pelo mesmo link/token da Shared gallery, usado para reconhecer Purchased photos e Gallery downloads enquanto a galeria permitir acesso.
- Download-all archive: pacote ZIP gerado sob demanda a partir dos Gallery downloads autorizados naquele momento, sem representar armazenamento permanente da entrega.
- Download-all availability: o Download-all archive só aparece quando há pelo menos uma Purchased photo e o Gallery delivery mode permite Gallery download.
- Plan B watermark: marca d'água padrão da SnapFlow usada quando uma galeria não tem imagem de marca personalizada.
- Paid original: arquivo entregue ao cliente depois da liberação de pagamento, sem marca d'água de prévia; quando uma Gallery overlay está ativa, ela é aplicada também na entrega.
- Story delivery variant: cópia 9:16 de uma Paid original, gerada para compartilhamento em Instagram Stories e entregue junto com o arquivo pago normal quando a Shared gallery habilita esse modo; não depende de Gallery overlay.
