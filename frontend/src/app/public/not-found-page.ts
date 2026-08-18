import { Component, inject, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';
import { SeoService } from '../seo.service';
import { T } from '../i18n';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, PublicHeader, PublicFooter],
  template: `<app-public-header/><main class="page"><span class="kicker">{{t.notFound.code}}</span><h1>{{t.notFound.title}}</h1><p class="lead">{{t.notFound.text}}</p><div class="filters"><a class="back" routerLink="/">{{t.notFound.home}}</a><a class="back" routerLink="/archive">{{t.notFound.archive}}</a></div></main><app-public-footer/>`,
  styleUrl: './public-pages.scss',
})
export class NotFoundPage {
  protected readonly t = T;
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  constructor() {
    // На сервере отдаём именно 404, иначе поисковик сочтёт страницу рабочей.
    if (this.responseInit) this.responseInit.status = 404;
    inject(SeoService).set({
      title: `${T.notFound.title} - ${T.brand}`,
      description: T.notFound.text,
      path: '/404',
      noindex: true,
    });
  }
}
