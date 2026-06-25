import { parseEnvKeys, diffEnv } from '../commands/env';

const EXAMPLE = `# app config
NODE_ENV=development
PORT=3000
DATABASE_URL="mysql://u:p@localhost:3306/db"

export JWT_SECRET=changeme
# commented out: REDIS_URL=redis://localhost
`;

describe('env', () => {
  it('parses keys, ignoring comments / blanks / export prefix', () => {
    const keys = parseEnvKeys(EXAMPLE);
    expect([...keys]).toEqual(['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET']);
  });

  it('diffs example vs actual and returns missing keys', () => {
    const actual = `NODE_ENV=development
PORT=3000
`;
    expect(diffEnv(EXAMPLE, actual)).toEqual(['DATABASE_URL', 'JWT_SECRET']);
  });

  it('returns no missing when actual is a superset', () => {
    expect(diffEnv('A=1\nB=2', 'A=1\nB=2\nC=3')).toEqual([]);
  });
});
