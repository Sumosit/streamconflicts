
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
      "chunk-7KYDUSUP.js"
    ],
    "route": "/en/conflicts/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-ECEABZ56.js"
    ],
    "route": "/en/archive"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-AJ6AXOCK.js",
      "chunk-OTG4YEEP.js"
    ],
    "route": "/en/history"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-GPT53QEP.js",
      "chunk-OTG4YEEP.js"
    ],
    "route": "/en/history/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-NDDRTULE.js"
    ],
    "route": "/en/people"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-ASLY4JRO.js"
    ],
    "route": "/en/people/*"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-JSOBBRUE.js"
    ],
    "route": "/en/about"
  },
  {
    "renderMode": 0,
    "preload": [
      "chunk-JSOBBRUE.js"
    ],
    "route": "/en/rules"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-NUTI3JAI.js"
    ],
    "route": "/en/editor"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-V4QAPDBS.js"
    ],
    "route": "/en/editor/login"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-LEG5DPHT.js"
    ],
    "route": "/en/editor/import"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-AUNUVPMP.js"
    ],
    "route": "/en/editor/conflicts/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-AUNUVPMP.js"
    ],
    "route": "/en/editor/conflicts/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-7KYDUSUP.js"
    ],
    "route": "/en/editor/conflicts/*/preview"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-G75Z75JG.js"
    ],
    "route": "/en/editor/corrections"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-B64VIBLJ.js"
    ],
    "route": "/en/editor/submissions"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-XORCY7FC.js"
    ],
    "route": "/en/editor/analytics"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-L5XQVXFB.js"
    ],
    "route": "/en/editor/people"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-IY72W6JN.js"
    ],
    "route": "/en/editor/people/new"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-IY72W6JN.js"
    ],
    "route": "/en/editor/people/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-GEX6PMZV.js"
    ],
    "route": "/en/editor/pages/about"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-GEX6PMZV.js"
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
    'index.csr.html': {size: 3434, hash: 'b58d3fb3b9cf82774d0affc89f953d4345d4d75b4490ab6f53ace64306b36caa', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2522, hash: '644d0ba4e8455cae5167c53487ee4c74390652e1a6d88feccf3ede8fd1ea6dc6', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-4R6JCEQJ.css': {size: 2628, hash: 'dO/l0fupjls', text: () => import('./assets-chunks/styles-4R6JCEQJ_css.mjs').then(m => m.default)}
  },
};
