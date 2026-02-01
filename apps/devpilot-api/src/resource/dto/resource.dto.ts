import { IsString, IsObject, IsOptional } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsObject()
  config: Record<string, string>;
}

export class UpdateResourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, string>;
}
