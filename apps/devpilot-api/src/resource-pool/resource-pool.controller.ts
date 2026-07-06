import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { ResourcePoolService } from "./resource-pool.service";
import {
  CreateResourcePoolDto,
  UpdateResourcePoolDto,
  AllocateResourceDto,
} from "./dto/resource-pool.dto";
import {
  ResourcePoolAccessService,
  ResourcePoolAuthRequest,
} from "./resource-pool-access.service";

@Controller("resource-pools")
@UseGuards(JwtAuthGuard)
export class ResourcePoolController {
  constructor(
    private readonly resourcePoolService: ResourcePoolService,
    private readonly accessService: ResourcePoolAccessService,
  ) {}

  @Post()
  @UseGuards(AuthzGuard)
  @Roles("admin")
  async createPool(@Body() dto: CreateResourcePoolDto) {
    return this.resourcePoolService.createPool(dto);
  }

  @Get()
  @UseGuards(AuthzGuard)
  @Roles("admin")
  async getPools(
    @Request() req: ResourcePoolAuthRequest,
    @Query("type") type?: string,
  ) {
    const pools = await this.resourcePoolService.getPools(type);
    return this.accessService.filterReadablePools(req, pools);
  }

  @Get("available")
  @UseGuards(AuthzGuard)
  @Roles("team_member")
  async getAvailablePools(
    @Request() req: ResourcePoolAuthRequest,
    @Query("type") type?: string,
  ) {
    const pools = await this.resourcePoolService.getAvailablePools(type);
    return this.accessService.filterReadablePools(req, pools);
  }

  @Get(":id")
  @UseGuards(AuthzGuard)
  @Roles("admin")
  async getPool(
    @Param("id") id: string,
    @Request() req: ResourcePoolAuthRequest,
  ) {
    await this.accessService.assertCanReadPool(req, id);
    return this.resourcePoolService.getPool(id);
  }

  @Put(":id")
  @UseGuards(AuthzGuard)
  @Roles("admin")
  async updatePool(
    @Param("id") id: string,
    @Body() dto: UpdateResourcePoolDto,
  ) {
    return this.resourcePoolService.updatePool(id, dto);
  }

  @Delete(":id")
  @UseGuards(AuthzGuard)
  @Roles("admin")
  async deletePool(@Param("id") id: string) {
    return this.resourcePoolService.deletePool(id);
  }

  @Post("allocate")
  @UseGuards(AuthzGuard)
  @Roles("team_member")
  async allocateResource(
    @Body() dto: AllocateResourceDto,
    @Request() req: ResourcePoolAuthRequest,
  ) {
    const scope = await this.accessService.resolveAllocationInputAccessScope(
      req.teamId,
      dto,
    );
    await this.accessService.assertCanAllocate(req, dto, scope);
    return this.resourcePoolService.allocateResource(
      dto,
      req.user.id,
      req.teamId,
    );
  }

  @Post("release/:allocationId")
  @UseGuards(AuthzGuard)
  @Roles("team_member")
  async releaseResource(
    @Param("allocationId") allocationId: string,
    @Request() req: ResourcePoolAuthRequest,
  ) {
    const scope = await this.accessService.getAllocationAccessScope(
      req.teamId,
      allocationId,
    );
    await this.accessService.assertCanRelease(req, allocationId, scope);
    return this.resourcePoolService.releaseResource(req.teamId, allocationId);
  }

  @Get("my/allocations")
  async getMyAllocations(@Request() req: ResourcePoolAuthRequest) {
    return this.resourcePoolService.getUserAllocations(req.teamId, req.user.id);
  }

  @Get("project/:projectId/allocations")
  @UseGuards(AuthzGuard)
  @Roles("team_member")
  async getProjectAllocations(
    @Param("projectId") projectId: string,
    @Request() req: ResourcePoolAuthRequest,
  ) {
    await this.accessService.assertCanReadProjectAllocations(req, projectId);
    return this.resourcePoolService.getProjectAllocations(
      req.teamId,
      projectId,
    );
  }
}
