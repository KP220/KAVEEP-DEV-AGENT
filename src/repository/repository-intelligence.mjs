import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const defaultOptions = Object.freeze({
  maxDepth: 6,
  maxFiles: 500,
  maxDirectories: 150,
  maxReadableFileSizeBytes: 65536,
  maxRelevantFiles: 80
});

const ignoredNames = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".next",
  "target",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  "tmp",
  "temp"
]);

const sensitiveNamePatterns = [
  /^\.env(?:\.|$)/i,
  /credential/i,
  /secret/i,
  /token/i,
  /password/i,
  /passwd/i,
  /private[-_]?key/i,
  /^id_rsa$/i,
  /^id_dsa$/i,
  /^id_ecdsa$/i,
  /^id_ed25519$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i
];

const artifactRules = [
  ["readme", (file) => /^readme(?:\..*)?$/i.test(path.basename(file))],
  ["license", (file) => /^licen[cs]e(?:\..*)?$/i.test(path.basename(file))],
  ["architecture_document", (file) => /architecture/i.test(path.basename(file))],
  ["constitution_document", (file) => /constitution/i.test(path.basename(file))],
  ["policy_document", (file) => /policy/i.test(path.basename(file))],
  ["roadmap_document", (file) => /roadmap/i.test(path.basename(file))],
  ["specification", (file) => file.startsWith("specs/") || /(^|\/)spec/i.test(file)],
  ["schema", (file) => file.startsWith("schemas/") || /\.schema\.json$/i.test(file)],
  ["example", (file) => file.startsWith("examples/")],
  ["source", (file) => file.startsWith("src/")],
  ["test", (file) => /(^|\/)(test|tests|__tests__)(\/|$)/i.test(file) || /(^|\/)test-[^/]+\.m?js$/i.test(file)],
  ["documentation", (file) => file.startsWith("docs/") || /\.md$/i.test(file)],
  ["package_manifest", (file) => /(^|\/)(package\.json|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|build\.gradle|requirements\.txt)$/i.test(file)],
  ["ci_workflow", (file) => file.startsWith(".github/workflows/")],
  ["docker_artifact", (file) => /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/i.test(file)],
  ["changelog", (file) => /changelog/i.test(path.basename(file))],
  ["contribution_guide", (file) => /contributing/i.test(path.basename(file))]
];

