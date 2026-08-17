import { Injectable } from "@nestjs/common";
import { RepositoryGitCommandService } from "./repository-git-command.service";
import { RepositoryGitExecutorService } from "./repository-git-executor.service";
import { createRepositoryGitWorkspace } from "./repository-git-workspace.utils";
import type { RepositoryCredentialMaterial } from "./repository-analysis.types";
import { validateRepositoryBranch } from "./repository-analysis-validation.utils";

export type RepositorySourceInspection = {
  exactCommit: string;
  defaultHead: string;
  baselineCommit: string;
  mergeBase: string;
  ahead: number;
  behind: number;
  mergeTreeClean: boolean;
  changedPaths: string[];
  commitAuthorEmail: string;
};

@Injectable()
export class RepositoryGitInspectionService {
  constructor(
    private readonly executor: RepositoryGitExecutorService,
    private readonly command: RepositoryGitCommandService,
  ) {}

  async inspect(input: {
    repositoryUrl: string;
    branch: string;
    exactCommit: string;
    baselineCommit: string;
    credential: RepositoryCredentialMaterial;
    signal?: AbortSignal;
  }): Promise<RepositorySourceInspection> {
    await this.executor.assertRepositorySourceAllowed(input.repositoryUrl);
    const workspace = await createRepositoryGitWorkspace();
    const run = (args: string[]) =>
      this.command.run(args, input.credential, workspace.root, input.signal);
    try {
      await run(["init", "--quiet"]);
      await run(["remote", "add", "origin", input.repositoryUrl]);
      await run([
        "fetch", "--quiet", "--no-tags", "origin",
        `refs/heads/${validateRepositoryBranch(input.branch)}`,
      ]);
      const defaultHead = (await run(["rev-parse", "FETCH_HEAD"])).stdout.trim();
      if (defaultHead.toLowerCase() !== input.exactCommit.toLowerCase()) {
        throw new Error("repository_default_head_moved");
      }
      await run(["fetch", "--quiet", "--no-tags", "origin", input.baselineCommit]);
      const mergeBase = (
        await run(["merge-base", input.baselineCommit, input.exactCommit])
      ).stdout.trim();
      const counts = (
        await run([
          "rev-list", "--left-right", "--count",
          `${input.baselineCommit}...${input.exactCommit}`,
        ])
      ).stdout.trim().split(/\s+/).map(Number);
      const changedPaths = (
        await run(["diff", "--name-only", input.baselineCommit, input.exactCommit, "--"])
      ).stdout.split(/\r?\n/).filter(Boolean).sort();
      const commitAuthorEmail = (
        await run(["show", "-s", "--format=%ae", input.exactCommit])
      ).stdout.trim().toLowerCase();
      let mergeTreeClean = true;
      try {
        await run(["merge-tree", "--write-tree", input.baselineCommit, input.exactCommit]);
      } catch {
        mergeTreeClean = false;
      }
      return {
        exactCommit: input.exactCommit.toLowerCase(),
        defaultHead: defaultHead.toLowerCase(),
        baselineCommit: input.baselineCommit.toLowerCase(),
        mergeBase: mergeBase.toLowerCase(),
        behind: counts[0] ?? 0,
        ahead: counts[1] ?? 0,
        mergeTreeClean,
        changedPaths,
        commitAuthorEmail,
      };
    } finally {
      await workspace.cleanup();
    }
  }
}
