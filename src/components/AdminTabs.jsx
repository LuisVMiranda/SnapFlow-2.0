import { ChartColumn, Images, KeyRound, Settings } from 'lucide-react';

const TABS = [
  { key: 'galerias', label: 'Galerias', icon: Images },
  { key: 'vendas', label: 'Vendas', icon: ChartColumn },
  { key: 'configuracoes', label: 'Configurações', icon: Settings },
  { key: 'credenciais', label: 'Credenciais', icon: KeyRound },
];

export function AdminTabs({ activeTab, onChange }) {
  return (
    <nav className="admin-tabs" aria-label="Seções administrativas">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          className={`admin-tab ${activeTab === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
