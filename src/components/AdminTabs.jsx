import { ChartColumn, Globe, Images, KeyRound, Settings } from 'lucide-react';

const TABS = [
  { key: 'galerias', label: 'Galerias', icon: Images },
  { key: 'website', label: 'Website', icon: Globe },
  { key: 'configuracoes', label: 'Configurações', icon: Settings },
  { key: 'credenciais', label: 'Credenciais', icon: KeyRound },
  { key: 'vendas', label: 'Vendas', icon: ChartColumn },
];

export function AdminTabs({ activeTab, onChange }) {
  return (
    <nav className="admin-tabs" aria-label="Seções administrativas">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          className={`admin-tab ${activeTab === key ? 'active' : ''}`}
          aria-current={activeTab === key ? 'page' : undefined}
          onClick={() => onChange(key)}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
