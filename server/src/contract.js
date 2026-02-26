import fs from 'node:fs';

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function loadEventContract(schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const enums = {
    source: new Set(schema.properties.source.enum),
    type: new Set(schema.properties.type.enum),
    severity: new Set(schema.properties.severity.enum)
  };
  return { schema, enums };
}

export function validateEventEnvelope(contract, event) {
  const errors = [];
  const required = contract.schema.required || [];
  for (const key of required) {
    if (!(key in event)) errors.push(`missing ${key}`);
  }

  if (typeof event.id !== 'string' || !event.id) errors.push('id must be a non-empty string');
  if (event.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  if (!Number.isInteger(event.eventVersion) || event.eventVersion < 1) {
    errors.push('eventVersion must be integer >= 1');
  }
  if (!contract.enums.source.has(event.source)) errors.push('source is invalid');
  if (!contract.enums.type.has(event.type)) errors.push('type is invalid');
  if (!contract.enums.severity.has(event.severity)) errors.push('severity is invalid');
  if (typeof event.timestamp !== 'string' || !ISO_8601_REGEX.test(event.timestamp)) {
    errors.push('timestamp must be ISO-8601 UTC');
  }
  if (typeof event.correlationId !== 'string' || !event.correlationId) {
    errors.push('correlationId must be a non-empty string');
  }
  if (event.agentId != null && typeof event.agentId !== 'string') {
    errors.push('agentId must be a string when provided');
  }
  if (typeof event.payload !== 'object' || event.payload == null || Array.isArray(event.payload)) {
    errors.push('payload must be an object');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
