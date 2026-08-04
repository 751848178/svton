export const releaseBuildInclude = {
  manifest: { include: { items: { orderBy: { componentKey: "asc" as const } } } },
  repositoryIdentity: { select: { provider: true, canonicalUrl: true } },
  repositoryIdentityRevision: {
    select: { id: true, revision: true, defaultBranch: true },
  },
} as const;
