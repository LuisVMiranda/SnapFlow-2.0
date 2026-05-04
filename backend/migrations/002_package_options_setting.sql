insert into app_settings(key, value) values
  (
    'packageOptions',
    '{
      "eventos": {
        "label": "Pacote 5+ fotos",
        "shortLabel": "Eventos",
        "description": "R$ 15 por foto, cai para R$ 10 a partir de 5 fotos.",
        "unit": 15,
        "bulk": 10,
        "threshold": 5
      },
      "escola": {
        "label": "Pacote 3+ fotos",
        "shortLabel": "Escola / Corp",
        "description": "R$ 15 por foto, cai para R$ 10 a partir de 3 fotos.",
        "unit": 15,
        "bulk": 10,
        "threshold": 3
      }
    }'::jsonb
  )
on conflict (key) do nothing;
