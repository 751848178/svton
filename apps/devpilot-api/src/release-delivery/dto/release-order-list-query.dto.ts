import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  RELEASE_ORDER_LIST_STATUSES,
  type ReleaseOrderListStatus,
} from "../release-order-list.types";

export class ReleaseOrderListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @IsIn(RELEASE_ORDER_LIST_STATUSES)
  status?: ReleaseOrderListStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 50;
}
