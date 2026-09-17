/**
 * Global type declarations for LithoDrop.
 *
 * Declares CSS file imports so TypeScript doesn't error on side-effect
 * CSS imports (e.g., `import "./index.css"`). Vite handles the actual
 * module resolution at build time.
 */

// CSS side-effect imports (used for global stylesheets and CSS Modules)
declare module "*.css" {
  const styles: Record<string, string>;
  export default styles;
}

// SVG imports (as React components via @svgr, if needed)
declare module "*.svg?react" {
  import type { FC, SVGProps } from "react";
  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

// Raw asset imports
declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}
