import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListControlAccessPoliciesQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  principalUserId?: string;

  @IsOptional()
  @IsString()
  principalRole?: string;

  @IsOptional()
  @IsString()
  principalType?: string;

  @IsOptional()
  @IsString()
  effect?: string;

  @IsOptional()
  @IsString()
  enabled?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  risk?: string;
}

export class CreateControlAccessPolicyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['allow', 'deny'])
  effect?: 'allow' | 'deny';

  @IsOptional()
  @IsIn(['team_role', 'user', 'any'])
  principalType?: 'team_role' | 'user' | 'any';

  @IsOptional()
  @IsIn(['owner', 'admin', 'member'])
  principalRole?: 'owner' | 'admin' | 'member';

  @IsOptional()
  @IsString()
  principalUserId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskLevels?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class UpdateControlAccessPolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['allow', 'deny'])
  effect?: 'allow' | 'deny';

  @IsOptional()
  @IsIn(['team_role', 'user', 'any'])
  principalType?: 'team_role' | 'user' | 'any';

  @IsOptional()
  @IsIn(['owner', 'admin', 'member'])
  principalRole?: 'owner' | 'admin' | 'member' | null;

  @IsOptional()
  @IsString()
  principalUserId?: string | null;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  environmentId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskLevels?: string[] | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
