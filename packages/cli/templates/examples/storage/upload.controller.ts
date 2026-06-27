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
   * 获取预签名上传 URL（客户端直传）
   */
  @Get('presigned-upload-url')
  async getPresignedUploadUrl(
    @Query('key') key: string,
    @Query('contentType') contentType?: string,
  ) {
    const result = await this.uploadService.getPresignedUploadUrl(key, contentType);

    return {
      message: 'Presigned upload URL generated',
      ...result,
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
   * 获取预签名下载 URL（私有文件访问）
   */
  @Get('presigned-download-url')
  async getPresignedDownloadUrl(
    @Query('key') key: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const result = await this.uploadService.getPresignedDownloadUrl(
      key,
      expiresIn ? parseInt(expiresIn) : 3600,
    );

    return {
      message: 'Presigned download URL generated',
      ...result,
    };
  }
}
