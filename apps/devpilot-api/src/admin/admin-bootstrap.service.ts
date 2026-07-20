import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_ROLE = 'admin';
const ADMIN_DISPLAY_NAME = 'System Administrator';
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Startup-only bootstrap that upserts a system-level admin (role='admin')
 * from env vars. Idempotent by email. Silent no-op when env vars are absent,
 * so it is safe to enable in every environment (including production where no
 * bootstrap admin is desired).
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
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (!existing) {
      await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role: ADMIN_ROLE,
          name: ADMIN_DISPLAY_NAME,
        },
      });
      this.logger.log(`Bootstrapped admin user: ${email}`);
      return;
    }

    if (existing.role !== ADMIN_ROLE) {
      this.logger.warn(`Promoting existing user ${email} to admin`);
    }

    await this.prisma.user.update({
      where: { email },
      data: { role: ADMIN_ROLE, passwordHash },
    });
    this.logger.log(`Updated bootstrap admin: ${email}`);
  }
}
