/**
 * Configuration loader for Marcus Vance Automotive Intake Agent.
 * Reads config.json if present, falling back to CONFIG.example.json.
 */

const fs = require('fs');
const path = require('path');

function loadConfig() {
  const rootDir = path.resolve(__dirname, '..');
  const customConfigPath = path.join(rootDir, 'config.json');
  const exampleConfigPath = path.join(rootDir, 'CONFIG.example.json');

  let rawConfig = null;
  if (fs.existsSync(customConfigPath)) {
    rawConfig = fs.readFileSync(customConfigPath, 'utf8');
  } else if (fs.existsSync(exampleConfigPath)) {
    rawConfig = fs.readFileSync(exampleConfigPath, 'utf8');
  } else {
    throw new Error('No configuration file found (checked config.json and CONFIG.example.json).');
  }

  const config = JSON.parse(rawConfig);
  return config;
}

module.exports = {
  loadConfig
};
