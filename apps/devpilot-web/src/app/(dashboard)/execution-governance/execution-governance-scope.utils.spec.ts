import {
  buildExecutionJobParams,
  buildExecutionJobScopeKey,
  readExecutionGovernanceScope,
} from './execution-governance-scope.utils';

describe('execution governance scope', () => {
  it('threads jobId through the exact API query and cache key', () => {
    const scope = readExecutionGovernanceScope(new URLSearchParams('jobId=job-1'));

    expect(buildExecutionJobParams('all', scope)).toEqual({ jobId: 'job-1' });
    expect(buildExecutionJobScopeKey(scope)).toContain('focusedJobId:job-1');
  });
});
