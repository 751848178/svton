const MOUSE_BUTTONS = new Set(['left', 'right', 'middle']);
const SCROLL_DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const KEYBOARD_MODIFIERS = new Set(['ctrl', 'alt', 'shift', 'meta', 'cmd']);

export function validateFiniteCoordinates(fields: Record<string, unknown>): string | null {
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `Error: "${name}" is required and must be a finite number.`;
    }
  }
  return null;
}

export function validateMouseInput(
  fields: Record<string, unknown>,
  button: unknown,
): { button: string } | { error: string } {
  const coordinateError = validateFiniteCoordinates(fields);
  if (coordinateError) return { error: coordinateError };

  if (button === undefined) return { button: 'left' };
  if (typeof button !== 'string') {
    return { error: 'Error: "button" must be one of left, right, or middle.' };
  }
  const normalizedButton = button.trim().toLowerCase();
  if (!normalizedButton) return { button: 'left' };
  if (!MOUSE_BUTTONS.has(normalizedButton)) {
    return { error: 'Error: "button" must be one of left, right, or middle.' };
  }
  return { button: normalizedButton };
}

export function validateDisplayIndex(display: unknown): string | null {
  if (display === undefined) return null;
  if (typeof display !== 'number' || !Number.isInteger(display) || display < 0) {
    return 'Error: "display" must be a non-negative integer.';
  }
  return null;
}

export function validateScrollInput(
  fields: Record<string, unknown>,
  direction: unknown,
  amount: unknown,
): { direction: string; amount: number } | { error: string } {
  const coordinateError = validateFiniteCoordinates(fields);
  if (coordinateError) return { error: coordinateError };

  if (typeof direction !== 'string') {
    return { error: 'Error: "direction" must be one of up, down, left, or right.' };
  }
  const normalizedDirection = direction.trim().toLowerCase();
  if (!SCROLL_DIRECTIONS.has(normalizedDirection)) {
    return { error: 'Error: "direction" must be one of up, down, left, or right.' };
  }
  if (
    amount !== undefined &&
    (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      !Number.isInteger(amount) ||
      amount <= 0
    )
  ) {
    return {
      error: 'Error: "amount" must be a positive finite number of ticks and an integer.',
    };
  }
  return { direction: normalizedDirection, amount: amount ?? 3 };
}

export function validateKeyboardPressInput(
  key: unknown,
  modifiers: unknown,
): { key: string; modifiers: string[] } | { error: string } {
  if (!key || typeof key !== 'string') {
    return { error: 'Error: "key" is required and must be a string.' };
  }
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) {
    return { error: 'Error: "key" must be a non-empty string.' };
  }
  if (modifiers === undefined) return { key: normalizedKey, modifiers: [] };
  if (!Array.isArray(modifiers) || modifiers.some((modifier) => typeof modifier !== 'string')) {
    return { error: 'Error: "modifiers" must be an array of strings.' };
  }
  const normalizedModifiers = modifiers.map((modifier) => modifier.trim().toLowerCase());
  if (normalizedModifiers.some((modifier) => !KEYBOARD_MODIFIERS.has(modifier))) {
    return {
      error: 'Error: "modifiers" must contain only ctrl, alt, shift, meta, or cmd.',
    };
  }
  return { key: normalizedKey, modifiers: normalizedModifiers };
}
