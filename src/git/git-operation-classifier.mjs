const CLASSIFICATIONS = Object.freeze({
  READ_ONLY: "READ_ONLY",
  WRITE_OPERATION: "WRITE_OPERATION",
  CONDITIONAL: "CONDITIONAL",
  UNSUPPORTED: "UNSUPPORTED",
  BLOCKED: "BLOCKED"
});

const WRITE_COMMANDS = new Set([
  "add",
  "commit",
  "push",
  "pull",
  "merge",
  "rebase",
  "reset",
  "checkout",
  "switch",
  "restore",
  "cherry-pick",
  "revert",
  "tag",
  "stash",
  "clean",
  "rm",
  "mv",
  "init",
  "clone",
  "fetch",
  "remote",
  "config",
  "submodule",
  "worktree",
  "notes",
  "replace",
  "update-ref",
  "symbolic-ref",
  "gc",
  "prune",
  "repack",
  "maintenance",
  "bisect",
  "am",
  "apply"
]);

const GLOBAL_BLOCKED_OPTIONS = new Set([
  "-c",
  "--config-env",
  "--exec-path",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--bare"
]);

const SAFE_REVISION = /^(?:HEAD|[A-Za-z0-9][A-Za-z0-9._/@{}^~:+-]{0,199})$/;
const SAFE_RANGE = /^(?:HEAD|[A-Za-z0-9][A-Za-z0-9._/@{}^~:+-]{0,199})(?:\.\.\.?)(?:HEAD|[A-Za-z0-9][A-Za-z0-9._/@{}^~:+-]{0,199})$/;
const SAFE_TEXT = /^[^\0\r\n]{1,200}$/;
const SAFE_INTEGER = /^(?:0|[1-9][0-9]{0,4})$/;

function blocked(command, arguments_, reason) {
  return Object.freeze({
    classification: CLASSIFICATIONS.BLOCKED,
    command,
    normalizedArguments: Object.freeze([...arguments_]),
    networkAllowed: false,
    shellAllowed: false,
    writeAuthorityGranted: false,
    reason,
    limitations: Object.freeze([
      "The operation was not executed.",
      "Classification is fail-closed."
    ])
  });
}

function readOnly(command, arguments_, reason) {
  return Object.freeze({
    classification: CLASSIFICATIONS.READ_ONLY,
    command,
    normalizedArguments: Object.freeze([...arguments_]),
    networkAllowed: false,
    shellAllowed: false,
    writeAuthorityGranted: false,
    reason,
    limitations: Object.freeze([
      "Classification applies only to this canonical command and normalized argument list.",
      "Execution requires a separately controlled read-only Git runner.",
      "Read-only classification grants no source-write or Git-write authority."
    ])
  });
}

function writeOperation(command, arguments_, reason) {
  return Object.freeze({
    classification: CLASSIFICATIONS.WRITE_OPERATION,
    command,
    normalizedArguments: Object.freeze([...arguments_]),
    networkAllowed: false,
    shellAllowed: false,
    writeAuthorityGranted: false,
    reason,
    limitations: Object.freeze([
      "SPEC-036 does not authorize execution of Git write operations."
    ])
  });
}

function normalizeInput(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return { error: "Git classification request must be an object." };
  }

  if (typeof request.command !== "string") {
    return { error: "Git command must be a string." };
  }

  const command = request.command.trim();

  if (!/^[a-z][a-z0-9-]{0,63}$/.test(command)) {
    return {
      command,
      arguments: [],
      error: "Only canonical lowercase Git subcommand names are accepted."
    };
  }

  if (!Array.isArray(request.arguments)) {
    return {
      command,
      arguments: [],
      error: "Git arguments must be an array."
    };
  }

  if (request.arguments.length > 64) {
    return {
      command,
      arguments: [],
      error: "Git argument count exceeds the bounded limit."
    };
  }

  const arguments_ = [];

  for (const value of request.arguments) {
    if (typeof value !== "string") {
      return {
        command,
        arguments: arguments_,
        error: "Every Git argument must be a string."
      };
    }

    if (
      value.length === 0 ||
      value.length > 300 ||
      value.includes("\0") ||
      value.includes("\r") ||
      value.includes("\n")
    ) {
      return {
        command,
        arguments: arguments_,
        error: "Git argument is empty, oversized, or contains a control character."
      };
    }

    arguments_.push(value);
  }

  return { command, arguments: arguments_ };
}

