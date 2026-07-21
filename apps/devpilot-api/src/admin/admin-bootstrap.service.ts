import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_ROLE = 'admin';
const ADMIN_DISPLAY_NAME = 'System Administrator';
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Startup-only bootstrap that provisions a system-level admin (role='admin')
 * from env vars. Safe at every boot:
 *  - env unset → silent no-op (safe in prod where no bootstrap admin exists);
 *  - email free → create a new admin row;
 *  - email already admin → refresh the password hash only (idempotent
 *    re-bootstrap with rotated password);
 *  - email owned by a NON-admin → refuse and log an error (no silent
 *    privilege escalation on an existing row).
 *
 * Password is hashed with the same bcrypt cost as AuthService.register; the
 * plaintext is never logged.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>('DEVPILOT_BOOTSTRAP_ADMIN_EMAIL');
    const password = this.config.get<string>('DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.debug('Bootstrap admin env vars not set; skipping.');
      return;
    }

    try {
      await this.upsertAdmin(email, password);
    } catch (err) {
      // Swallow: bootstrap failure must not crash API startup. Non-admin
      // routes remain available; operator can fix env and restart.
      this.logger.error(`Admin bootstrap failed: ${(err as Error).message}`);
    }
  }

  private async upsertAdmin(email: string, password: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role: ADMIN_ROLE,
          name: ADMIN_DISPLAY_NAME,
        },
      });
      this.logger.log(`Created bootstrap admin: ${email}`);
      return;
    }

    if (existing.role !== ADMIN_ROLE) {
      // Refuse to silently promote a pre-existing non-admin user. The email
      // is already owned by a normal account; escalating it here would be a
      // silent privilege change on an existing row. Operator must resolve
      // manually (drop the user or pick a different bootstrap email).
      this.logger.error(
        `Bootstrap email ${email} is already in use by a non-admin user (role=${existing.role}); refusing to bootstrap. Resolve manually (drop the user or pick a different email).`,
      );
      return;
    }

    // Existing row is already admin: refresh the password hash only (idempotent
    // re-bootstrap with a rotated password). Role and id are left untouched.
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    this.logger.log(`Refreshed bootstrap admin password: ${email}`);
  }
}
