import { Body, Controller, Header, Inject, Post, Req } from '@nestjs/common';
import { MachineHandler } from './machine-handler.js';
import { enrollmentContext, machineContext, type MachineRequest } from './machine-request.js';
import { RegistrationMachineService } from './registration-machine.service.js';

@Controller('api/agent-registration')
export class RegistrationMachineController {
  constructor(@Inject(RegistrationMachineService) private readonly machines: RegistrationMachineService) {}
  @Post('enroll') @Header('Cache-Control', 'no-store') @MachineHandler('enrollment.consume', 'enrollment')
  enroll(@Req() request: MachineRequest, @Body() body: unknown) {
    return this.machines.enroll(enrollmentContext(request), body);
  }
  @Post('session') @Header('Cache-Control', 'no-store') @MachineHandler('session.open', 'machine')
  open(@Req() request: MachineRequest, @Body() body: unknown) {
    return this.machines.open(machineContext(request), body);
  }
  @Post('heartbeat') @Header('Cache-Control', 'no-store') @MachineHandler('heartbeat.write', 'machine')
  heartbeat(@Req() request: MachineRequest, @Body() body: unknown) {
    return this.machines.heartbeat(machineContext(request), body);
  }
}
