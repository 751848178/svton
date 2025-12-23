import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化数据...');

  // 创建管理员用户
  const admin = await prisma.user.upsert({
    where: { phone: '13800000000' },
    update: {},
    create: {
      phone: '13800000000',
      password: '$2b$10$example', // 需要用 bcrypt 生成
      nickname: '管理员',
      role: 'admin',
      status: 1,
    },
  });

  console.log('✅ 管理员用户:', admin);
  console.log('🎉 数据初始化完成!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
