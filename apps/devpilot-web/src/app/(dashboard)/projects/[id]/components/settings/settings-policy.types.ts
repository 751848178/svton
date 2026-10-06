export type EnvironmentAccessPolicy = {
  id: string;
  name: string;
  effect: string;
  actions?: string[];
  categories?: string[];
};
