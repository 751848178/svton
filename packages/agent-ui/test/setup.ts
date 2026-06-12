import '@testing-library/jest-dom/vitest';

// Mock clipboard API for jsdom — configurable so userEvent can override
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: () => Promise.resolve(),
      readText: () => Promise.resolve(''),
    },
    writable: true,
    configurable: true,
  });
}

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = () => {};
