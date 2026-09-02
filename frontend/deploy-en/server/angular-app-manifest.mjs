
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
      "chunk-7ROBR2JF.js"
    ],
    "route": "/en/conflicts/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-WZON5ZUF.js"
    ],
    "route": "/en/archive"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-YVA4SQWA.js",
      "chunk-3JLHITOT.js"
    ],
    "route": "/en/history"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-ZOW5ISJN.js",
      "chunk-3JLHITOT.js"
    ],
    "route": "/en/history/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-EGIVKXUR.js"
    ],
    "route": "/en/people"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-4V3YQVVU.js"
    ],
    "route": "/en/people/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-MF4IMJDI.js"
    ],
    "route": "/en/about"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-MF4IMJDI.js"
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
      "chunk-AR24U4UO.js"
    ],
    "route": "/en/editor/conflicts/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-AR24U4UO.js"
    ],
    "route": "/en/editor/conflicts/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-7ROBR2JF.js"
    ],
    "route": "/en/editor/conflicts/*/preview"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-ERDPX6LE.js"
    ],
    "route": "/en/editor/history"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-IEVAOP62.js"
    ],
    "route": "/en/editor/history/research"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-MNONBYV6.js"
    ],
    "route": "/en/editor/history/import"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-4SBLS5Y5.js"
    ],
    "route": "/en/editor/history/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-4SBLS5Y5.js"
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
      "chunk-PN33UYLI.js"
    ],
    "route": "/en/editor/analytics"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-CB5MZP27.js"
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
      "chunk-WXHALYOH.js"
    ],
    "route": "/en/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 3434, hash: '9d60df3c90340b363884dc8d3895044b1f44f7489134d9e6156bda818086e671', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2522, hash: '7a8386e95b3f01617689eae8c1394cff9fc67f92d5d02d9f08cfa720f68471c0', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-4R6JCEQJ.css': {size: 2628, hash: 'dO/l0fupjls', text: () => import('./assets-chunks/styles-4R6JCEQJ_css.mjs').then(m => m.default)}
  },
};
