export type IndependentApprovalSubjects = {
  requesterActorId: string | null;
  buildActorId: string | null;
  commitAuthorUserId: string | null;
  confirmerActorId: string;
};

export function independentApprovalBlocker(
  subjects: IndependentApprovalSubjects,
) {
  if (!subjects.requesterActorId || !subjects.commitAuthorUserId) {
    return "independent_approval_subject_unmapped";
  }
  if (subjects.confirmerActorId === subjects.requesterActorId) {
    return "requester_self_approval_forbidden";
  }
  if (
    subjects.buildActorId &&
    subjects.confirmerActorId === subjects.buildActorId
  ) {
    return "build_actor_self_approval_forbidden";
  }
  if (subjects.confirmerActorId === subjects.commitAuthorUserId) {
    return "commit_author_self_approval_forbidden";
  }
  return null;
}
