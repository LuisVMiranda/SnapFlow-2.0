import { useEffect } from 'react';

export function useShareProtections(shareToken, setNotice) {
  // Proteções contra screenshot e download para links compartilhados
  useEffect(() => {
    if (!shareToken) return;

    // Desabilita teclas de atalho
    const handleKeyDown = (e) => {
      // Desabilita F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S, Print Screen
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 's') ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        setNotice('⚠️ Função desabilitada no modo de visualização');
        return false;
      }
    };

    // Desabilita menu de contexto
    const handleContextMenu = (e) => {
      e.preventDefault();
      setNotice('⚠️ Menu de contexto desabilitado');
      return false;
    };

    // Detecta tentativas de screenshot (limitado)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Possível tentativa de screenshot detectada');
      }
    };

    // Desabilita seleção de texto
    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    // Desabilita arrastar imagens
    const handleDragStart = (e) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);

    // Adiciona CSS para desabilitar seleção
    const style = document.createElement('style');
    style.textContent = `
      body { 
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      img { 
        -webkit-user-drag: none !important;
        -khtml-user-drag: none !important;
        -moz-user-drag: none !important;
        -o-user-drag: none !important;
        user-drag: none !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.head.removeChild(style);
    };
  }, [shareToken, setNotice]);

}
