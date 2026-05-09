insert into app_settings(key, value) values
  (
    'watermarkSettings',
    '{
      "width": 420,
      "height": 140,
      "opacity": 0.55,
      "instances": 1
    }'::jsonb
  )
on conflict (key) do nothing;
