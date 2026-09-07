const RETROSPECTIVE_MARKER = 'opencode-agent-retrospective-data:v1';
const DEFAULT_MAX_ALIGNMENT = 5;
const DEFAULT_MAX_SKILLS = 5;
const MAX_TEXT_LENGTH = 1200;

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function bounded(value, fallback = '') {
  return text(value, fallback).replace(/[\r\n]+/g, ' ').slice(0, MAX_TEXT_LENGTH);
}

function stringList(value, limit) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((item) => bounded(item))
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function normalizeSkill(value) {
  if (!value || typeof value !== 'object') return null;
  const name = bounded(value.name);
  const reason = bounded(value.reason);
  const action = ['add', 'improve', 'keep'].includes(value.action) ? value.action : 'improve';
  if (!name || !reason) return null;
  return { name, action, reason };
}

function normalizeRetrospective(value) {
  if (!value || typeof value !== 'object') {
    return { status: 'unavailable', reason: 'No retrospective output was produced.' };
  }
  const status = value.status === 'ok' ? 'ok' : 'unavailable';
  if (status !== 'ok') {
    return { status: 'unavailable', reason: bounded(value.reason, 'Retrospective analysis was unavailable.') };
  }
  const skills = Array.isArray(value.skill_recommendations)
    ? value.skill_recommendations.map(normalizeSkill).filter(Boolean).slice(0, DEFAULT_MAX_SKILLS)
    : [];
  return {
    status,
    summary_markdown: bounded(value.summary_markdown, 'No retrospective summary was returned.'),
    prompt_alignment: stringList(value.prompt_alignment, DEFAULT_MAX_ALIGNMENT),
    skill_recommendations: skills
  };
}

function encodeGuidance(value) {
  return Buffer.from(JSON.stringify({
    prompt_alignment: stringList(value.prompt_alignment, DEFAULT_MAX_ALIGNMENT),
    skill_recommendations: (value.skill_recommendations || []).map(normalizeSkill).filter(Boolean).slice(0, DEFAULT_MAX_SKILLS)
  }), 'utf8').toString('base64');
}

function decodeGuidance(commentBody) {
  if (typeof commentBody !== 'string') return null;
  const pattern = new RegExp(`<!--\\s*${RETROSPECTIVE_MARKER}\\s+([A-Za-z0-9+/=]+)\\s*-->`);
  const match = commentBody.match(pattern);
  if (!match) return null;
  try {
    return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function extractPromptAlignment(comments, limit = DEFAULT_MAX_ALIGNMENT) {
  const result = [];
  const seen = new Set();
  for (const comment of [...comments].reverse()) {
    const data = decodeGuidance(comment?.body);
    for (const item of stringList(data?.prompt_alignment, limit)) {
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
      if (result.length >= limit) return result;
    }
  }
  return result;
}

function renderAgentRetrospective(value) {
  const retrospective = normalizeRetrospective(value);
  const marker = retrospective.status === 'ok'
    ? `<!-- ${RETROSPECTIVE_MARKER} ${encodeGuidance(retrospective)} -->`
    : `<!-- ${RETROSPECTIVE_MARKER} ${encodeGuidance({ prompt_alignment: [], skill_recommendations: [] })} -->`;
  if (retrospective.status !== 'ok') {
    return [
      marker,
      '<details>',
      '<summary>Agent retrospective</summary>',
      '',
      `Retrospective analysis was unavailable: ${retrospective.reason}`,
      '',
      '</details>'
    ].join('\n');
  }

  const skills = retrospective.skill_recommendations.length
    ? retrospective.skill_recommendations
        .map((skill) => `- **${skill.name}** (${skill.action}): ${skill.reason}`)
        .join('\n')
    : '- No additional skill gaps identified.';
  const alignment = retrospective.prompt_alignment.length
    ? retrospective.prompt_alignment.map((item) => `- ${item}`).join('\n')
    : '- No reusable prompt-alignment notes identified.';
  return [
    marker,
    '<details>',
    '<summary>Agent retrospective</summary>',
    '',
    retrospective.summary_markdown,
    '',
    '### Skills to add or improve',
    '',
    skills,
    '',
    '### Prompt alignment for the next run',
    '',
    alignment,
    '',
    '</details>'
  ].join('\n');
}

module.exports = {
  RETROSPECTIVE_MARKER,
  decodeGuidance,
  extractPromptAlignment,
  normalizeRetrospective,
  renderAgentRetrospective
};
