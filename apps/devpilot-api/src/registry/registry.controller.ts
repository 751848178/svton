import { Controller, Get, Param, Query } from '@nestjs/common';
import { RegistryService } from './registry.service';

@Controller('registry')
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get('features')
  getFeatures(@Query('subProjects') subProjects?: string) {
    if (subProjects) {
      const subProjectIds = subProjects.split(',');
      return this.registryService.getAvailableFeatures(subProjectIds);
    }
    return this.registryService.getFeatures();
  }

  @Get('categories')
  getCategories() {
    return this.registryService.getCategories();
  }

  @Get('features/by-category')
  getFeaturesByCategory() {
    return {
      categories: this.registryService.getCategories(),
      features: this.registryService.getFeaturesByCategory(),
    };
  }

  @Get('features/:id')
  getFeature(@Param('id') id: string) {
    return this.registryService.getFeature(id);
  }

  @Get('sub-projects')
  getSubProjects() {
    return this.registryService.getSubProjects();
  }

  @Get('sub-projects/:id')
  getSubProject(@Param('id') id: string) {
    return this.registryService.getSubProject(id);
  }

  @Get('frontend-libraries')
  getFrontendLibraries(@Query('subProjects') subProjects?: string) {
    if (subProjects) {
      const subProjectIds = subProjects.split(',');
      return this.registryService.getAvailableFrontendLibraries(subProjectIds);
    }
    return this.registryService.getFrontendLibraries();
  }

  @Get('resource-types')
  getResourceTypes() {
    return this.registryService.getResourceTypes();
  }

  @Get('resource-types/:id')
  getResourceType(@Param('id') id: string) {
    return this.registryService.getResourceType(id);
  }

  @Get('resolve/packages')
  resolvePackages(@Query('features') features: string) {
    const featureIds = features ? features.split(',') : [];
    return this.registryService.resolvePackages(featureIds);
  }

  @Get('resolve/resources')
  resolveResources(@Query('features') features: string) {
    const featureIds = features ? features.split(',') : [];
    return this.registryService.resolveResources(featureIds);
  }
}
