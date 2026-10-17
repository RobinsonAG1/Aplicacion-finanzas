import '@testing-library/jest-dom/vitest'

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserver as unknown as typeof ResizeObserver
}
