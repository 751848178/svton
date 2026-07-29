import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class StartRepositoryAnalysisDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  branch?: string;

  @IsString()
  @MaxLength(200)
  idempotencyKey: string;
}

export class RepositorySuggestionDecisionDto {
  @IsString()
  suggestionId: string;

  @IsIn(['accept', 'edit', 'reject'])
  decision: 'accept' | 'edit' | 'reject';

  @IsObject()
  @IsOptional()
  value?: Record<string, unknown>;
}

export class ApplyRepositorySuggestionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RepositorySuggestionDecisionDto)
  decisions: RepositorySuggestionDecisionDto[];
}
