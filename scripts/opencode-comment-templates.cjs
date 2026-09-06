const fs = require('node:fs');
const path = require('node:path');

function renderTemplate(name, values) {
  let body = fs.readFileSync(path.join(__dirname, name), 'utf8').trim();
  for (const [key, value] of Object.entries(values)) {
    body = body.replaceAll(`@${key}@`, String(value ?? ''));
  }
  return body;
}

module.exports = { renderTemplate };