const technologyRules = [
  ["JavaScript", [".js", ".mjs", ".cjs"], ["package.json"]],
  ["TypeScript", [".ts", ".tsx"], ["tsconfig.json"]],
  ["Node.js", [], ["package.json"]],
  ["Python", [".py"], ["pyproject.toml", "requirements.txt", "setup.py"]],
  ["Rust", [".rs"], ["Cargo.toml"]],
  ["Go", [".go"], ["go.mod"]],
  ["Java", [".java"], ["pom.xml", "build.gradle"]],
  ["Kotlin", [".kt", ".kts"], []],
  ["C#", [".cs"], ["*.csproj"]],
  ["C", [".c", ".h"], []],
  ["C++", [".cpp", ".cc", ".cxx", ".hpp"], []],
  ["PHP", [".php"], ["composer.json"]],
  ["Ruby", [".rb"], ["Gemfile"]],
  ["Swift", [".swift"], ["Package.swift"]],
  ["Dart", [".dart"], ["pubspec.yaml"]],
  ["JSON Schema", [".json"], [".schema.json"]],
  ["Docker", [], ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"]],
  ["GitHub Actions", [".yml", ".yaml"], [".github/workflows"]]
];

function now() {
  return new Date(0).toISOString();
}

function normalizeRelative(filePath) {
  return filePath.split(path.sep).join("/");
}

function safeIdSegment(value) {
  const sanitized = String(value)
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/_+/g, "_")
    .toLowerCase();
  return sanitized || "repository";
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validateBound(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

function normalizeOptions(options = {}) {
  return {
    maxDepth: validateBound("maxDepth", options.maxDepth ?? defaultOptions.maxDepth),
    maxFiles: validateBound("maxFiles", options.maxFiles ?? defaultOptions.maxFiles),
    maxDirectories: validateBound("maxDirectories", options.maxDirectories ?? defaultOptions.maxDirectories),
    maxReadableFileSizeBytes: validateBound(
      "maxReadableFileSizeBytes",
      options.maxReadableFileSizeBytes ?? defaultOptions.maxReadableFileSizeBytes
    ),
    maxRelevantFiles: validateBound("maxRelevantFiles", options.maxRelevantFiles ?? defaultOptions.maxRelevantFiles)
  };
}

function makeMessage(code, message, filePath) {
  return filePath ? { code, message, path: filePath } : { code, message };
}

function blockedReport(rootInput, error) {
  const timestamp = now();
  return {
    intelligenceId: "repo_intel_blocked_001",
    schemaVersion: "1.0.0",
    repositoryRef: "unverified_repository",
    repositoryRoot: rootInput ? String(rootInput) : "not_supplied",
    repositoryName: "unverified_repository",
    inspectionScope: {
      approvedRootRequired: true,
      readOnly: true,
      maxDepth: defaultOptions.maxDepth,
      maxFiles: defaultOptions.maxFiles,
      maxDirectories: defaultOptions.maxDirectories,
      maxReadableFileSizeBytes: defaultOptions.maxReadableFileSizeBytes,
      maxRelevantFiles: defaultOptions.maxRelevantFiles,
      symlinkPolicy: "do_not_follow",
      ignoredPathPolicy: "Ignore dependency, generated, cache, VCS, virtual environment, and temporary paths."
    },
    status: rootInput ? "blocked" : "no_action",
    startedAt: timestamp,
    completedAt: timestamp,
    summary: rootInput ? "Repository inspection was blocked before traversal." : "No approved repository root was supplied.",
    directorySummary: { totalDirectoriesObserved: 0, directories: [], truncated: false },
    fileSummary: { totalFilesObserved: 0, files: [], extensions: [], truncated: false },
    detectedArtifacts: [],
    technologyIndicators: [],
    documentationArtifacts: [],
    specificationArtifacts: [],
    schemaArtifacts: [],
    sourceArtifacts: [],
    testArtifacts: [],
    validationEntryPoints: [],
    packageAndBuildFiles: [],
    architectureSignals: [],
    ownershipSignals: [],
    integrationSignals: [],
    relevantFiles: [],
    ignoredPaths: [],
    warnings: [],
    errors: [makeMessage("repository_root_blocked", error.message)],
    limitations: ["No repository traversal was performed."],
    recommendedNextAction: rootInput ? "block_request" : "no_action"
  };
}

function isSensitivePath(relativePath) {
  return relativePath
    .split("/")
    .some((part) => sensitiveNamePatterns.some((pattern) => pattern.test(part)));
}

function isIgnoredName(name) {
  return ignoredNames.has(name);
}

function addUniquePath(list, item) {
  if (!list.some((entry) => entry.path === item.path && entry.kind === item.kind)) {
    list.push(item);
  }
}

function collectArtifacts(files) {
  const artifacts = [];
  for (const file of files) {
    for (const [artifactType, matches] of artifactRules) {
      if (matches(file)) {
        artifacts.push({
          artifactType,
          path: file,
          confidence: "detected",
          evidence: "Detected by deterministic path or filename rule."
        });
      }
    }
  }
  return artifacts;
}

function collectTechnologyIndicators(files) {
  const indicators = [];
  for (const [technology, extensions, filenames] of technologyRules) {
    const evidence = [];
    for (const file of files) {
      const extension = path.posix.extname(file);
      const basename = path.posix.basename(file);
      if (extensions.includes(extension) || filenames.includes(basename)) {
        evidence.push(file);
      }
      if (filenames.some((name) => name.includes("*") ? false : file.includes(name))) {
        evidence.push(file);
      }
    }
    const uniqueEvidence = [...new Set(evidence)].slice(0, 12);
    if (uniqueEvidence.length > 0) {
      indicators.push({ technology, confidence: "detected", evidence: uniqueEvidence });
    }
  }
  return indicators;
}

function collectPathGroups(files, directories) {
  const documentationArtifacts = [];
  const specificationArtifacts = [];
  const schemaArtifacts = [];
  const sourceArtifacts = [];
  const testArtifacts = [];
  const packageAndBuildFiles = [];

  for (const directory of directories) {
    if (directory === "docs" || directory.startsWith("docs/")) {
      addUniquePath(documentationArtifacts, { path: directory, kind: "documentation_directory", confidence: "detected" });
    }
    if (directory === "specs" || directory.startsWith("specs/")) {
      addUniquePath(specificationArtifacts, { path: directory, kind: "specification_directory", confidence: "detected" });
    }
    if (directory === "schemas" || directory.startsWith("schemas/")) {
      addUniquePath(schemaArtifacts, { path: directory, kind: "schema_directory", confidence: "detected" });
    }
    if (directory === "src" || directory.startsWith("src/")) {
      addUniquePath(sourceArtifacts, { path: directory, kind: "source_directory", confidence: "detected" });
    }
    if (/^tests?(\/|$)/i.test(directory)) {
      addUniquePath(testArtifacts, { path: directory, kind: "test_directory", confidence: "detected" });
    }
  }

  for (const file of files) {
    const basename = path.posix.basename(file);
    if (/\.md$/i.test(file) || file.startsWith("docs/")) {
      addUniquePath(documentationArtifacts, { path: file, kind: "documentation_file", confidence: "detected" });
    }
    if (file.startsWith("specs/") || /^SPEC-\d+\.md$/i.test(basename)) {
      addUniquePath(specificationArtifacts, { path: file, kind: "specification_file", confidence: "detected" });
    }
    if (file.startsWith("schemas/") || /\.schema\.json$/i.test(file)) {
      addUniquePath(schemaArtifacts, { path: file, kind: "schema_file", confidence: "detected" });
    }
    if (file.startsWith("src/")) {
      addUniquePath(sourceArtifacts, { path: file, kind: "source_file", confidence: "detected" });
    }
    if (/test/i.test(file) || /^tests?\//i.test(file)) {
      addUniquePath(testArtifacts, { path: file, kind: "test_candidate", confidence: "candidate" });
    }
    if (/^(package\.json|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|build\.gradle|requirements\.txt|tsconfig\.json)$/i.test(basename)) {
      addUniquePath(packageAndBuildFiles, { path: file, kind: "package_or_build_file", confidence: "detected" });
    }
  }

  return {
    documentationArtifacts,
    specificationArtifacts,
    schemaArtifacts,
    sourceArtifacts,
    testArtifacts,
    packageAndBuildFiles
  };
}

async function readPackageJson(root, relativePath, maxReadableFileSizeBytes, warnings) {
  const absolutePath = path.join(root, relativePath);
  try {
    const fileStat = await stat(absolutePath);
    if (fileStat.size > maxReadableFileSizeBytes) {
      warnings.push(makeMessage("manifest_too_large", "package.json was not read because it exceeds the safe size limit.", relativePath));
      return [];
    }
    const parsed = JSON.parse(await readFile(absolutePath, "utf8"));
    return Object.keys(parsed.scripts ?? {}).map((scriptName) => ({
      entryType: "package_script",
      path: relativePath,
      description: `Candidate package.json script: ${scriptName}`,
      executed: false
    }));
  } catch (error) {
    warnings.push(makeMessage("manifest_read_warning", `package.json metadata could not be read: ${error.message}`, relativePath));
    return [];
  }
}

async function collectValidationEntryPoints(root, files, options, warnings) {
  const entries = [];
  for (const file of files) {
    const basename = path.posix.basename(file);
    if (file === "package.json") {
      entries.push(...await readPackageJson(root, file, options.maxReadableFileSizeBytes, warnings));
    }
    if (/validate|validation/i.test(file)) {
      entries.push({ entryType: "validation_script_candidate", path: file, description: "Candidate validation entry point by filename.", executed: false });
    }
    if (/test/i.test(file)) {
      entries.push({ entryType: "test_candidate", path: file, description: "Candidate test entry point by filename.", executed: false });
    }
    if (/^(pyproject\.toml|pytest\.ini|Cargo\.toml|go\.mod|pom\.xml|build\.gradle)$/i.test(basename)) {
      entries.push({ entryType: "tool_manifest", path: file, description: "Candidate validation or test tool manifest.", executed: false });
    }
    if (file.startsWith(".github/workflows/")) {
      entries.push({ entryType: "ci_workflow", path: file, description: "Candidate CI workflow file.", executed: false });
    }
  }
  return entries;
}

function collectSignals(files) {
  const architectureSignals = [];
  const ownershipSignals = [];
  const integrationSignals = [];

  for (const file of files) {
    const basename = path.posix.basename(file);
    if (/architecture/i.test(basename)) {
      architectureSignals.push({ signalType: "architecture_document", path: file, observation: "Architecture-related document detected by filename." });
    }
    if (/constitution|contract|identity|ownership|responsibility/i.test(basename)) {
      ownershipSignals.push({ signalType: "ownership_document", path: file, observation: "Ownership or authority signal detected by filename." });
    }
    if (/integration/i.test(file) || /KAVEEP-(CORE|POLICY|SIA|RO|COMMAND-CENTER)/i.test(file)) {
      integrationSignals.push({ signalType: "integration_document", path: file, observation: "Integration signal detected by path or filename." });
    }
  }

  return { architectureSignals, ownershipSignals, integrationSignals };
}

function extensionCounts(files) {
  const counts = new Map();
  for (const file of files) {
    const extension = path.posix.extname(file) || "[none]";
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([extension, count]) => ({ extension, count }));
}

async function traverse(root, options, warnings) {
  const directories = [];
  const files = [];
  const ignoredPaths = [];
  const queue = [{ absolutePath: root, relativePath: "", depth: 0 }];
  let fileTruncated = false;
  let directoryTruncated = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth > options.maxDepth) {
      warnings.push(makeMessage("max_depth_reached", "Traversal depth limit reached.", current.relativePath));
      directoryTruncated = true;
      continue;
    }

    let entries;
    try {
      entries = await readdir(current.absolutePath, { withFileTypes: true });
    } catch (error) {
      warnings.push(makeMessage("directory_read_warning", `Directory could not be read: ${error.message}`, current.relativePath));
      continue;
    }

    for (const entry of entries) {
      const absoluteChild = path.join(current.absolutePath, entry.name);
      if (!isInsideRoot(root, absoluteChild)) {
        warnings.push(makeMessage("path_escape_blocked", "A candidate path escaped the approved root and was skipped.", normalizeRelative(path.relative(root, absoluteChild))));
        continue;
      }
      const relativeChild = normalizeRelative(path.relative(root, absoluteChild));

      if (isIgnoredName(entry.name)) {
        ignoredPaths.push({ path: relativeChild, reason: "Ignored by default dependency, generated, cache, VCS, virtual environment, or temporary path policy." });
        continue;
      }

      let childStat;
      try {
        childStat = await lstat(absoluteChild);
      } catch (error) {
        warnings.push(makeMessage("path_stat_warning", `Path metadata could not be read: ${error.message}`, relativeChild));
        continue;
      }

      if (childStat.isSymbolicLink()) {
        try {
          const target = await realpath(absoluteChild);
          warnings.push(makeMessage(
            isInsideRoot(root, target) ? "symlink_not_followed" : "external_symlink_not_followed",
            "Symbolic link was not followed by Repository Intelligence.",
            relativeChild
          ));
        } catch {
          warnings.push(makeMessage("symlink_not_followed", "Symbolic link target could not be resolved and was not followed.", relativeChild));
        }
        continue;
      }

      if (childStat.isDirectory()) {
        if (directories.length >= options.maxDirectories) {
          warnings.push(makeMessage("max_directories_reached", "Directory traversal limit reached.", relativeChild));
          directoryTruncated = true;
          continue;
        }
        directories.push(relativeChild);
        queue.push({ absolutePath: absoluteChild, relativePath: relativeChild, depth: current.depth + 1 });
        continue;
      }

      if (childStat.isFile()) {
        if (files.length >= options.maxFiles) {
          warnings.push(makeMessage("max_files_reached", "File traversal limit reached.", relativeChild));
          fileTruncated = true;
          continue;
        }
        files.push(relativeChild);
        if (isSensitivePath(relativeChild)) {
          warnings.push(makeMessage("sensitive_artifact_detected", "Sensitive-looking artifact was detected; contents were not read.", relativeChild));
        }
      }
    }
  }

  return { directories, files, ignoredPaths, fileTruncated, directoryTruncated };
}

