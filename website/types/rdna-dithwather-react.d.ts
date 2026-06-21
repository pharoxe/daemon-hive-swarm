declare module "@rdna/dithwather-react" {
  import type { CSSProperties, ReactNode } from "react";

  export type DitherAnimateConfig = {
    idle?: { threshold?: number };
    hover?: { threshold?: number };
    active?: { threshold?: number };
    focus?: { threshold?: number };
    transition?: number;
  };

  export type DitherButtonProps = {
    colors?: string[];
    angle?: number;
    algorithm?: string;
    animate?: DitherAnimateConfig;
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
    onClick?: () => void;
  };

  export function DitherButton(props: DitherButtonProps): JSX.Element;
  export function DitherBox(props: Record<string, unknown>): JSX.Element;
  export function useReducedMotion(): boolean;
}
