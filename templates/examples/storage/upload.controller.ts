import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

/**
 * 文件上传控制器示例
 * 
 * 注意：需要安装 @types/multer 依赖
 * pnpm add -D @types/multer
 */
@Controller('examples/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 获取上传凭证（客户端直传）
   */
  @Get('token')
  async getUploadToken(@Query('key') key?: string) {
    const token = await this.uploadService.getUploadToken(key);

    return {
      token,
      uploadUrl: 'https://upload.qiniup.com', // 七牛云上传地址
      domain: process.env.QINIU_DOMAIN,
    };
  }

  /**
   * 服务端上传文件
   */
  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadFile(file);

    return {
      message: 'File uploaded successfully',
      ...result,
    };
  }

  /**
   * 上传图片（带压缩）
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadImage(file);

    return {
      message: 'Image uploaded successfully',
      ...result,
    };
  }

  /**
   * 批量上传
   */
  @Post('batch')
  @UseInterceptors(FileInterceptor('files'))
  async uploadBatch(@UploadedFile() files: Express.Multer.File[]) {
    const results = await this.uploadService.uploadBatch(files);

    return {
      message: 'Files uploaded successfully',
      files: results,
    };
  }

  /**
   * 删除文件
   */
  @Delete(':key')
  async deleteFile(@Param('key') key: string) {
    await this.uploadService.deleteFile(key);

    return {
      message: 'File deleted successfully',
    };
  }

  /**
   * 获取文件信息
   */
  @Get('info/:key')
  async getFileInfo(@Param('key') key: string) {
    const info = await this.uploadService.getFileInfo(key);

    return {
      ...info,
    };
  }

  /**
   * 获取私有文件访问 URL
   */
  @Get('private-url')
  async getPrivateUrl(
    @Query('key') key: string,
    @Query('expires') expires?: string,
  ) {
    const url = await this.uploadService.getPrivateUrl(
      key,
      expires ? parseInt(expires) : 3600,
    );

    return {
      url,
      expiresIn: expires || 3600,
    };
  }
}
