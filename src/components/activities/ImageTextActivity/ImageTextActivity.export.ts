import css from './ImageTextActivity.module.css?raw';

// Use the component's canonical CSS in documents without a CSS-module loader.
export const imageTextActivityExportCss = css
  .replace(/:global\(([^()]*)\)/g, '$1')
  .replace(/\.(activity|copy|frame|shell)(?![\w-])/g, '.paideia-image-text-$1');
