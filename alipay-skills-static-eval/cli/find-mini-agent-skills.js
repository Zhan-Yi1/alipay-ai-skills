#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

function existing(p) {
  try {
    fs.accessSync(p)
    return p
  } catch {
    return undefined
  }
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function requireString(label, value) {
  if (typeof value !== 'string' || value === '') {
    console.error(`${label} must be a non-empty string`)
    process.exit(1)
  }
  return value
}

function requireFile(p) {
  const f = existing(p)
  if (!f) {
    console.error(`Not found: ${p}`)
    process.exit(1)
  }
  return f
}

function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: find-mini-agent-skills <absolute-path>')
    process.exit(1)
  }
  if (!path.isAbsolute(input)) {
    console.error(`Expected an absolute path, got: ${input}`)
    process.exit(1)
  }
  if (!existing(input) || !fs.statSync(input).isDirectory()) {
    console.error(`Not a directory: ${input}`)
    process.exit(1)
  }

  const projectFile = path.join(input, 'mini.project.json')
  let miniprogramRoot = './'
  if (existing(projectFile)) {
    try {
      miniprogramRoot = readJSON(projectFile).miniprogramRoot || './'
    } catch (e) {
      console.error(`Failed to parse ${projectFile}: ${e.message}`)
      process.exit(1)
    }
  }

  const mpRoot = path.join(input, miniprogramRoot)
  const appJsonPath = requireFile(path.join(mpRoot, 'app.json'))
  let appJson
  try {
    appJson = readJSON(appJsonPath)
  } catch (e) {
    console.error(`Failed to parse ${appJsonPath}: ${e.message}`)
    process.exit(1)
  }

  const agent = appJson.agent || {}
  const skills = agent.skills || []

  // AGENT 系统提示词：agent.instruction 指向的 md 文件（相对 miniprogramRoot）
  let instruction = undefined
  const instructionRef = agent.instruction
  if (typeof instructionRef === 'string' && instructionRef !== '') {
    const instructionPath = path.join(mpRoot, instructionRef)
    instruction = existing(instructionPath)
    if (!instruction) {
      console.error(`agent.instruction not found: ${instructionPath}`)
      process.exit(1)
    }
  }

  const results = skills.map((skill, i) => {
    const name = requireString(`skills[${i}].name`, skill?.name)
    const spath = requireString(`skills[${i}].path`, skill?.path)
    const description = requireString(`skills[${i}].description`, skill?.description)

    const skillDir = path.join(mpRoot, spath)
    const resolve = (name) => path.join(skillDir, name)
    const index =
      existing(resolve('index.ts')) ||
      existing(resolve('index.js'))
    if (!index) {
      console.error(`index.ts or index.js not found in: ${skillDir}`)
      process.exit(1)
    }

    const mcpPath = requireFile(resolve('mcp.json'))
    let components = []
    try {
      const mcp = readJSON(mcpPath)
      components = Array.isArray(mcp.components)
        ? mcp.components.map((c) => ({
            path: typeof c?.path === 'string' ? c.path : undefined,
            dynamic: Boolean(c?.permissions?.['scope.dynamic']),
          }))
        : []
    } catch (e) {
      console.error(`Failed to parse ${mcpPath}: ${e.message}`)
      process.exit(1)
    }

    return {
      name,
      path: skillDir,
      description,
      files: {
        'SKILL.md': requireFile(resolve('SKILL.md')),
        'mcp.json': mcpPath,
        'index': index,
      },
      components,
    }
  })

  console.log(JSON.stringify({ instruction, skills: results }, null, 2))
}

main()