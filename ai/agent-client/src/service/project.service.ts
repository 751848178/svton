import 'reflect-metadata';
import { Service, observable, action } from '@svton/service';
import type { IStorage } from '@svton/agent-platform';
import { SYSTEM_CLOCK, RANDOM_ID_GENERATOR } from '@svton/agent-core';
import type { IClock, IIdGenerator } from '@svton/agent-core';
import type { Project } from '../types';

const LIST_KEY = 'agent:project_list';
const CURRENT_KEY = 'agent:current_project';

@Service()
export class ProjectService {
  @observable() projects: Project[] = [];
  @observable() currentProjectId: string | null = null;
  @observable() ready: boolean = false;

  private storage: IStorage | null = null;
  // Injectable for deterministic tests.
  private clock: IClock = SYSTEM_CLOCK;
  private idGen: IIdGenerator = RANDOM_ID_GENERATOR;

  @action()
  async init(storage: IStorage, opts?: { clock?: IClock; idGen?: IIdGenerator }): Promise<void> {
    if (this.ready) return;
    this.storage = storage;
    if (opts?.clock) this.clock = opts.clock;
    if (opts?.idGen) this.idGen = opts.idGen;
    await this.loadProjects();
    await this.loadCurrentProject();
    this.ready = true;
  }

  @action()
  async createProject(name: string, path: string): Promise<Project> {
    const now = this.clock.now();
    const project: Project = {
      id: this.idGen.nextId('project'),
      name,
      path,
      createdAt: now,
      updatedAt: now,
    };

    const newProjects = [...this.projects, project];
    await this.storage!.set(LIST_KEY, newProjects);
    this.projects = newProjects;

    return project;
  }

  @action()
  async deleteProject(id: string): Promise<void> {
    const newProjects = this.projects.filter((p) => p.id !== id);
    await this.storage!.set(LIST_KEY, newProjects);
    this.projects = newProjects;

    if (this.currentProjectId === id) {
      await this.switchProject(null);
    }
  }

  @action()
  async switchProject(id: string | null): Promise<void> {
    this.currentProjectId = id;
    if (id) {
      await this.storage!.set(CURRENT_KEY, id);
    } else {
      await this.storage!.delete(CURRENT_KEY);
    }
  }

  getCurrentProject(): Project | undefined {
    if (!this.currentProjectId) return undefined;
    return this.projects.find((p) => p.id === this.currentProjectId);
  }

  getProjectById(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  private async loadProjects(): Promise<void> {
    const raw = await this.storage!.get<unknown>(LIST_KEY);
    if (raw == null || !Array.isArray(raw)) {
      this.projects = [];
      return;
    }
    const list = raw as Project[];
    this.projects = list.filter(
      (p): p is Project =>
        p != null &&
        typeof p === 'object' &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.path === 'string',
    );
  }

  private async loadCurrentProject(): Promise<void> {
    const id = await this.storage!.get<string>(CURRENT_KEY);
    if (id && this.projects.some((p) => p.id === id)) {
      this.currentProjectId = id;
    }
  }
}
