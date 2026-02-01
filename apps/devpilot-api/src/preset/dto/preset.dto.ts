import { IsString, IsObject, IsOptional } from 'class-validator';

export class CreatePresetDto {
  @IsString()
  name: string;

  @IsObject()
  config: object;
}

export class UpdatePresetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  config?: object;
}

export class ImportPresetDto {
  @IsString()
  name: string;

  @IsObject()
  config: object;
}
