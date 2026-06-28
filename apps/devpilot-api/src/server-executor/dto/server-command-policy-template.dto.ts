import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListServerCommandPolicyTemplatesQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  adapterKey?: string;

  @IsOptional()
  @IsString()
  operationKey?: string;

  @IsOptional()
  @IsString()
  enabled?: string;
}

export class CreateServerCommandPolicyTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adapterKeys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operationKeys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPatterns?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedPatterns?: string[];
}

export class UpdateServerCommandPolicyTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  environmentId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adapterKeys?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operationKeys?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPatterns?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedPatterns?: string[] | null;
}
