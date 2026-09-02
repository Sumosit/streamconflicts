
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
      "chunk-X2BCZYZ5.js",
      "chunk-3JLHITOT.js"
    ],
    "route": "/en/history"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-R77EFJVX.js",
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
    'index.csr.html': {size: 3434, hash: '371e7852b5b7dc193da23517de972da233b34fa04fc81237450065a6170257e9', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2522, hash: 'b5a77cf313452b7e3bf502d5be256bdc0d161b4a3b65534d9a1178a006a08f1d', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-4R6JCEQJ.css': {size: 2628, hash: 'dO/l0fupjls', text: () => import('./assets-chunks/styles-4R6JCEQJ_css.mjs').then(m => m.default)}
  },
};
