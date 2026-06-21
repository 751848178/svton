import { Module } from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { GeneratorController } from './generator.controller';
import { RegistryModule } from '../registry/registry.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [RegistryModule, ProjectModule],
  controllers: [GeneratorController],
  providers: [GeneratorService],
  exports: [GeneratorService],
})
export class GeneratorModule {}
