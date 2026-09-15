import path from 'node:path';

const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const dataPath = '/var/lib/postgresql/data';
// Inspect only operational metadata, never container environment variables or SQL logs.
const inspectFormat = '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},'
  + '"project":{{json (index .Config.Labels "com.docker.compose.project")}},'
  + '"service":{{json (index .Config.Labels "com.docker.compose.service")}},'
  + '"mounts":{{json .Mounts}},"bindings":{{json .HostConfig.PortBindings}},'
  + '"ports":{{json .NetworkSettings.Ports}},"status":{{json .State.Status}},'
  // Docker omits Health entirely before the first start, and for images without a healthcheck.
  + '"health":{{with index .State "Health"}}{{json (index . "Status")}}{{else}}null{{end}}}';

function commandFailure(result) {
  if (result.timedOut) return 'consulta Docker excedeu o tempo limite';
  if (/template (?:parsing|executing) error/i.test(result.stderr || '')) return 'erro de template na inspecao Docker; atualize os scripts do SnapFlow';
  if (/permission denied|access (?:is )?denied|acesso negado/i.test(result.stderr || '')) return 'acesso ao Docker negado; confira as permissoes';
  return 'consulta Docker falhou. Confira o Docker Desktop e os logs';
}

function readJson(result, label) {
  if (result.code !== 0 || result.timedOut) throw new Error(`${label}: ${commandFailure(result)}.`);
  try { return JSON.parse(result.stdout); }
  catch { throw new Error(`${label}: Docker retornou uma resposta invalida.`); }
}

export async function inspectDatabase(ops) {
  const result = await ops.execute(docker, ['inspect', '--type', 'container', '--format', inspectFormat, 'snapflow-postgres']);
  if (result.code !== 0 && /No such (object|container)/i.test(result.stderr || '')) return null;
  return readJson(result, 'Inspecao do container snapflow-postgres');
}

async function assertLocalEngine(ops, settings) {
  const result = await ops.execute(docker, ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']);
  const contextEndpoint = readJson(result, 'Contexto Docker');
  const endpoint = !settings.env.DOCKER_CONTEXT && settings.env.DOCKER_HOST || contextEndpoint;
  if (!/^(?:npipe:\/\/\/\/\.\/pipe\/|unix:\/\/\/|tcp:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/?$)/i.test(endpoint)) {
    throw new Error('O contexto Docker aponta para outro computador. Selecione o Docker Desktop local antes de iniciar.');
  }
}

export function assertOwnedContainer(value, project) {
  if (!value || value.name !== '/snapflow-postgres' || value.service !== 'postgres' || value.project !== project) {
    throw new Error('Container snapflow-postgres sem identidade Compose esperada. Nenhum container foi removido. Confira o projeto Docker.');
  }
  const volume = value.mounts?.find(mount => mount.Destination === dataPath);
  if (volume?.Type !== 'volume' || volume.Name !== `${project}_snapflow_postgres_data`) {
    throw new Error('Volume PostgreSQL diferente do esperado. Recuperacao automatica bloqueada para preservar os dados existentes.');
  }
  return volume.Name;
}

function projectFor(settings, existing) {
  const project = existing?.project || settings.env.COMPOSE_PROJECT_NAME
    || path.basename(settings.root).toLowerCase().replace(/[^a-z0-9_-]/g, '').replace(/^[^a-z0-9]+/, '');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(project || '')) throw new Error('Projeto Compose invalido. Confira COMPOSE_PROJECT_NAME.');
  return project;
}

function assertPortConfig(service, settings) {
  const port = service?.ports?.[0];
  const expectedPort = new URL(settings.databaseUrl).port || '5432';
  if (service.ports?.length !== 1 || port.host_ip !== '127.0.0.1' || String(port.published) !== expectedPort
      || Number(port.target) !== 5432 || port.protocol !== 'tcp') {
    throw new Error('Porta Compose nao corresponde a DATABASE_URL em loopback. Nenhum container foi alterado.');
  }
}

