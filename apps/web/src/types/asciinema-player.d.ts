declare module "asciinema-player" {
  interface AsciinemaPlayerOptions {
    cols?: number;
    rows?: number;
    autoPlay?: boolean;
    loop?: boolean;
    speed?: number;
    idleTimeLimit?: number;
    theme?: string;
    fit?: string;
    terminalFontFamily?: string;
    terminalFontSize?: string;
    poster?: string;
  }

  interface AsciinemaPlayerInstance {
    dispose(): void;
    play(): void;
    pause(): void;
    seek(time: number): void;
    getCurrentTime(): number;
  }

  export function create(
    src: string,
    element: HTMLElement,
    options?: AsciinemaPlayerOptions
  ): AsciinemaPlayerInstance;
}