function containsBlockedGlobalMechanism(arguments_) {
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    for (const blockedOption of GLOBAL_BLOCKED_OPTIONS) {
      if (
        argument === blockedOption ||
        argument.startsWith(`${blockedOption}=`) ||
        (blockedOption === "-c" && /^-c.+/.test(argument))
      ) {
        return argument;
      }
    }

    if (
      argument === "--no-pager" ||
      argument === "--paginate" ||
      argument === "-p"
    ) {
      return argument;
    }
  }

  return null;
}

function isSafeRevision(value) {
  return SAFE_REVISION.test(value) || SAFE_RANGE.test(value);
}

function parseBoundedOptionValue(argument, option) {
  if (argument === option) {
    return { inline: false, value: null };
  }

  if (argument.startsWith(`${option}=`)) {
    return { inline: true, value: argument.slice(option.length + 1) };
  }

  return null;
}

function classifyStatus(arguments_) {
  const exact = new Set([
    "--short",
    "--porcelain",
    "--porcelain=v1",
    "--porcelain=v2",
    "--branch",
    "--show-stash",
    "--untracked-files=no",
    "--untracked-files=normal",
    "--untracked-files=all",
    "--ignored=no",
    "--ignored=traditional",
    "--ignored=matching"
  ]);

  for (const argument of arguments_) {
    if (!exact.has(argument)) {
      return blocked("status", arguments_, `Unsupported git status argument: ${argument}`);
    }
  }

  return readOnly(
    "status",
    arguments_,
    "git status with an explicitly approved read-only argument set"
  );
}

function classifyDiff(arguments_) {
  const exact = new Set([
    "--check",
    "--stat",
    "--numstat",
    "--shortstat",
    "--summary",
    "--name-only",
    "--name-status",
    "--raw",
    "--patch",
    "--no-patch",
    "--cached",
    "--staged",
    "--color=never",
    "--no-color",
    "--relative",
    "--no-ext-diff",
    "--text",
    "--ignore-space-at-eol",
    "--ignore-all-space",
    "--ignore-space-change",
    "--ignore-blank-lines",
    "--exit-code",
    "--quiet"
  ]);

  let positionalCount = 0;
  let separatorSeen = false;

  for (const argument of arguments_) {
    if (argument === "--") {
      separatorSeen = true;
      continue;
    }

    if (separatorSeen) {
      if (
        argument.startsWith("/") ||
        argument.startsWith("\\") ||
        argument.includes("..") ||
        argument.includes("\0")
      ) {
        return blocked("diff", arguments_, `Unsafe path argument after --: ${argument}`);
      }
      continue;
    }

    if (argument.startsWith("-")) {
      if (!exact.has(argument)) {
        return blocked("diff", arguments_, `Unsupported git diff option: ${argument}`);
      }
      continue;
    }

    positionalCount += 1;

    if (positionalCount > 2 || !isSafeRevision(argument)) {
      return blocked("diff", arguments_, `Unsupported git diff revision argument: ${argument}`);
    }
  }

  return readOnly(
    "diff",
    arguments_,
    "git diff with explicitly approved local comparison arguments"
  );
}

