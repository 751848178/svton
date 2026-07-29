import { ServerExecutorReadQueryService } from './server-executor-read-query.service';

describe('ServerExecutorReadQueryService', () => {
  it('queries an exact job id within the current team', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ServerExecutorReadQueryService(
      { serverExecutionJob: { findMany } } as never,
      jest.fn(),
    );

    await service.listJobs('team-1', { jobId: 'job-1' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: 'team-1', id: 'job-1' },
    }));
  });
});
