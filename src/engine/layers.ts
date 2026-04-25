export type LayerType = 'api' | 'auth' | 'frontend' | 'database' | 'core';

const LAYER_PATTERNS: Record<LayerType, RegExp[]> = {
  api: [/app\/api\//, /\/route\.ts$/, /\/handler\.ts$/, /\/api\//],
  auth: [/\/auth\//, /auth\.ts$/, /\/middleware\.ts$/, /\/session\//],
  frontend: [/\/page\.tsx$/, /\/page\.ts$/, /\/components\//, /\.tsx$/, /\/ui\//],
  database: [/\/db\//, /\/schema/, /\/queries?/, /\/migrations?\//, /\.sql$/],
  core: [/\/lib\//, /\/utils?/, /\/types?/, /\/config\//, /\/constants?/],
};

export function detectLayers(filePaths: string[]): LayerType[] {
  const detected = new Set<LayerType>();

  for (const path of filePaths) {
    for (const [layer, patterns] of Object.entries(LAYER_PATTERNS) as [LayerType, RegExp[]][]) {
      for (const pattern of patterns) {
        if (pattern.test(path)) {
          detected.add(layer);
          break;
        }
      }
    }
  }

  return Array.from(detected);
}

export function detectLayerForFile(filePath: string): LayerType | null {
  return detectLayers([filePath])[0] || null;
}