function classifyLog(arguments_) {
  const exact = new Set([
    "--oneline",
    "--no-decorate",
    "--decorate=no",
    "--stat",
    "--shortstat",
    "--name-only",
    "--name-status",
    "--all"
  ]);

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    if (exact.has(argument)) {
      continue;
    }

    if (argument === "-n") {
      const value = arguments_[index + 1];
      if (!value || !SAFE_INTEGER.test(value) || Number(value) > 1000) {
        return blocked("log", arguments_, "git log -n requires a bounded integer from 0 to 1000.");
      }
      index += 1;
      continue;
    }

    if (/^-n[0-9]+$/.test(argument)) {
      const value = argument.slice(2);
      if (!SAFE_INTEGER.test(value) || Number(value) > 1000) {
        return blocked("log", arguments_, "git log -n value exceeds the bounded limit.");
      }
      continue;
    }

    const maxCount = parseBoundedOptionValue(argument, "--max-count");
    if (maxCount) {
      let value = maxCount.value;
      if (!maxCount.inline) {
        value = arguments_[index + 1];
        index += 1;
      }
      if (!value || !SAFE_INTEGER.test(value) || Number(value) > 1000) {
        return blocked("log", arguments_, "--max-count requires a bounded integer from 0 to 1000.");
      }
      continue;
    }

    const boundedOptions = [
      "--since",
      "--until",
      "--author",
      "--grep",
      "--format",
      "--pretty"
    ];

    let matched = false;

    for (const option of boundedOptions) {
      const parsed = parseBoundedOptionValue(argument, option);
      if (!parsed) {
        continue;
      }

      let value = parsed.value;
      if (!parsed.inline) {
        value = arguments_[index + 1];
        index += 1;
      }

      if (!value || !SAFE_TEXT.test(value)) {
        return blocked("log", arguments_, `${option} requires a bounded single-line value.`);
      }

      if (
        (option === "--format" || option === "--pretty") &&
        /%(?:x00|n|N)|[\r\n\0]/i.test(value)
      ) {
        return blocked("log", arguments_, `${option} contains a blocked formatting sequence.`);
      }

      matched = true;
      break;
    }

    if (matched) {
      continue;
    }

    if (!argument.startsWith("-") && isSafeRevision(argument)) {
      continue;
    }

    return blocked("log", arguments_, `Unsupported git log argument: ${argument}`);
  }

  return readOnly(
    "log",
    arguments_,
    "git log with explicitly approved bounded history-inspection arguments"
  );
}

function classifyShow(arguments_) {
  const exact = new Set([
    "--stat",
    "--shortstat",
    "--name-only",
    "--name-status",
    "--patch",
    "--no-patch",
    "--color=never",
    "--no-color",
    "--no-ext-diff"
  ]);

  let revisionCount = 0;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    if (exact.has(argument)) {
      continue;
    }

    const boundedOptions = ["--format", "--pretty"];
    let matched = false;

    for (const option of boundedOptions) {
      const parsed = parseBoundedOptionValue(argument, option);
      if (!parsed) {
        continue;
      }

      let value = parsed.value;
      if (!parsed.inline) {
        value = arguments_[index + 1];
        index += 1;
      }

      if (
        !value ||
        !SAFE_TEXT.test(value) ||
        /%(?:x00|n|N)|[\r\n\0]/i.test(value)
      ) {
        return blocked("show", arguments_, `${option} contains an unsafe or unbounded value.`);
      }

      matched = true;
      break;
    }

    if (matched) {
      continue;
    }

    if (!argument.startsWith("-") && isSafeRevision(argument)) {
      revisionCount += 1;
      if (revisionCount > 1) {
        return blocked("show", arguments_, "git show accepts at most one approved revision.");
      }
      continue;
    }

    return blocked("show", arguments_, `Unsupported git show argument: ${argument}`);
  }

  return readOnly(
    "show",
    arguments_,
    "git show with explicitly approved object-inspection arguments"
  );
}

function classifyBranch(arguments_) {
  if (arguments_.length === 0) {
    return blocked(
      "branch",
      arguments_,
      "Bare git branch is ambiguous; use an explicitly approved listing form."
    );
  }

  const exact = new Set([
    "--list",
    "-l",
    "--show-current",
    "--merged",
    "--no-merged"
  ]);

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    if (exact.has(argument)) {
      continue;
    }

    if (argument === "--contains") {
      const revision = arguments_[index + 1];
      if (!revision || !isSafeRevision(revision)) {
        return blocked("branch", arguments_, "--contains requires one approved revision.");
      }
      index += 1;
      continue;
    }

    return blocked(
      "branch",
      arguments_,
      `git branch argument may mutate refs or is unsupported: ${argument}`
    );
  }

  return readOnly(
    "branch",
    arguments_,
    "git branch with an explicitly approved listing-only signature"
  );
}

