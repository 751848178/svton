import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { RepositoryGitCommandService } from "./repository-git-command.service";
import { RepositoryGitExecutorService } from "./repository-git-executor.service";
import { RepositoryGitInspectionService } from "./repository-git-inspection.service";

const execute = promisify(execFile);

describe("RepositoryGitInspectionService", () => {
  let scope: string;
  let repository: string;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "repository-git-inspection-"));
    repository = join(scope, "repository");
    await mkdir(repository);
    await git(["init", "-q", "-b", "main", repository]);
    await git(["-C", repository, "config", "user.email", "fixture@example.test"]);
    await git(["-C", repository, "config", "user.name", "Fixture"]);
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("computes real merge-base, ahead/behind, merge-tree and baseline diff", async () => {
    await writeFile(join(repository, "README.md"), "baseline\n");
    await git(["-C", repository, "add", "README.md"]);
    await git(["-C", repository, "commit", "-q", "-m", "baseline"]);
    const baseline = await sha();
    await mkdir(join(repository, "infra"));
    await writeFile(join(repository, "infra/deploy.yml"), "version: 1\n");
    await git(["-C", repository, "add", "infra/deploy.yml"]);
    await git(["-C", repository, "commit", "-q", "-m", "head"]);
    const head = await sha();
    const config = new ConfigService({
      REPOSITORY_ANALYSIS_LOCAL_ROOTS: scope,
      REPOSITORY_ANALYSIS_GIT_TIMEOUT_MS: 10_000,
    });
    const command = new RepositoryGitCommandService(config);
    const executor = new RepositoryGitExecutorService(config, command);
    const service = new RepositoryGitInspectionService(executor, command);
    await expect(service.inspect({
      repositoryUrl: repository,
      branch: "main",
      exactCommit: head,
      baselineCommit: baseline,
      credential: { kind: "none", source: "none", label: "公开仓库" },
    })).resolves.toMatchObject({
      exactCommit: head,
      defaultHead: head,
      baselineCommit: baseline,
      mergeBase: baseline,
      ahead: 1,
      behind: 0,
      mergeTreeClean: true,
      changedPaths: ["infra/deploy.yml"],
    });
  });

  function sha() {
    return git(["-C", repository, "rev-parse", "HEAD"]).then(
      (result) => result.stdout.trim(),
    );
  }
});

function git(args: string[]) {
  return execute("git", args);
}
