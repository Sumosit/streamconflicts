import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject, REQUEST } from '@angular/core';
import { SITE } from '../site-config';

// localStorage общий для всего домена, а языковые версии живут на одном домене
// и имеют разные базы редакторов. Без разделения ключей вход в один редактор
// затирает сессию другого.
const TOKEN_KEY = SITE.path
  ? `streamconflicts_editor_token_${SITE.lang}`
  : 'streamconflicts_editor_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  get token(): string | null { return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY); }
  get authenticated(): boolean { return Boolean(this.token); }
  save(token: string): void { if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token); }
  clear(): void { if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY); }
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token;
  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);
};

export const serverUrlInterceptor: HttpInterceptorFn = (request, next) => {
  const serverRequest = inject(REQUEST, { optional: true });
  if (request.url.startsWith('/')) {
    const origin = serverRequest
      ? new URL(serverRequest.url).origin
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
    if (!origin) return next(request);
    return next(request.clone({ url: `${origin}${request.url}` }));
  }
  return next(request);
};

export const editorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.authenticated ? true : inject(Router).createUrlTree(['/editor/login']);
};
