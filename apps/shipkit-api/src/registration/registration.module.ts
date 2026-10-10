import { AgentSessionRepository } from './agent-session.repository.js';
import { AgentStateRepository } from './agent-state.repository.js';
import { EnrollmentRepository } from './enrollment.repository.js';
import { machineAuthProviders } from './machine-request.guard.js';
import { RegistrationMachineController } from './registration-machine.controller.js';
import { RegistrationMachineService } from './registration-machine.service.js';
import { RegisteredAgentController } from './registered-agent.controller.js';
import { RegisteredAgentService } from './registered-agent.service.js';
import { RegisteredAgentDirectory } from './registered-agent.directory.js';

export const registrationControllers = [RegistrationMachineController, RegisteredAgentController];
export const registrationProviders = [...machineAuthProviders, EnrollmentRepository, AgentSessionRepository,
  AgentStateRepository, RegistrationMachineService, RegisteredAgentService, RegisteredAgentDirectory];
