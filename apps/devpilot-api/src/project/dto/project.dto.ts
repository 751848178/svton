import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export const PROJECT_ORIGINS = ['generated', 'imported', 'external'] as const;

export type ProjectOrigin = (typeof PROJECT_ORIGINS)[number];

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: object;

  @IsString()
  @IsOptional()
  gitRepo?: string;

  @IsIn([...PROJECT_ORIGINS])
  @IsOptional()
  origin?: ProjectOrigin;
}

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: object;

  @IsString()
  @IsOptional()
  gitRepo?: string;

  @IsIn([...PROJECT_ORIGINS])
  @IsOptional()
  origin?: ProjectOrigin;
}
