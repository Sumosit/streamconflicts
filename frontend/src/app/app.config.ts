import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor, serverUrlInterceptor } from './auth.service';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([serverUrlInterceptor, authInterceptor])),
    // Ответы SSR переигрываются на клиенте без заголовков, а в X-Total-Count
    // приходит общее число материалов для постраничной навигации.
    provideClientHydration(withEventReplay(), withHttpTransferCacheOptions({ includeHeaders: ['X-Total-Count'] }))
  ]
};
