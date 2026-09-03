class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = window.ResizeObserver || MockResizeObserver;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || MockResizeObserver;
}
