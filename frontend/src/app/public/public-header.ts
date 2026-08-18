import { afterNextRender, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SITE } from '../../site-config';
import { T } from '../i18n';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, RouterLinkActive],
  template: `<header><a class="brand" routerLink="/"><span class="mark"><i></i><i></i><i></i></span><b>{{t.brand}}</b></a><nav><a routerLink="/" [routerLinkActiveOptions]="{exact:true}" routerLinkActive="active">{{t.nav.feed}}</a><a routerLink="/archive" routerLinkActive="active">{{t.nav.archive}}</a><a routerLink="/people" routerLinkActive="active">{{t.nav.people}}</a><a routerLink="/about" routerLinkActive="active">{{t.nav.about}}</a></nav><a class="lang" [href]="site.other.href" [title]="site.other.title">{{site.other.label}}</a></header>@if(hint()){<aside class="lang-hint"><span>{{t.langHint.text}}</span><a [href]="site.other.href">{{t.langHint.action}}</a><button type="button" (click)="dismiss()">{{t.langHint.dismiss}}</button></aside>}`,
  styles: [`:host{display:block;height:60px}header{position:fixed;z-index:40;top:0;left:0;right:0;height:60px;box-sizing:border-box;padding:0 4vw;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid var(--border-subtle);background:rgb(16 17 20 / 94%);backdrop-filter:blur(16px)}.brand{justify-self:start;display:flex;align-items:center;gap:10px;color:var(--text-primary);text-decoration:none;font:800 13px var(--sans);letter-spacing:.11em}.mark{width:21px;height:21px;display:grid;grid-template-columns:repeat(3,1fr);align-items:end;gap:2px;transform:skew(-7deg)}.mark i{height:55%;background:var(--action-primary)}.mark i:nth-child(2){height:100%}.mark i:nth-child(3){height:75%}nav{grid-column:2;display:flex;height:100%;gap:28px}nav a{height:100%;display:grid;place-items:center;position:relative;color:var(--text-muted);text-decoration:none;font-size:12px}nav a.active,nav a:hover{color:var(--text-primary)}.lang{grid-column:3;justify-self:end;color:var(--text-muted);text-decoration:none;font:700 11px var(--sans);letter-spacing:.08em;border:1px solid var(--border-subtle);padding:5px 9px}.lang:hover{color:var(--text-primary)}nav a.active:after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--action-primary)}@media(max-width:650px){:host{height:88px}header{height:88px;padding:4px 16px;display:flex;align-items:stretch;gap:0;flex-direction:column}.lang{position:absolute;top:6px;right:16px;min-height:40px;display:flex;align-items:center}.brand{font-size:12px;min-height:40px;flex:0 0 40px}nav{height:40px;flex:0 0 40px;width:100%;gap:20px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none}nav::-webkit-scrollbar{display:none}nav a{height:40px;white-space:nowrap;font-size:13px;padding:0 2px}.lang{font-size:12px;padding:7px 11px}}
.lang-hint{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:9px 4vw;border-bottom:1px solid var(--border-subtle);background:#171a21;color:var(--text-muted);font-size:11px}.lang-hint a{color:var(--action-primary);text-decoration:none;font-weight:700}.lang-hint a:hover{text-decoration:underline}.lang-hint button{margin-left:auto;border:0;background:transparent;color:var(--text-muted);font-size:10px;cursor:pointer;padding:2px 4px}.lang-hint button:hover{color:var(--text-primary)}@media(max-width:650px){.lang-hint{padding:9px 20px;gap:10px}.lang-hint button{margin-left:0}}`],
})
export class PublicHeader {
  protected readonly t = T;
  protected readonly site = SITE;
  protected readonly hint = signal(false);
  private static readonly storageKey = 'lang-hint-dismissed';

  constructor() {
    // Только после гидратации: на сервере языка браузера нет, а разметка
    // должна совпасть с той, что отрисовал SSR.
    afterNextRender(() => {
      if (this.stored()) return;
      const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
      const prefers = languages.map(value => value.toLowerCase().split('-')[0]);
      const other = SITE.other.lang;
      // Предлагаем соседнюю версию, только если она в списке предпочтений выше текущей.
      const otherIndex = prefers.indexOf(other);
      const ownIndex = prefers.indexOf(SITE.lang);
      this.hint.set(otherIndex !== -1 && (ownIndex === -1 || otherIndex < ownIndex));
    });
  }

  protected dismiss(): void {
    this.hint.set(false);
    try { localStorage.setItem(PublicHeader.storageKey, '1'); } catch { /* приватный режим */ }
  }

  private stored(): boolean {
    try { return localStorage.getItem(PublicHeader.storageKey) === '1'; } catch { return false; }
  }
}