function classifyRevParse(arguments_) {
  const exactForms = [
    ["--show-toplevel"],
    ["--show-prefix"],
    ["--is-inside-work-tree"],
    ["--is-bare-repository"],
    ["HEAD"]
  ];

  if (
    exactForms.some(
      (form) =>
        form.length === arguments_.length &&
        form.every((value, index) => value === arguments_[index])
    )
  ) {
    return readOnly(
      "rev-parse",
      arguments_,
      "git rev-parse with an explicitly approved repository-inspection form"
    );
  }

  if (
    arguments_.length === 2 &&
    arguments_[0] === "--verify" &&
    isSafeRevision(arguments_[1])
  ) {
    return readOnly(
      "rev-parse",
      arguments_,
      "git rev-parse --verify with one bounded revision"
    );
  }

  return blocked("rev-parse", arguments_, "Unsupported git rev-parse signature.");
}

function classifyLsFiles(arguments_) {
  const exact = new Set([
    "--cached",
    "--modified",
    "--deleted",
    "--others",
    "--exclude-standard"
  ]);

  for (const argument of arguments_) {
    if (!exact.has(argument)) {
      return blocked("ls-files", arguments_, `Unsupported git ls-files argument: ${argument}`);
    }
  }

  return readOnly(
    "ls-files",
    arguments_,
    "git ls-files with an explicitly approved local index-inspection argument set"
  );
}

function classifyDiffIndex(arguments_) {
  const allowedLead = new Set(["--quiet", "--name-only", "--check"]);

  if (
    arguments_.length === 3 &&
    allowedLead.has(arguments_[0]) &&
    arguments_[1] === "HEAD" &&
    arguments_[2] === "--"
  ) {
    return readOnly(
      "diff-index",
      arguments_,
      "git diff-index with an explicitly approved HEAD comparison signature"
    );
  }

  return blocked("diff-index", arguments_, "Unsupported git diff-index signature.");
}

function classifyCatFile(arguments_) {
  const modes = new Set(["-t", "-s", "-e", "-p"]);

  if (
    arguments_.length === 2 &&
    modes.has(arguments_[0]) &&
    isSafeRevision(arguments_[1])
  ) {
    return readOnly(
      "cat-file",
      arguments_,
      "git cat-file with one approved bounded object-inspection mode"
    );
  }

  return blocked("cat-file", arguments_, "Unsupported git cat-file signature.");
}

const READ_ONLY_CLASSIFIERS = Object.freeze({
  status: classifyStatus,
  diff: classifyDiff,
  log: classifyLog,
  show: classifyShow,
  branch: classifyBranch,
  "rev-parse": classifyRevParse,
  "ls-files": classifyLsFiles,
  "diff-index": classifyDiffIndex,
  "cat-file": classifyCatFile
});

export function classifyGitOperation(request) {
  const normalized = normalizeInput(request);

  if (normalized.error) {
    return blocked(
      normalized.command ?? "",
      normalized.arguments ?? [],
      normalized.error
    );
  }

  const { command, arguments: arguments_ } = normalized;

  const blockedMechanism = containsBlockedGlobalMechanism(arguments_);
  if (blockedMechanism) {
    return blocked(
      command,
      arguments_,
      `Blocked global Git mechanism or execution override: ${blockedMechanism}`
    );
  }

  if (WRITE_COMMANDS.has(command)) {
    return writeOperation(
      command,
      arguments_,
      `git ${command} is classified as a write-capable or remote-capable operation`
    );
  }

  const classifier = READ_ONLY_CLASSIFIERS[command];

  if (!classifier) {
    return blocked(
      command,
      arguments_,
      "Unknown, aliased, or unsupported Git subcommand."
    );
  }

  return classifier(arguments_);
}

export const GIT_CLASSIFICATION_CAPABILITIES = Object.freeze({
  schemaVersion: "1.0.0",
  classifier: "deterministic",
  executableInvocationAccepted: false,
  shellStringsAccepted: false,
  userEnvironmentOverridesAccepted: false,
  aliasesAccepted: false,
  networkAllowed: false,
  writeAuthorityGranted: false,
  approvedReadOnlyCommands: Object.freeze(
    Object.keys(READ_ONLY_CLASSIFIERS).sort()
  ),
  writeCommandsBlockedFromExecution: Object.freeze(
    [...WRITE_COMMANDS].sort()
  ),
  classifications: CLASSIFICATIONS
});
