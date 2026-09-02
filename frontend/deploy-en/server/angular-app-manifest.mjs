
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/en/',
  locale: undefined,
  routes: [
  {
    "renderMode": 0,
    "preload": [
      "chunk-44NDOYZK.js"
    ],
    "route": "/en"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-7CJQ4IWX.js"
    ],
    "route": "/en/conflicts/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-XX2CXADS.js"
    ],
    "route": "/en/archive"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-XR4DIKH5.js",
      "chunk-OTG4YEEP.js"
    ],
    "route": "/en/history"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-OHJPZI66.js",
      "chunk-OTG4YEEP.js"
    ],
    "route": "/en/history/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-PWRQX6IK.js"
    ],
    "route": "/en/people"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-FBPBZLXR.js"
    ],
    "route": "/en/people/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-YFVZUDH5.js"
    ],
    "route": "/en/about"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-YFVZUDH5.js"
    ],
    "route": "/en/rules"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-ASTPRLBU.js"
    ],
    "route": "/en/editor"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-KXE43ZMU.js"
    ],
    "route": "/en/editor/login"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-WBLS6MRM.js"
    ],
    "route": "/en/editor/import"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-DX3LZYOG.js"
    ],
    "route": "/en/editor/conflicts/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-DX3LZYOG.js"
    ],
    "route": "/en/editor/conflicts/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-7CJQ4IWX.js"
    ],
    "route": "/en/editor/conflicts/*/preview"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-VAR4PX63.js"
    ],
    "route": "/en/editor/history"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-I62S4UWL.js"
    ],
    "route": "/en/editor/history/research"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-IGSJXVCO.js"
    ],
    "route": "/en/editor/history/import"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-EVMSHBAE.js"
    ],
    "route": "/en/editor/history/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-EVMSHBAE.js"
    ],
    "route": "/en/editor/history/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-VRE3UDNF.js"
    ],
    "route": "/en/editor/corrections"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-YGSFP656.js"
    ],
    "route": "/en/editor/submissions"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-MMPBJXEU.js"
    ],
    "route": "/en/editor/analytics"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-IARP2QWC.js"
    ],
    "route": "/en/editor/people"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-3HC3LVYV.js"
    ],
    "route": "/en/editor/people/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-3HC3LVYV.js"
    ],
    "route": "/en/editor/people/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-OAMUYHTG.js"
    ],
    "route": "/en/editor/pages/about"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-OAMUYHTG.js"
    ],
    "route": "/en/editor/pages/rules"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-V67TLQFR.js"
    ],
    "route": "/en/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 3434, hash: '7c3b8743caaea489c23e52591198d226af4a6064387d6eb034a36e204851de04', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2522, hash: '402b8ff88151985fefe7e210a0b81fd4cb5ac2690aba726238a47e671de979f8', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-4R6JCEQJ.css': {size: 2628, hash: 'dO/l0fupjls', text: () => import('./assets-chunks/styles-4R6JCEQJ_css.mjs').then(m => m.default)}
  },
};