function assertVolumeConfig(config, settings) {
  const service = config.services.postgres;
  const volume = service.volumes?.[0];
  const volumeName = config.volumes?.snapflow_postgres_data?.name;
  if (service.volumes?.length !== 1 || volume.type !== 'volume' || volume.target !== dataPath
      || volume.source !== 'snapflow_postgres_data' || volumeName !== `${settings.composeProject}_snapflow_postgres_data`) {
    throw new Error('Volume Compose inesperado. Inicializacao bloqueada para nao criar um banco vazio.');
  }
  return volumeName;
}

export function validateDatabaseConfig(config, settings, existing) {
  const service = config.services?.postgres;
  if (service?.container_name !== 'snapflow-postgres' || service.image !== 'postgres:16-alpine') {
    throw new Error('Configuracao Compose PostgreSQL inesperada. Confira docker-compose.yml.');
  }
  assertPortConfig(service, settings);
  const volumeName = assertVolumeConfig(config, settings);
  if (existing) {
    assertOwnedContainer(existing, settings.composeProject);
    if (existing.image !== service.image) throw new Error('Imagem PostgreSQL diferente da instalada. Faca uma migracao planejada; dados preservados.');
  }
  return volumeName;
}

function hasPublishedPort(value, settings) {
  const expected = new URL(settings.databaseUrl).port || '5432';
  return value.ports?.['5432/tcp']?.some(port => port.HostIp === '127.0.0.1' && port.HostPort === expected) === true;
}

async function up(ops, repair = false) {
  const args = ['up', '-d', '--no-deps'];
  // Ordinary first install may need to download the pinned PostgreSQL image.
  if (repair) args.push('--pull', 'never', '--force-recreate');
  const result = await ops.compose([...args, 'postgres'], 180000);
  if (result.stdout) ops.log(result.stdout);
  if (result.stderr) ops.log(result.stderr);
  if (result.code !== 0 || result.timedOut) throw new Error('Inicializacao Docker Compose falhou ou excedeu 180s.');
}

export async function prepareDockerDatabase(ops, settings) {
  await assertLocalEngine(ops, settings);
  const existing = await inspectDatabase(ops);
  settings.composeProject = projectFor(settings, existing);
  if (existing) assertOwnedContainer(existing, settings.composeProject);
  const config = readJson(await ops.compose(['config', '--format', 'json']), 'Configuracao Compose');
  const volumeName = validateDatabaseConfig(config, settings, existing);
  ops.log(`Projeto Docker: ${settings.composeProject}; container: snapflow-postgres; volume: ${volumeName}.`);
  await up(ops);
  let repaired = false;
  const check = async () => {
    const value = await inspectDatabase(ops);
    assertOwnedContainer(value, settings.composeProject);
    ops.log(`PostgreSQL: container ${value.status}, saude ${value.health || 'sem healthcheck'}, porta ${hasPublishedPort(value, settings) ? settings.target : 'NAO publicada'}.`);
    if (['exited', 'dead'].includes(value.status) || value.health === 'unhealthy') {
      throw new Error(`PostgreSQL no container esta ${value.health || value.status}. Confira os logs do banco; nao e apenas uma falha de porta.`);
    }
    return value;
  };
  const repair = async () => {
    const value = await check();
    if (repaired || value.health !== 'healthy' || value.status !== 'running') return false;
    const volume = readJson(await ops.execute(docker, ['volume', 'inspect', '--format', '{{json .Name}}', volumeName]), 'Volume PostgreSQL');
    if (volume !== volumeName) throw new Error('Volume existente nao confirmado. Recuperacao bloqueada.');
    repaired = true;
    ops.log(`Recuperando publicacao da porta uma unica vez; preservando volume ${volumeName}.`);
    await up(ops, true);
    await check();
    return true;
  };
  const current = await check();
  if (!hasPublishedPort(current, settings)) await repair();
  return { repair };
}
