
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
      "chunk-BBDZP25Y.js"
    ],
    "route": "/en/conflicts/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-SXCLZQUK.js"
    ],
    "route": "/en/archive"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-BZECE66K.js",
      "chunk-3JLHITOT.js"
    ],
    "route": "/en/history"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-K4W5ILVE.js",
      "chunk-3JLHITOT.js"
    ],
    "route": "/en/history/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-JHV4MQ5D.js"
    ],
    "route": "/en/people"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-HE3BC5UB.js"
    ],
    "route": "/en/people/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-GOG53UOO.js"
    ],
    "route": "/en/about"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-GOG53UOO.js"
    ],
    "route": "/en/rules"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-XZFUXZ4Z.js"
    ],
    "route": "/en/editor"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-DDAWCV7D.js"
    ],
    "route": "/en/editor/login"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-ZWF2TF4V.js"
    ],
    "route": "/en/editor/import"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-WY27BYKJ.js"
    ],
    "route": "/en/editor/conflicts/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-WY27BYKJ.js"
    ],
    "route": "/en/editor/conflicts/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-BBDZP25Y.js"
    ],
    "route": "/en/editor/conflicts/*/preview"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-KI7GNKSJ.js"
    ],
    "route": "/en/editor/history"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-G6DERKCZ.js"
    ],
    "route": "/en/editor/history/categories"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-XV4HZMHZ.js"
    ],
    "route": "/en/editor/history/research"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-UCKWRZNI.js"
    ],
    "route": "/en/editor/history/import"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-3XCXXURJ.js"
    ],
    "route": "/en/editor/history/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-3XCXXURJ.js"
    ],
    "route": "/en/editor/history/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-C2AHPCAS.js"
    ],
    "route": "/en/editor/corrections"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-SGE3SXWP.js"
    ],
    "route": "/en/editor/submissions"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-UNSRVQRQ.js"
    ],
    "route": "/en/editor/analytics"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-S5L6KACT.js"
    ],
    "route": "/en/editor/people"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-GD6W5BJH.js"
    ],
    "route": "/en/editor/people/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-GD6W5BJH.js"
    ],
    "route": "/en/editor/people/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-IJJGXUIM.js"
    ],
    "route": "/en/editor/pages/about"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-IJJGXUIM.js"
    ],
    "route": "/en/editor/pages/rules"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-WXHALYOH.js"
    ],
    "route": "/en/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 3434, hash: '66d4675fd628972e00972998a3783d1a3767888b77b3b3eb0bdcc57afa95f27a', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2522, hash: '05d936db806912c92ab8b5126dcbded608359923d6fdb289e01b0c816e46bad8', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-4R6JCEQJ.css': {size: 2628, hash: 'dO/l0fupjls', text: () => import('./assets-chunks/styles-4R6JCEQJ_css.mjs').then(m => m.default)}
  },
};
