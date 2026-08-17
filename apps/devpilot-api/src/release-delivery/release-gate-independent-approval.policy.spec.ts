import { independentApprovalBlocker } from "./release-gate-independent-approval.policy";

describe("independentApprovalBlocker", () => {
  const subjects = {
    requesterActorId: "requester-1",
    buildActorId: "executor-1",
    commitAuthorUserId: "author-1",
    confirmerActorId: "reviewer-1",
  };

  it("allows a distinct second actor", () => {
    expect(independentApprovalBlocker(subjects)).toBeNull();
  });

  it.each([
    ["requester-1", "requester_self_approval_forbidden"],
    ["executor-1", "build_actor_self_approval_forbidden"],
    ["author-1", "commit_author_self_approval_forbidden"],
  ])("rejects self approval by %s", (confirmerActorId, reason) => {
    expect(independentApprovalBlocker({ ...subjects, confirmerActorId })).toBe(reason);
  });

  it("fails closed when the commit author subject is unmapped", () => {
    expect(independentApprovalBlocker({
      ...subjects,
      commitAuthorUserId: null,
    })).toBe("independent_approval_subject_unmapped");
  });
});
