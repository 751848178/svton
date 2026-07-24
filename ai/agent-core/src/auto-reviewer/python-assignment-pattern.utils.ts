export const PYTHON_NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_]*';

export function pythonSimpleAssignmentPattern(): RegExp {
  return new RegExp(`(?:^|[;\\n])\\s*(${PYTHON_NAME_PATTERN})(?:\\s*:\\s*[^=;\\n]+)?\\s*=\\s*`, 'g');
}
