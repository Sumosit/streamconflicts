
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/en/',
  locale: undefined,
  routes: [
  {
    "renderMode": 0,
    "preload": [
      "chunk-UL7E3OOS.js"
    ],
    "route": "/en"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-FQRJYIR4.js"
    ],
    "route": "/en/conflicts/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-CJS6V62E.js"
    ],
    "route": "/en/archive"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-3KPTKJDC.js"
    ],
    "route": "/en/people"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-33OBFI3X.js"
    ],
    "route": "/en/people/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-GGK3IMV2.js"
    ],
    "route": "/en/about"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-GGK3IMV2.js"
    ],
    "route": "/en/rules"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-YANICBY7.js"
    ],
    "route": "/en/editor"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-YNYUSK56.js"
    ],
    "route": "/en/editor/login"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-XLFBKERE.js"
    ],
    "route": "/en/editor/import"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-MAHWJBRU.js"
    ],
    "route": "/en/editor/conflicts/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-MAHWJBRU.js"
    ],
    "route": "/en/editor/conflicts/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-FQRJYIR4.js"
    ],
    "route": "/en/editor/conflicts/*/preview"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-DBJJHLVN.js"
    ],
    "route": "/en/editor/corrections"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-67ZH352A.js"
    ],
    "route": "/en/editor/submissions"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-WVZUQSYT.js"
    ],
    "route": "/en/editor/analytics"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-ON325JWW.js"
    ],
    "route": "/en/editor/people"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-OFWRTXVI.js"
    ],
    "route": "/en/editor/people/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-OFWRTXVI.js"
    ],
    "route": "/en/editor/people/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-Y4JJNUSA.js"
    ],
    "route": "/en/editor/pages/about"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-Y4JJNUSA.js"
    ],
    "route": "/en/editor/pages/rules"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-YS7CJVRY.js"
    ],
    "route": "/en/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 3434, hash: '0d7304cf02eada31797255898611ed09003a49cecf0d14935c4f659e6d51a1aa', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2522, hash: 'eb97ffdc2e1a3fa3ee11f3cb35d297eb72348a86c0652bf3839ae871aabab33a', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-4R6JCEQJ.css': {size: 2628, hash: 'dO/l0fupjls', text: () => import('./assets-chunks/styles-4R6JCEQJ_css.mjs').then(m => m.default)}
  },
};
