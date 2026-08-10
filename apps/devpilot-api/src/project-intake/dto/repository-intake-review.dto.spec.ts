import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReviewRepositoryIntakeContractDto } from './repository-intake-review.dto';

describe('ReviewRepositoryIntakeContractDto', () => {
  async function errors(overrides: Record<string, unknown>) {
    const value = plainToInstance(ReviewRepositoryIntakeContractDto, {
      items: [{ suggestionId: 'component-1', decision: 'edit', overrides }],
    });
    return validate(value, { whitelist: true, forbidNonWhitelisted: true });
  }

  it.each([
    { path: '../escape' },
    { path: '/absolute/path' },
    { type: 'database_admin' },
    { runMethod: 'shell' },
    { buildOutput: 'arbitrary-file' },
    { unknownServerId: 'forged' },
  ])('rejects invalid or unknown edit input %#', async (overrides) => {
    expect(await errors(overrides)).not.toHaveLength(0);
  });

  it('accepts bounded field-scoped component edits', async () => {
    expect(await errors({ path: 'apps/api', runMethod: 'container' })).toHaveLength(0);
  });
});
