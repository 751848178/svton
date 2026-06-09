/**
 * Prompt management types.
 */

export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  variables?: string[];
}

export interface PromptVariable {
  key: string;
  value: string;
}
