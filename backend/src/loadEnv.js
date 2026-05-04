const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
  const backendRoot = path.join(__dirname, '..');
  dotenv.config({ path: path.join(backendRoot, '.env') });
  dotenv.config({ path: path.join(backendRoot, '.env.local'), override: true });
}

module.exports = { loadEnv };
