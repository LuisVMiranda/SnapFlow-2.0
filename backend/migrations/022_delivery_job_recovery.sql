create index if not exists delivery_jobs_running_recovery_idx
  on delivery_jobs(status, updated_at)
  where status = 'running';
