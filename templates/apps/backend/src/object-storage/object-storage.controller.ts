import {
  Controller,
  Post,
  Get,
  Query,
  Req,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
// import { InjectObjectStorage, ObjectStorageClient } from '@svton/nestjs-object-storage';

/**
 * 对象存储控制器示例
 * 演示如何使用 @svton/nestjs-object-storage 进行文件上传和回调验签
 *
 * 使用前请先：
 * 1. 安装依赖：pnpm add @svton/nestjs-object-storage @svton/nestjs-object-storage-qiniu-kodo
 * 2. 在 AppModule 中启用 ObjectStorageModule
 * 3. 配置环境变量
 */
@ApiTags('对象存储')
@Controller('object-storage')
export class ObjectStorageController {
  private readonly logger = new Logger(ObjectStorageController.name);

  // constructor(
  //   @InjectObjectStorage() private readonly storage: ObjectStorageClient,
  // ) {}

  /**
   * 获取上传预签名 URL
   * 前端使用此 URL 直接上传文件到云存储
   */
  @ApiBearerAuth()
  @Get('presign')
  @ApiOperation({ summary: '获取上传预签名 URL' })
  async getPresignedUrl(
    @Query('key') key: string,
    @Query('contentType') contentType?: string,
  ) {
    if (!key) {
      throw new BadRequestException('key is required');
    }

    // 示例代码（启用 ObjectStorageModule 后取消注释）
    // const result = await this.storage.presign({
    //   key,
    //   method: 'PUT',
    //   expiresIn: 3600,
    //   contentType,
    //   callback: {
    //     url: 'https://your-domain.com/object-storage/callback',
    //     body: 'key=$(key)&hash=$(etag)&bucket=$(bucket)&fsize=$(fsize)',
    //   },
    // });
    // return result;

    return {
      message: 'ObjectStorageModule not enabled. See app.module.ts for setup instructions.',
    };
  }

  /**
   * 对象存储回调接口
   * 云存储上传完成后会调用此接口进行通知
   *
   * 注意：需要配置 raw body 中间件才能正确验签
   * 参见 main.ts 中的 rawBody 配置
   */
  @Post('callback')
  @ApiOperation({ summary: '对象存储回调（云存储调用）' })
  async handleCallback(@Req() req: Request) {
    // 获取 rawBody（需要在 main.ts 中配置）
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      this.logger.warn('rawBody not available. Please configure raw body middleware.');
      throw new BadRequestException('rawBody not available');
    }

    // 示例代码（启用 ObjectStorageModule 后取消注释）
    // const result = await this.storage.verifyCallback({
    //   method: req.method,
    //   path: req.path,
    //   query: req.query as Record<string, string | string[]>,
    //   headers: req.headers as Record<string, string | string[]>,
    //   rawBody,
    // });

    // if (!result.isValid) {
    //   this.logger.warn('Invalid callback signature');
    //   throw new UnauthorizedException('Invalid callback signature');
    // }

    // this.logger.log(`File uploaded: ${result.key}, size: ${result.size}`);

    // // 在这里处理业务逻辑，例如：
    // // - 保存文件记录到数据库
    // // - 触发后续处理（如图片压缩、视频转码等）

    // return {
    //   success: true,
    //   key: result.key,
    //   etag: result.etag,
    // };

    return {
      message: 'ObjectStorageModule not enabled. See app.module.ts for setup instructions.',
    };
  }
}
