# 模块开发指南

> 如何在 NestJS 后端开发新模块

---

## 📁 模块结构

每个模块遵循统一结构：

```
src/modules/example/
├── example.module.ts       # 模块定义
├── example.controller.ts   # 控制器 (HTTP 入口)
├── example.service.ts      # 服务 (业务逻辑)
├── dto/                    # 数据传输对象
│   ├── create-example.dto.ts
│   ├── update-example.dto.ts
│   └── query-example.dto.ts
└── vo/                     # 视图对象 (可选)
    └── example.vo.ts
```

---

## 🚀 快速创建模块

### 使用 Nest CLI

```bash
cd apps/backend

# 创建完整模块
nest g module modules/example
nest g controller modules/example
nest g service modules/example
```

### 手动创建

#### 1. 模块定义 (example.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';

@Module({
  controllers: [ExampleController],
  providers: [ExampleService],
  exports: [ExampleService], // 如需被其他模块使用
})
export class ExampleModule {}
```

#### 2. 控制器 (example.controller.ts)

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExampleService } from './example.service';
import { CreateExampleDto } from './dto/create-example.dto';
import { UpdateExampleDto } from './dto/update-example.dto';
import { QueryExampleDto } from './dto/query-example.dto';

@ApiTags('示例模块')
@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建示例' })
  async create(
    @CurrentUser() user: any,
    @Body() createDto: CreateExampleDto,
  ) {
    return this.exampleService.create(user.id, createDto);
  }

  @Get()
  @ApiOperation({ summary: '查询列表' })
  async findAll(@Query() queryDto: QueryExampleDto) {
    return this.exampleService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询详情' })
  async findOne(@Param('id') id: string) {
    return this.exampleService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新示例' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateExampleDto,
  ) {
    return this.exampleService.update(+id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除示例' })
  async remove(@Param('id') id: string) {
    return this.exampleService.remove(+id);
  }
}
```

#### 3. 服务 (example.service.ts)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExampleDto } from './dto/create-example.dto';
import { UpdateExampleDto } from './dto/update-example.dto';
import { QueryExampleDto } from './dto/query-example.dto';

@Injectable()
export class ExampleService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createDto: CreateExampleDto) {
    return this.prisma.example.create({
      data: {
        ...createDto,
        authorId: userId,
        tenantId: 'default',
      },
    });
  }

  async findAll(queryDto: QueryExampleDto) {
    const { page = 1, pageSize = 10, keyword } = queryDto;
    
    const where = {
      delFlag: 0,
      ...(keyword && {
        OR: [
          { title: { contains: keyword } },
          { content: { contains: keyword } },
        ],
      }),
    };

    const [list, total] = await Promise.all([
      this.prisma.example.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.example.count({ where }),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: number) {
    const example = await this.prisma.example.findFirst({
      where: { id, delFlag: 0 },
    });

    if (!example) {
      throw new NotFoundException('记录不存在');
    }

    return example;
  }

  async update(id: number, updateDto: UpdateExampleDto) {
    await this.findOne(id); // 确保存在
    
    return this.prisma.example.update({
      where: { id },
      data: updateDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    
    // 软删除
    return this.prisma.example.update({
      where: { id },
      data: { delFlag: 1 },
    });
  }
}
```

---

## 📝 DTO 定义

### CreateExampleDto

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateExampleDto {
  @ApiProperty({ description: '标题', example: '示例标题' })
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(200, { message: '标题最多200个字符' })
  title: string;

  @ApiPropertyOptional({ description: '内容' })
  @IsString()
  @IsOptional()
  content?: string;
}
```

### UpdateExampleDto

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateExampleDto } from './create-example.dto';

export class UpdateExampleDto extends PartialType(CreateExampleDto) {}
```

### QueryExampleDto

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, IsString } from 'class-validator';

export class QueryExampleDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '关键词' })
  @IsString()
  @IsOptional()
  keyword?: string;
}
```

---

## 📦 注册模块

在 `app.module.ts` 中注册：

```typescript
import { Module } from '@nestjs/common';
import { ExampleModule } from './modules/example/example.module';

@Module({
  imports: [
    // ... 其他模块
    ExampleModule,
  ],
})
export class AppModule {}
```

---

## 🔐 认证与授权

### 使用 JWT 守卫

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('examples')
@UseGuards(JwtAuthGuard)  // 整个控制器需要认证
export class ExampleController {}

// 或单个路由
@Post()
@UseGuards(JwtAuthGuard)
async create() {}
```

### 获取当前用户

```typescript
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Post()
@UseGuards(JwtAuthGuard)
async create(@CurrentUser() user: any) {
  console.log(user.id, user.username);
}
```

### 可选认证

```typescript
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Get()
@UseGuards(OptionalJwtAuthGuard)
async findAll(@CurrentUser() user: any) {
  // user 可能为 undefined
}
```

---

## 📊 数据库操作

### 添加 Prisma Model

编辑 `prisma/schema.prisma`：

```prisma
model Example {
  id         Int       @id @default(autoincrement())
  tenantId   String    @map("tenant_id") @db.VarChar(20)
  title      String    @db.VarChar(200)
  content    String?   @db.Text
  authorId   Int       @map("author_id")
  status     String    @default("active") @db.VarChar(20)
  createTime DateTime  @default(now()) @map("create_time")
  updateTime DateTime  @updatedAt @map("update_time")
  delFlag    Int       @default(0) @map("del_flag")
  
  // 关系
  author     User      @relation(fields: [authorId], references: [id])
  
  @@map("examples")
  @@index([tenantId, status])
  @@index([authorId])
}
```

### 运行迁移

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

---

## ✅ 开发检查清单

- [ ] 创建 Module、Controller、Service
- [ ] 定义 DTO (Create、Update、Query)
- [ ] 添加 Prisma Model 并迁移
- [ ] 添加 Swagger 文档注解
- [ ] 添加认证守卫 (如需)
- [ ] 在 AppModule 注册
- [ ] 测试 API 接口

---

**下一步**: [Prisma ORM](./prisma.md)
