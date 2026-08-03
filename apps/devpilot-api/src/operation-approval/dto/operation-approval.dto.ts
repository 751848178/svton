import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class ListOperationApprovalsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  risk?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  requesterId?: string;
}

export class ReviewOperationApprovalDto {
  @IsIn(["approved", "rejected"])
  decision: "approved" | "rejected";

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reviewComment: string;
}
