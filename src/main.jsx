import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#f8fafc', background: '#111', minHeight: '100vh' }}>
          <h2>O painel encontrou um erro inesperado.</h2>
          <p>
            Atualize a página. Se continuar acontecendo, reinicie o painel e o servidor,
            depois verifique o terminal APP FOTOGRAFIA - SERVIDOR.
          </p>
          <details>
            <summary>Detalhe técnico para suporte</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.error && this.state.error.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
