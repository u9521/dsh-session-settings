declare module 'react-dom' {
  export function createPortal(
    children: import('react').ReactNode,
    container: Element | DocumentFragment,
    key?: null | string,
  ): import('react').ReactPortal
}

declare module 'react-dom/client' {
  export interface Root {
    render(children: import('react').ReactNode): void
    unmount(): void
  }
  export function createRoot(
    container: Element | DocumentFragment,
    options?: any,
  ): Root
}
