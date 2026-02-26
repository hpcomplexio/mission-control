import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Ajv from 'ajv/dist/2020.js'

const repoRoot = process.cwd()
const schemaPath = process.env.EVENT_SCHEMA_PATH || path.join(repoRoot, 'server/contracts/event-schema.json')
const fixturesRoot = path.join(repoRoot, 'tests/contracts/fixtures')

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function fixtureFiles(dirPath) {
  return fs.readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(dirPath, name))
}

test('event schema contract fixtures', () => {
  if (!fs.existsSync(schemaPath)) {
    test.skip(`schema not found at ${schemaPath}`)
    return
  }

  const schema = loadJson(schemaPath)
  const ajv = new Ajv({ allErrors: true, strict: false })
  const validate = ajv.compile(schema)

  const validDir = path.join(fixturesRoot, 'valid')
  for (const filePath of fixtureFiles(validDir)) {
    const payload = loadJson(filePath)
    const ok = validate(payload)
    assert.equal(ok, true, `expected valid fixture to pass: ${filePath} :: ${ajv.errorsText(validate.errors)}`)
  }

  const invalidDir = path.join(fixturesRoot, 'invalid')
  for (const filePath of fixtureFiles(invalidDir)) {
    const payload = loadJson(filePath)
    const ok = validate(payload)
    assert.equal(ok, false, `expected invalid fixture to fail: ${filePath}`)
  }
})
