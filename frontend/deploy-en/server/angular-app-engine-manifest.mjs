
export default {
  basePath: '/en',
  allowedHosts: [
  "streamconflicts.com",
  "www.streamconflicts.com",
  "dev.streamconflicts.com",
  "localhost",
  "127.0.0.1"
],
  supportedLocales: {
  "en-US": ""
},
  entryPoints: {
    '': () => import('./main.server.mjs')
  },
};
