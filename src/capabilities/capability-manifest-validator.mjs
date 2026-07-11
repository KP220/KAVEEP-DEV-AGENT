import {
  lstat,
  readFile,
  realpath
} from "node:fs/promises";


STEP 2 — Find this function:

function resolveInsideRepository(repoRoot, repositoryPath) {

Delete from that function through the end of:

async function readTextFile(repoRoot, repositoryPath) {

Then paste this entire replacement block:


function assertLexicalRepositoryContainment(
  repoRoot,
  repositoryPath
) {
  if (!isRepositoryRelativePath(repositoryPath)) {
    throw new Error(
      `Unsafe repository-relative path: ${repositoryPath}`
    );
  }

  const absoluteRoot = path.resolve(repoRoot);
  const absolutePath = path.resolve(
    absoluteRoot,
    repositoryPath
  );

  const relative = path.relative(
    absoluteRoot,
    absolutePath
  );

  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Path escapes repository root: ${repositoryPath}`
    );
  }

  return {
    absoluteRoot,
    absolutePath,
    relative
  };
}

function assertRealRepositoryContainment(
  realRoot,
  realTarget,
  repositoryPath
) {
  const relative = path.relative(
    realRoot,
    realTarget
  );

  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Resolved path escapes repository root: ${repositoryPath}`
    );
  }
}

async function assertNoSymbolicLinkSegments({
  absoluteRoot,
  relative,
  repositoryPath
}) {
  const segments = relative.split(path.sep);

  let currentPath = absoluteRoot;

  for (const segment of segments) {
    currentPath = path.join(
      currentPath,
      segment
    );

    const stat = await lstat(currentPath);

    if (stat.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are prohibited in repository evidence paths: ${repositoryPath}`
      );
    }
  }
}

async function resolveVerifiedRepositoryFile(
  repoRoot,
  repositoryPath
) {
  const {
    absoluteRoot,
    absolutePath,
    relative
  } = assertLexicalRepositoryContainment(
    repoRoot,
    repositoryPath
  );

  const realRoot = await realpath(
    absoluteRoot
  );

  const realTarget = await realpath(
    absolutePath
  );

  assertRealRepositoryContainment(
    realRoot,
    realTarget,
    repositoryPath
  );

  await assertNoSymbolicLinkSegments({
    absoluteRoot,
    relative,
    repositoryPath
  });

  const stat = await lstat(
    absolutePath
  );

  if (!stat.isFile()) {
    throw new Error(
      `Repository path is not a regular file: ${repositoryPath}`
    );
  }

  return absolutePath;
}

async function inspectRepositoryPath(
  repoRoot,
  repositoryPath
) {
  try {
    await resolveVerifiedRepositoryFile(
      repoRoot,
      repositoryPath
    );

    return {
      status: "PRESENT",
      reason: null
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        status: "MISSING",
        reason: "missing"
      };
    }

    const message =
      error instanceof Error
        ? error.message
        : "inspection_failed";

    if (
      /symbolic links? are prohibited/iu.test(
        message
      )
    ) {
      return {
        status: "MISMATCHED",
        reason: "symbolic_link"
      };
    }

    if (
      /resolved path escapes repository root/iu.test(
        message
      )
    ) {
      return {
        status: "MISMATCHED",
        reason: "resolved_path_escape"
      };
    }

    if (
      /not a regular file/iu.test(
        message
      )
    ) {
      return {
        status: "MISMATCHED",
        reason: "not_a_file"
      };
    }

    return {
      status: "MISMATCHED",
      reason: message
    };
  }
}

async function readJsonFile(
  repoRoot,
  repositoryPath
) {
  const absolutePath =
    await resolveVerifiedRepositoryFile(
      repoRoot,
      repositoryPath
    );

  const source = await readFile(
    absolutePath,
    "utf8"
  );

  return JSON.parse(source);
}

async function readTextFile(
  repoRoot,
  repositoryPath
) {
  const absolutePath =
    await resolveVerifiedRepositoryFile(
      repoRoot,
      repositoryPath
    );

  return readFile(
    absolutePath,
    "utf8"
  );
}


Do not change anything after:

function validateTopLevelShape(manifest, errors) {


COMMIT MESSAGE:

Harden capability evidence path containment
