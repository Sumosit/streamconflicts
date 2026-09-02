import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService, ConflictDto } from '../api.service';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';
import { SeoService } from '../seo.service';
import { T, statusLabel } from '../i18n';

const PER_PAGE = 10;

@Component({selector:'app-archive-page',imports:[FormsModule,RouterLink,PublicHeader,PublicFooter,DatePipe],template:`
<app-public-header/><main class="page"><span class="kicker">{{t.archive.kicker}}</span><h1>{{t.archive.title}}</h1><p class="lead">{{t.archive.lead}}</p>
<div class="toolbar"><input class="search" type="search" [ngModel]="query()" (ngModelChange)="onQuery($event)" [placeholder]="t.archive.searchPlaceholder"><div class="filters">@for(filter of filters;track filter.key){<button [class.active]="active()===filter.key" (click)="onStatus(filter.key)">{{filter.label}}</button>}</div></div>
@if(total()){<div class="archive-head"><p class="archive-count">{{t.archive.found}}: {{total()}}</p>@if(pages()>1){<nav class="pager pager--compact" [attr.aria-label]="t.archive.pagination"><button type="button" (click)="goTo(page()-1)" [disabled]="page()===1" [attr.aria-label]="t.archive.prev">‹</button><span class="pager-status">{{page()}} / {{pages()}}</span><button type="button" (click)="goTo(page()+1)" [disabled]="page()===pages()" [attr.aria-label]="t.archive.next">›</button></nav>}</div>}
<section class="list">@for(item of items();track item.id){<a class="card archive-card" [class.with-cover]="cover(item)" [routerLink]="['/conflicts',item.slug]">@if(cover(item)){<img class="archive-card-cover" [src]="cover(item)" [alt]="item.title" loading="lazy"><div class="archive-card-shade"></div>}<div class="archive-card-copy"><span class="kicker">{{item.category}} · {{statusLabel(item.status)}}</span><h3>{{item.title}}</h3><p>{{item.summary}}</p><div class="meta"><span>{{item.events.length}} {{t.units.events}}</span><span>{{sourceCount(item)}} {{t.units.sources}}</span><span>{{lastEventAt(item)|date:'dd.MM.yyyy'}}</span></div></div><span class="arrow">↗</span></a>}@empty{<div class="empty">{{loading()?t.about.loading:t.archive.empty}}</div>}</section>
@if(pages()>1){<nav class="pager" [attr.aria-label]="t.archive.pagination"><button type="button" (click)="goTo(page()-1)" [disabled]="page()===1">{{t.archive.prev}}</button>@for(number of pageNumbers();track number){@if(number===0){<span class="pager-gap">…</span>}@else{<button type="button" [class.active]="number===page()" (click)="goTo(number)">{{number}}</button>}}<button type="button" (click)="goTo(page()+1)" [disabled]="page()===pages()">{{t.archive.next}}</button></nav>}
</main><app-public-footer/>`,styleUrl:'./public-pages.scss'})
export class ArchivePage{
 private readonly api=inject(ApiService);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly seo=inject(SeoService);
 private readonly queryInput=new Subject<string>();
 protected readonly t=T;
 protected readonly items=signal<ConflictDto[]>([]);
 protected readonly total=signal(0);
 protected readonly page=signal(1);
 protected readonly query=signal('');
 protected readonly active=signal('all');
 protected readonly loading=signal(true);
 protected readonly filters=[{key:'all',label:T.archive.filterAll},{key:'developing',label:T.status.developing},{key:'quiet',label:T.status.quiet},{key:'closed',label:T.status.closed}];

 constructor(){
  // Поиск и фильтры живут в адресе: страницу можно переслать и вернуться назад.
  this.route.queryParamMap.subscribe(params=>{
   this.page.set(Math.max(1,Number(params.get('page'))||1));
   this.query.set(params.get('q')||'');
   this.active.set(params.get('status')||'all');
   this.load();
  });
  this.queryInput.pipe(debounceTime(350),distinctUntilChanged()).subscribe(value=>this.navigate({q:value||null,page:null}));
 }

 protected pages():number{return Math.max(1,Math.ceil(this.total()/PER_PAGE));}
 /** Номера страниц с многоточиями; 0 отмечает пропуск. */
 protected pageNumbers():number[]{
  const last=this.pages(),current=this.page();
  if(last<=7)return Array.from({length:last},(_,index)=>index+1);
  const numbers=new Set([1,last,current,current-1,current+1]);
  const visible=[...numbers].filter(value=>value>=1&&value<=last).sort((a,b)=>a-b);
  const result:number[]=[];
  visible.forEach((value,index)=>{if(index&&value-visible[index-1]>1)result.push(0);result.push(value);});
  return result;
 }
 protected onQuery(value:string):void{this.query.set(value);this.queryInput.next(value);}
 protected onStatus(key:string):void{this.navigate({status:key==='all'?null:key,page:null});}
 protected goTo(page:number):void{if(page<1||page>this.pages())return;this.navigate({page:page===1?null:page});window.scrollTo({top:0,behavior:'smooth'});}
 private navigate(params:Record<string,string|number|null>):void{
  void this.router.navigate([],{relativeTo:this.route,queryParams:params,queryParamsHandling:'merge'});
 }
 private load():void{
  this.loading.set(true);
  this.api.conflictsPage({page:this.page(),perPage:PER_PAGE,query:this.query(),status:this.active()}).subscribe({
   next:result=>{this.items.set(result.items);this.total.set(result.total);this.loading.set(false);this.applySeo();},
   error:()=>{this.items.set([]);this.total.set(0);this.loading.set(false);},
  });
 }
 private applySeo():void{
  // Страницы со второй и дальше закрыты от индексации: содержимое меняется,
  // а ценность для поиска несут карточки материалов, а не сама выборка.
  const paged=this.page()>1||Boolean(this.query());
  this.seo.set({
   title:paged?`${T.archive.seoTitle} - ${T.archive.pageLabel} ${this.page()}`:T.archive.seoTitle,
   description:T.archive.seoDescription,
   path:'/archive',
   noindex:paged,
  });
 }
 protected cover(item:ConflictDto):string|null{return item.cover_image_url||item.events.flatMap(event=>event.sources).find(source=>source.thumbnail_url)?.thumbnail_url||null}
 protected sourceCount(item:ConflictDto):number{return item.events.reduce((count,event)=>count+event.sources.length,0)}
 /** Дата последнего события: она же определяет порядок старых материалов. */
 protected lastEventAt(item:ConflictDto):string{
  const dates=item.events.map(event=>event.occurred_at).filter((value):value is string=>Boolean(value));
  return dates.length?dates.reduce((latest,value)=>value>latest?value:latest):item.updated_at;
 }
 protected statusLabel(value:string):string{return statusLabel(value)}
}
