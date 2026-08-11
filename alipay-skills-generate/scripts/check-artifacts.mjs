#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const gates = { C: 1, D: 2, E: 3, F: 4 };

function usage() {
  console.log(`Usage: node scripts/check-artifacts.mjs <project-path> [--gate C|D|E|F] [--artifacts-dir <path>]

Checks generation artifacts only. Gate F is the default and includes C, D, E and F.
The command checks file presence, JSON parsing, declared file paths, and the required
global instruction file; it does not review business semantics or replace
alipay-skills-static-eval.`);
}

function parseArgs(argv) {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(argv.length ? 0 : 2);
  }

  const parsed = {
    projectPath: path.resolve(argv[0]),
    gate: "F",
    artifactsDir: "",
  };

  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--gate") {
      const value = String(argv[index + 1] || "").toUpperCase();
      if (!Object.hasOwn(gates, value)) {
        throw new Error("--gate must be one of C, D, E or F");
      }
      parsed.gate = value;
      index += 1;
    } else if (key === "--artifacts-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--artifacts-dir requires a path");
      parsed.artifactsDir = path.resolve(parsed.projectPath, value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  if (!parsed.artifactsDir) {
    parsed.artifactsDir = path.join(parsed.projectPath, ".alipay-ai-skills");
  }
  return parsed;
}

