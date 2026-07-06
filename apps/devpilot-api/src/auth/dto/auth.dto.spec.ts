import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.dto';

/**
 * 验证 RegisterDto 的密码复杂度策略（@IsStrongPassword）。
 *
 * 行业标准：至少 8 字符，含大小写字母和数字（不强制符号，降低用户摩擦）。
 */
async function validatePassword(password: string): Promise<string[]> {
  const dto = plainToInstance(RegisterDto, { email: 'test@example.com', password, name: 'test' });
  const errors = await validate(dto);
  const passwordErrors = errors
    .filter((e) => e.property === 'password')
    .flatMap((e) => Object.values(e.constraints || {}));
  return passwordErrors;
}

describe('RegisterDto password strength (IsStrongPassword)', () => {
  it('rejects passwords shorter than 8 characters', async () => {
    const errors = await validatePassword('Abc123');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects passwords without uppercase', async () => {
    const errors = await validatePassword('password123');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects passwords without lowercase', async () => {
    const errors = await validatePassword('PASSWORD123');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects passwords without numbers', async () => {
    const errors = await validatePassword('PasswordABC');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a strong password (8+ chars with upper+lower+number)', async () => {
    const errors = await validatePassword('StrongPass1');
    expect(errors).toEqual([]);
  });

  it('accepts passwords with symbols too', async () => {
    const errors = await validatePassword('Str0ng!Pass');
    expect(errors).toEqual([]);
  });
});
