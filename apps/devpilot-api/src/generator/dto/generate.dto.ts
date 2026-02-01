import { IsString, IsOptional, IsArray, IsObject, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BasicInfoDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  orgName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  packageManager: 'pnpm' | 'npm' | 'yarn';
}

class SubProjectsDto {
  @IsBoolean()
  backend: boolean;

  @IsBoolean()
  admin: boolean;

  @IsBoolean()
  mobile: boolean;
}

class UiLibraryDto {
  @IsBoolean()
  admin: boolean;

  @IsBoolean()
  mobile: boolean;
}

class GitConfigDto {
  @IsString()
  provider: 'github' | 'gitlab' | 'gitee';

  @IsString()
  repoName: string;

  @IsString()
  visibility: 'public' | 'private';

  @IsBoolean()
  createNew: boolean;
}

export class GenerateProjectDto {
  @ValidateNested()
  @Type(() => BasicInfoDto)
  basicInfo: BasicInfoDto;

  @ValidateNested()
  @Type(() => SubProjectsDto)
  subProjects: SubProjectsDto;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsObject()
  resources: Record<string, string>;

  @ValidateNested()
  @Type(() => UiLibraryDto)
  uiLibrary: UiLibraryDto;

  @IsBoolean()
  hooks: boolean;

  @ValidateNested()
  @Type(() => GitConfigDto)
  @IsOptional()
  gitConfig?: GitConfigDto;
}
