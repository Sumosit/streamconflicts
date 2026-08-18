import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { T } from '../i18n';

@Component({
  selector: 'app-public-footer',
  imports: [RouterLink],
  // Ссылки вынесены из абзаца с подписью: на мобильных подпись скрывается,
  // а ссылки должны оставаться — по мобильной версии идёт индексация.
  template: `<footer><a class="brand" routerLink="/"><span class="mark"><i></i><i></i><i></i></span><span>{{t.brand}}</span></a><nav class="footer-links"><a routerLink="/rules">{{t.rules.kicker}}</a><a routerLink="/about">{{t.nav.about}}</a></nav><p>{{t.footer.tagline}}</p><span>© 2026</span></footer>`,
  styles: [`:host{display:block;margin-top:auto}footer{min-height:52px;box-sizing:border-box;border-top:1px solid var(--border-subtle);padding:11px 4vw;display:grid;grid-template-columns:auto 1fr auto;gap:14px 24px;align-items:center;color:var(--text-muted);font-size:9px}.brand{justify-self:start;display:flex;align-items:center;gap:9px;color:var(--text-muted);text-decoration:none;font:700 11px var(--sans);letter-spacing:.1em}.mark{width:18px;height:18px;display:grid;grid-template-columns:repeat(3,1fr);align-items:end;gap:2px;transform:skew(-7deg)}.mark i{height:55%;background:var(--action-primary);opacity:.6}.mark i:nth-child(2){height:100%}.mark i:nth-child(3){height:75%}.footer-links{display:flex;gap:16px}.footer-links a{color:inherit;text-decoration:none;border-bottom:1px solid var(--border-subtle)}.footer-links a:hover{color:var(--text-primary)}footer p{margin:0;justify-self:end;grid-column:3}footer>span{justify-self:end;grid-column:4}@media(max-width:900px){footer{grid-template-columns:auto 1fr auto}footer p{display:none}}@media(max-width:650px){footer{grid-template-columns:1fr auto;padding:14px 20px;font-size:11px;row-gap:10px}.brand{font-size:12px;min-height:44px}.footer-links{grid-column:1/-1;order:3;gap:18px;font-size:12px}.footer-links a{min-height:44px;display:inline-flex;align-items:center}}`],
})
export class PublicFooter { protected readonly t = T; }
