import { IsString, IsOptional, IsBoolean, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConnectGitDto {
  @IsString()
  @IsIn(['github', 'gitlab', 'gitee'])
  provider: 'github' | 'gitlab' | 'gitee';

  @IsString()
  accessToken: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class CreateRepoDto {
  @IsString()
  @IsIn(['github', 'gitlab', 'gitee'])
  provider: 'github' | 'gitlab' | 'gitee';

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  private?: boolean;
}

class FileDto {
  @IsString()
  path: string;

  @IsString()
  content: string;
}

export class PushFilesDto {
  @IsString()
  @IsIn(['github', 'gitlab', 'gitee'])
  provider: 'github' | 'gitlab' | 'gitee';

  @IsString()
  repo: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[];

  @IsString()
  @IsOptional()
  message?: string;
}