function isNonEmptyFile(file) {
  try {
    return fs.statSync(file).isFile() && fs.statSync(file).size > 0;
  } catch {
    return false;
  }
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function fileSize(file) {
  try {
    const stat = fs.statSync(file);
    return stat.isFile() ? stat.size : -1;
  } catch {
    return -1;
  }
}

function readJson(file, label, errors) {
  if (!isNonEmptyFile(file)) {
    errors.push({ label, hint: "create a non-empty JSON file" });
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push({ label, hint: `fix invalid JSON (${error.message})` });
    return null;
  }
}

function listNonEmptyFiles(dir, predicate) {
  if (!isDirectory(dir)) return [];
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && predicate(entry.name))
      .filter((entry) => isNonEmptyFile(path.join(dir, entry.name)))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function listSkillDirs(skillsDir) {
  if (!isDirectory(skillsDir)) return [];
  try {
    return fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function normalize(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function isUnder(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function componentFiles(skillDir, componentPath) {
  const base = path.join(skillDir, componentPath);
  const dir = path.dirname(base);
  const stem = path.basename(base);
  return ["axml", "acss", "js", "json"].map((extension) => ({
    extension,
    file: path.join(dir, `${stem}.${extension}`),
  }));
}

function runChecks(options) {
  const passes = [];
  const errors = [];
  const check = (label, condition, hint) => {
    if (condition) passes.push(label);
    else errors.push({ label, hint });
  };

  const rank = gates[options.gate];
  const shouldCheck = (gate) => rank >= gates[gate];

  if (shouldCheck("C")) {
    const specs = listNonEmptyFiles(
      options.artifactsDir,
      (name) => /^interface-spec\..+\.md$/.test(name)
    );
    check(
      `Gate C: interface-spec.<capability>.md (${specs.length} found)`,
      specs.length > 0,
      "write at least one non-empty interface-spec.<capability>.md under .alipay-ai-skills/"
    );
  }

  if (shouldCheck("D")) {
    check(
      "Gate D: design.md",
      isNonEmptyFile(path.join(options.artifactsDir, "design.md")),
      "write a non-empty design.md under .alipay-ai-skills/"
    );
  }

  const skillsDir = path.join(options.projectPath, "skills");
  const skillNames = listSkillDirs(skillsDir);

  if (shouldCheck("E")) {
    check("Gate E: skills/ directory", isDirectory(skillsDir), "generate skills/ before continuing");
    check("Gate E: at least one Skill directory", skillNames.length > 0, "generate at least one skills/<skill-name>/ directory");

    for (const name of skillNames) {
      const skillDir = path.join(skillsDir, name);
      const requiredFiles = ["mcp.json", "SKILL.md", "index.js"];
      for (const file of requiredFiles) {
        check(`${name}/${file}`, isNonEmptyFile(path.join(skillDir, file)), `create ${name}/${file}`);
      }

      check(`${name}/utils/result.js`, isNonEmptyFile(path.join(skillDir, "utils", "result.js")), `create ${name}/utils/result.js`);
      check(`${name}/utils/request.js`, isNonEmptyFile(path.join(skillDir, "utils", "request.js")), `create ${name}/utils/request.js`);

      const mcp = readJson(path.join(skillDir, "mcp.json"), `${name}/mcp.json`, errors);
      if (!mcp) continue;

      check(`${name}/mcp.json apis[]`, Array.isArray(mcp.apis) && mcp.apis.length > 0, `declare APIs in ${name}/mcp.json`);
      if (Array.isArray(mcp.apis)) {
        for (const api of mcp.apis) {
          const apiName = String(api?.name || "");
          check(`${name}/mcp.json API name`, apiName.length > 0, `give every API in ${name}/mcp.json a name`);
          if (apiName) {
            check(`${name}/apis/${apiName}.js`, isNonEmptyFile(path.join(skillDir, "apis", `${apiName}.js`)), `create ${name}/apis/${apiName}.js`);
          }
        }
      }

      const componentPaths = new Set();
      for (const api of Array.isArray(mcp.apis) ? mcp.apis : []) {
        const componentPath = api?._meta?.ui?.componentPath;
        if (componentPath) componentPaths.add(componentPath);
      }
      for (const component of Array.isArray(mcp.components) ? mcp.components : []) {
        if (component?.path) componentPaths.add(component.path);
      }
      for (const componentPath of componentPaths) {
        for (const { extension, file } of componentFiles(skillDir, componentPath)) {
          check(`component ${name}/${componentPath}.${extension}`, isNonEmptyFile(file), `create ${name}/${componentPath}.${extension}`);
        }
      }
    }
  }

  if (shouldCheck("F")) {
    const appFile = path.join(options.projectPath, "app.json");
    const appJson = readJson(appFile, "app.json", errors);
    if (appJson) {
      const skills = appJson.agent?.skills;
      check("Gate F: app.json agent.skills[]", Array.isArray(skills) && skills.length > 0, "register generated Skills in app.json agent.skills[]");

      const instructionValue = typeof appJson.agent?.instruction === "string"
        ? appJson.agent.instruction.trim()
        : "";
      check(
        "Gate F: app.json agent.instruction",
        Boolean(instructionValue),
        "set agent.instruction to a project-relative global prompt file such as AGENTS.md"
      );
      if (instructionValue) {
        const instructionPath = normalize(instructionValue);
        const instructionFile = path.resolve(options.projectPath, instructionPath);
        const instructionInProject = !path.isAbsolute(instructionValue)
          && isUnder(options.projectPath, instructionFile);
        check(
          "Gate F: agent.instruction project-relative path",
          instructionInProject,
          "keep agent.instruction inside the project directory"
        );
        if (instructionInProject) {
          const instructionBytes = fileSize(instructionFile);
          check(
            `Gate F: ${instructionPath} instruction file`,
            instructionBytes > 0,
            `create a non-empty global prompt at ${instructionPath}`
          );
          if (instructionBytes > 0) {
            check(
              `Gate F: ${instructionPath} <= 10000 bytes`,
              instructionBytes <= 10000,
              `shorten ${instructionPath} to at most 10000 bytes`
            );
          }
        }
      }

      const packages = appJson.subPackages || appJson.subpackages;
      check("Gate F: app.json subPackages[]", Array.isArray(packages) && packages.length > 0, "declare a subPackages entry with pages: []");

      if (Array.isArray(skills)) {
        for (const item of skills) {
          const skillPath = normalize(item?.path);
          check("Gate F: agent.skills entry", Boolean(item?.name && item?.description && skillPath), "give each agent.skills entry name, description and path");
          if (!skillPath) continue;

          const skillDir = path.join(options.projectPath, skillPath);
          check(`Gate F: ${skillPath} directory`, isDirectory(skillDir), `create the registered Skill at ${skillPath}`);

          const packageMatch = Array.isArray(packages)
            ? packages.find((pkg) => {
                const root = normalize(pkg?.root);
                return root && Array.isArray(pkg?.pages) && pkg.pages.length === 0 && isUnder(options.projectPath, path.join(options.projectPath, root)) && isUnder(path.join(options.projectPath, root), skillDir);
              })
            : null;
          check(`Gate F: ${skillPath} empty subPackage`, Boolean(packageMatch), `place ${skillPath} under a subPackages entry whose pages is []`);
        }
      }
    }
  }

  return { passes, errors };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}`);
    usage();
    process.exit(2);
  }

  const { passes, errors } = runChecks(options);
  for (const label of passes) console.log(`PASS ${label}`);
  if (errors.length) {
    console.error("\nMissing or invalid generation artifacts:");
    for (const error of errors) console.error(`FAIL ${error.label} -> ${error.hint}`);
    console.error(`\n${errors.length} check(s) failed; return to the indicated Gate.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nGate ${options.gate} artifact check passed.`);
}

main();
