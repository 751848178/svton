import { Controller, Get } from '@nestjs/common';
import { Public } from '@svton/nestjs-authz';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'initializer-api',
    };
  }
}
