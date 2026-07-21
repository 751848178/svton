import * as bcrypt from 'bcrypt';
import { AdminBootstrapService } from './admin-bootstrap.service';

jest.mock('bcrypt', () => ({
  __esModule: true,
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const EMAIL = 'admin@devpilot.local';
const PASSWORD = 'DemoPass123!';

function makeConfig(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as never;
}

function makePrisma(existing: { role: string } | null) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
  } as never;
}

// Attach jest spies onto the service's private Logger instance so assertions
// can target the exact messages emitted by each branch.
function spyOnLogger(service: AdminBootstrapService) {
  const logger = (service as unknown as {
    logger: { error: jest.Mock; log: jest.Mock; debug: jest.Mock };
  }).logger;
  return {
    error: jest.spyOn(logger, 'error').mockImplementation(() => undefined),
    log: jest.spyOn(logger, 'log').mockImplementation(() => undefined),
    debug: jest.spyOn(logger, 'debug').mockImplementation(() => undefined),
  };
}

beforeEach(() => {
  (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
});

describe('AdminBootstrapService', () => {
  it('is a silent no-op when both env vars are unset', async () => {
    const config = makeConfig({});
    const prisma = makePrisma(null);
    const service = new AdminBootstrapService(prisma, config);
    const spies = spyOnLogger(service);

    await service.onModuleInit();

    expect((prisma as { user: { findUnique: jest.Mock } }).user.findUnique).not.toHaveBeenCalled();
    expect((prisma as { user: { create: jest.Mock } }).user.create).not.toHaveBeenCalled();
    expect((prisma as { user: { update: jest.Mock } }).user.update).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(spies.debug).toHaveBeenCalled();
  });

  it('creates an admin when env is set and the email is free', async () => {
    const config = makeConfig({
      DEVPILOT_BOOTSTRAP_ADMIN_EMAIL: EMAIL,
      DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD: PASSWORD,
    });
    const prisma = makePrisma(null);
    const service = new AdminBootstrapService(prisma, config);
    const spies = spyOnLogger(service);

    await service.onModuleInit();

    const createArgs = (prisma as { user: { create: jest.Mock } }).user.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      email: EMAIL,
      passwordHash: 'hashed-password',
      role: 'admin',
      name: 'System Administrator',
    });
    expect((prisma as { user: { update: jest.Mock } }).user.update).not.toHaveBeenCalled();
    expect(spies.log).toHaveBeenCalledWith(`Created bootstrap admin: ${EMAIL}`);
  });

  it('refreshes only the password hash when the email is already admin', async () => {
    const config = makeConfig({
      DEVPILOT_BOOTSTRAP_ADMIN_EMAIL: EMAIL,
      DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD: PASSWORD,
    });
    const prisma = makePrisma({ role: 'admin' });
    const service = new AdminBootstrapService(prisma, config);
    const spies = spyOnLogger(service);

    await service.onModuleInit();

    const updateArgs = (prisma as { user: { update: jest.Mock } }).user.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ email: EMAIL });
    expect(updateArgs.data).toEqual({ passwordHash: 'hashed-password' });
    // Role must NOT be re-written on refresh.
    expect(updateArgs.data).not.toHaveProperty('role');
    expect((prisma as { user: { create: jest.Mock } }).user.create).not.toHaveBeenCalled();
    expect(spies.log).toHaveBeenCalledWith(`Refreshed bootstrap admin password: ${EMAIL}`);
  });

  it('refuses to bootstrap when the email is owned by a non-admin user', async () => {
    const config = makeConfig({
      DEVPILOT_BOOTSTRAP_ADMIN_EMAIL: EMAIL,
      DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD: PASSWORD,
    });
    const prisma = makePrisma({ role: 'user' });
    const service = new AdminBootstrapService(prisma, config);
    const spies = spyOnLogger(service);

    await service.onModuleInit();

    expect((prisma as { user: { create: jest.Mock } }).user.create).not.toHaveBeenCalled();
    expect((prisma as { user: { update: jest.Mock } }).user.update).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalled();
    const [msg] = spies.error.mock.calls.at(-1)!;
    expect(msg).toContain(EMAIL);
    expect(msg).toMatch(/already in use by a non-admin/i);
    expect(msg).toContain('role=user');
  });
});