export async function inspectRepository(repositoryRootInput, options = {}) {
  const safeOptions = normalizeOptions(options);
  if (!repositoryRootInput || !String(repositoryRootInput).trim()) {
    return blockedReport(repositoryRootInput, new Error("Explicit repository root is required."));
  }

  let canonicalRoot;
  try {
    const resolvedRoot = path.resolve(String(repositoryRootInput));
    const rootStat = await lstat(resolvedRoot);
    if (!rootStat.isDirectory()) {
      return blockedReport(repositoryRootInput, new Error("Approved repository root must be a directory."));
    }
    canonicalRoot = await realpath(resolvedRoot);
    if (!isInsideRoot(canonicalRoot, canonicalRoot)) {
      return blockedReport(repositoryRootInput, new Error("Approved repository root could not establish a safe boundary."));
    }
  } catch (error) {
    return blockedReport(repositoryRootInput, error);
  }

  const warnings = [];
  const startedAt = now();
  const repositoryName = path.basename(canonicalRoot);
  const traversal = await traverse(canonicalRoot, safeOptions, warnings);
  const artifacts = collectArtifacts(traversal.files);
  const pathGroups = collectPathGroups(traversal.files, traversal.directories);
  const validationEntryPoints = await collectValidationEntryPoints(canonicalRoot, traversal.files, safeOptions, warnings);
  const signals = collectSignals(traversal.files);
  const technologyIndicators = collectTechnologyIndicators(traversal.files);
  const relevantFiles = [
    ...new Set([
      ...artifacts.map((artifact) => artifact.path),
      ...validationEntryPoints.map((entry) => entry.path)
    ])
  ].slice(0, safeOptions.maxRelevantFiles);

  if (relevantFiles.length >= safeOptions.maxRelevantFiles && artifacts.length + validationEntryPoints.length > relevantFiles.length) {
    warnings.push(makeMessage("max_relevant_files_reached", "Relevant file list was truncated by configured bound."));
  }

  const status = warnings.length > 0 || traversal.fileTruncated || traversal.directoryTruncated
    ? "completed_with_warnings"
    : "completed";

  return {
    intelligenceId: `repo_intel_${safeIdSegment(repositoryName)}_001`,
    schemaVersion: "1.0.0",
    repositoryRef: repositoryName,
    repositoryRoot: canonicalRoot,
    repositoryName,
    inspectionScope: {
      approvedRootRequired: true,
      readOnly: true,
      maxDepth: safeOptions.maxDepth,
      maxFiles: safeOptions.maxFiles,
      maxDirectories: safeOptions.maxDirectories,
      maxReadableFileSizeBytes: safeOptions.maxReadableFileSizeBytes,
      maxRelevantFiles: safeOptions.maxRelevantFiles,
      symlinkPolicy: "do_not_follow",
      ignoredPathPolicy: "Ignore dependency, generated, cache, VCS, virtual environment, and temporary paths."
    },
    status,
    startedAt,
    completedAt: now(),
    summary: `Observed ${traversal.files.length} files and ${traversal.directories.length} directories within the approved root without executing repository code.`,
    directorySummary: {
      totalDirectoriesObserved: traversal.directories.length,
      directories: traversal.directories.slice(0, safeOptions.maxRelevantFiles),
      truncated: traversal.directoryTruncated
    },
    fileSummary: {
      totalFilesObserved: traversal.files.length,
      files: traversal.files.slice(0, safeOptions.maxRelevantFiles),
      extensions: extensionCounts(traversal.files),
      truncated: traversal.fileTruncated
    },
    detectedArtifacts: artifacts,
    technologyIndicators,
    documentationArtifacts: pathGroups.documentationArtifacts,
    specificationArtifacts: pathGroups.specificationArtifacts,
    schemaArtifacts: pathGroups.schemaArtifacts,
    sourceArtifacts: pathGroups.sourceArtifacts,
    testArtifacts: pathGroups.testArtifacts,
    validationEntryPoints,
    packageAndBuildFiles: pathGroups.packageAndBuildFiles,
    architectureSignals: signals.architectureSignals,
    ownershipSignals: signals.ownershipSignals,
    integrationSignals: signals.integrationSignals,
    relevantFiles,
    ignoredPaths: traversal.ignoredPaths,
    warnings,
    errors: [],
    limitations: [
      "Repository Intelligence is deterministic and path-based.",
      "No repository code was executed.",
      "No ignored paths were recursively inspected.",
      "Presence of an artifact is not proof of correctness, compliance, or security.",
      "KAVEEP-RO remains authoritative for repository assessment."
    ],
    recommendedNextAction: status === "completed" || status === "completed_with_warnings"
      ? "send_to_planning"
      : "gather_more_evidence"
  };
}

