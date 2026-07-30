export function stripViteDevOnlyModuleImports(html: string): string {
  return html
    .replace(/^\s*import\s+['"](?:\/@vite\/client|@vitejs\/plugin-react\/preamble)['"];\s*$/gmu, '')
    .replace(/\n\s*<script\s+type=["']module["']>\s*<\/script>\s*/gu, '\n');
}
