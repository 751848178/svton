import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import { ProjectService } from '../src/service/project.service';
import type { IStorage } from '@svton/agent-platform';

// ==============================================================
// In-memory IStorage mock
// ==============================================================

function createMockStorage(): IStorage {
  const store = new Map<string, unknown>();
  return {
    get: <T = unknown>(key: string) => Promise.resolve((store.get(key) ?? null) as T | null),
    set: <T = unknown>(key: string, value: T) => { store.set(key, value); return Promise.resolve(); },
    delete: (key: string) => { store.delete(key); return Promise.resolve(); },
    list: (prefix?: string) => {
      const keys = [...store.keys()];
      return Promise.resolve(prefix ? keys.filter((k) => k.startsWith(prefix)) : keys);
    },
    clear: () => { store.clear(); return Promise.resolve(); },
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('ProjectService', () => {
  let storage: IStorage;
  let service: ProjectService;

  beforeEach(() => {
    storage = createMockStorage();
    service = new ProjectService();
  });

  // ----------------------------------------------------------
  // 1. init
  // ----------------------------------------------------------
  describe('init', () => {
    it('initializes and sets ready=true', async () => {
      await service.init(storage);
      expect(service.ready).toBe(true);
    });

    it('loads empty projects on first init', async () => {
      await service.init(storage);
      expect(service.projects).toEqual([]);
      expect(service.currentProjectId).toBeNull();
    });

    it('skips re-initialization', async () => {
      await service.init(storage);
      service.currentProjectId = 'test';
      await service.init(storage);
      expect(service.currentProjectId).toBe('test');
    });

    it('loads existing projects from storage', async () => {
      await storage.set('agent:project_list', [
        { id: 'p1', name: 'My Project', path: '/home/user/project', createdAt: 1000, updatedAt: 1000 },
      ]);
      await service.init(storage);
      expect(service.projects).toHaveLength(1);
      expect(service.projects[0].name).toBe('My Project');
    });

    it('filters out invalid entries', async () => {
      await storage.set('agent:project_list', [
        { id: 'p1', name: 'Valid', path: '/valid' },
        { id: 123, name: 'Bad' }, // id not string
        { name: 'No path' }, // missing id
      ]);
      await service.init(storage);
      expect(service.projects).toHaveLength(1);
    });

    it('restores currentProjectId if it exists in project list', async () => {
      await storage.set('agent:project_list', [
        { id: 'p1', name: 'Project 1', path: '/a', createdAt: 1000, updatedAt: 1000 },
      ]);
      await storage.set('agent:current_project', 'p1');
      await service.init(storage);
      expect(service.currentProjectId).toBe('p1');
    });

    it('ignores currentProjectId if project not in list', async () => {
      await storage.set('agent:current_project', 'nonexistent');
      await service.init(storage);
      expect(service.currentProjectId).toBeNull();
    });

    it('handles non-array project list', async () => {
      await storage.set('agent:project_list', 'not an array');
      await service.init(storage);
      expect(service.projects).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // 2. createProject
  // ----------------------------------------------------------
  describe('createProject', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('creates a project and adds to list', async () => {
      const project = await service.createProject('New Project', '/path/to/project');
      expect(project.name).toBe('New Project');
      expect(project.path).toBe('/path/to/project');
      expect(project.id).toMatch(/^project_\d+_/);
      expect(service.projects).toHaveLength(1);
    });

    it('persists to storage', async () => {
      await service.createProject('Persisted', '/path');
      const list = await storage.get<any[]>('agent:project_list');
      expect(list).toHaveLength(1);
      expect(list![0].name).toBe('Persisted');
    });

    it('appends to existing projects', async () => {
      await service.createProject('First', '/a');
      await service.createProject('Second', '/b');
      expect(service.projects).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // 3. deleteProject
  // ----------------------------------------------------------
  describe('deleteProject', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('removes project from list', async () => {
      const p1 = await service.createProject('Keep', '/a');
      const p2 = await service.createProject('Delete', '/b');
      await service.deleteProject(p2.id);
      expect(service.projects).toHaveLength(1);
      expect(service.projects[0].id).toBe(p1.id);
    });

    it('switches to null if deleting current project', async () => {
      const p = await service.createProject('Current', '/a');
      await service.switchProject(p.id);
      expect(service.currentProjectId).toBe(p.id);
      await service.deleteProject(p.id);
      expect(service.currentProjectId).toBeNull();
    });

    it('does not switch if deleting non-current project', async () => {
      const p1 = await service.createProject('Keep', '/a');
      const p2 = await service.createProject('Delete', '/b');
      await service.switchProject(p1.id);
      await service.deleteProject(p2.id);
      expect(service.currentProjectId).toBe(p1.id);
    });
  });

  // ----------------------------------------------------------
  // 4. switchProject
  // ----------------------------------------------------------
  describe('switchProject', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('sets currentProjectId and persists', async () => {
      const p = await service.createProject('Test', '/a');
      await service.switchProject(p.id);
      expect(service.currentProjectId).toBe(p.id);
      const stored = await storage.get<string>('agent:current_project');
      expect(stored).toBe(p.id);
    });

    it('clears currentProjectId with null and deletes from storage', async () => {
      const p = await service.createProject('Test', '/a');
      await service.switchProject(p.id);
      await service.switchProject(null);
      expect(service.currentProjectId).toBeNull();
      const stored = await storage.get<string>('agent:current_project');
      expect(stored).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 5. getCurrentProject / getProjectById
  // ----------------------------------------------------------
  describe('getCurrentProject', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('returns current project', async () => {
      const p = await service.createProject('Current', '/a');
      await service.switchProject(p.id);
      expect(service.getCurrentProject()?.name).toBe('Current');
    });

    it('returns undefined when no current project', () => {
      expect(service.getCurrentProject()).toBeUndefined();
    });
  });

  describe('getProjectById', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('finds project by id', async () => {
      const p = await service.createProject('FindMe', '/a');
      expect(service.getProjectById(p.id)?.name).toBe('FindMe');
    });

    it('returns undefined for non-existent id', () => {
      expect(service.getProjectById('nonexistent')).toBeUndefined();
    });
  });
});
