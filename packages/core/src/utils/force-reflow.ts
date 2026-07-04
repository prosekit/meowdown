export function forceReflow(element: HTMLElement): void {
  void element.offsetWidth
}