export async function resolveReadOnlyPath(approvedRootInput, requestedPath) {
  if (!approvedRootInput || !String(approvedRootInput).trim()) {
    throw new Error("Explicit approved root is required.");
  }
  if (!requestedPath || !String(requestedPath).trim()) {
    throw new Error("Explicit path is required.");
  }

  const canonicalRoot = await realpath(path.resolve(String(approvedRootInput)));
  const candidate = path.resolve(canonicalRoot, String(requestedPath));
  if (!isInsideRoot(canonicalRoot, candidate)) {
    throw new Error("Requested path escapes the approved root.");
  }

  const entry = await lstat(candidate);
  if (entry.isSymbolicLink()) {
    throw new Error("Symbolic links are not allowed for read-only tool access.");
  }
  const canonicalPath = await realpath(candidate);
  if (!isInsideRoot(canonicalRoot, canonicalPath)) {
    throw new Error("Resolved path escapes the approved root.");
  }

  const relativePath = normalizeRelative(path.relative(canonicalRoot, canonicalPath));
  if (!relativePath || relativePath === ".") {
    return { canonicalRoot, canonicalPath, relativePath: ".", entry, sensitive: false, ignored: false };
  }
  return {
    canonicalRoot,
    canonicalPath,
    relativePath,
    entry,
    sensitive: isSensitivePath(relativePath),
    ignored: relativePath.split("/").some(isIgnoredName)
  };
}

export { defaultOptions, isIgnoredName, isSensitivePath, isInsideRoot, normalizeRelative };
