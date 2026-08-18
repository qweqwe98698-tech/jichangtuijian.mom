/**
 * @pagefind/default-ui 不随包发布类型声明。这里只声明我们实际用到的构造签名,
 * 不做完整建模——多余的类型面积只会在上游变更时制造维护负担。
 */
declare module '@pagefind/default-ui' {
  export interface PagefindUIOptions {
    element: string | HTMLElement;
    showSubResults?: boolean;
    showImages?: boolean;
    excerptLength?: number;
    resetStyles?: boolean;
    bundlePath?: string;
    translations?: Record<string, string>;
  }

  export class PagefindUI {
    constructor(options: PagefindUIOptions);
    triggerSearch(term: string): void;
    destroy(): void;
  }
}
