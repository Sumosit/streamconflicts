import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService, HistoryCategoryDto, HistoryEventDto } from '../api.service';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';
import { SeoService } from '../seo.service';
import { T } from '../i18n';
import { historyDateLabel } from './history-format';

const PER_PAGE = 20;

@Component({selector:'app-history-page',imports:[FormsModule,RouterLink,PublicHeader,PublicFooter],template:`
<app-public-header/><main class="page history">
<span class="kicker">{{t.history.kicker}}</span><h1>{{heading()}}</h1><p class="lead">{{t.history.lead}}</p>
<div class="history-layout">
<aside class="history-menu" [attr.aria-label]="t.history.menuTitle">
 <span class="history-menu-title">{{t.history.menuTitle}}</span>
 <button type="button" class="history-branch history-root" [class.active]="!category()" (click)="selectCategory(null)">{{t.history.allEvents}}<small>{{totalAll()}}</small></button>
 @for(node of tree();track node.id){<div class="history-node">
  <div class="history-branch" [class.active]="category()===node.slug">
   @if(node.children.length){<button type="button" class="history-toggle" [class.open]="isOpen(node.slug)" (click)="toggle(node.slug)" [attr.aria-expanded]="isOpen(node.slug)" [attr.aria-label]="node.title">▸</button>}@else{<span class="history-toggle history-toggle--leaf"></span>}
   <button type="button" class="history-label" (click)="selectCategory(node.slug)">{{node.title}}</button><small>{{node.event_count}}</small>
  </div>
  @if(node.children.length&&isOpen(node.slug)){<div class="history-children">@for(child of node.children;track child.id){<div class="history-node">
   <div class="history-branch" [class.active]="category()===child.slug">
    @if(child.children.length){<button type="button" class="history-toggle" [class.open]="isOpen(child.slug)" (click)="toggle(child.slug)" [attr.aria-expanded]="isOpen(child.slug)" [attr.aria-label]="child.title">▸</button>}@else{<span class="history-toggle history-toggle--leaf"></span>}
    <button type="button" class="history-label" (click)="selectCategory(child.slug)">{{child.title}}</button><small>{{child.event_count}}</small>
   </div>
   @if(child.children.length&&isOpen(child.slug)){<div class="history-children">@for(leaf of child.children;track leaf.id){
    <div class="history-branch" [class.active]="category()===leaf.slug"><span class="history-toggle history-toggle--leaf"></span><button type="button" class="history-label" (click)="selectCategory(leaf.slug)">{{leaf.title}}</button><small>{{leaf.event_count}}</small></div>}</div>}
  </div>}</div>}
 </div>}
</aside>
<section class="history-content">
 <div class="toolbar"><input class="search" type="search" [ngModel]="query()" (ngModelChange)="onQuery($event)" [placeholder]="t.history.searchPlaceholder"></div>
 <div class="history-filters">
  <div class="filters">@for(item of regions;track item.key){<button type="button" [class.active]="region()===item.key" (click)="patch({region:item.key==='all'?null:item.key,page:null})">{{item.label}}</button>}</div>
  <div class="filters">@for(item of decades();track item.key){<button type="button" [class.active]="decade()===item.key" (click)="patch({decade:item.key==='all'?null:item.key,page:null})">{{item.label}}</button>}</div>
  <label class="history-check"><input type="checkbox" [ngModel]="withImages()" (ngModelChange)="patch({images:$event?'1':null,page:null})">{{t.history.withImages}}</label>
  @if(dirty()){<button type="button" class="history-reset" (click)="reset()">{{t.history.reset}}</button>}
 </div>
 @if(total()){<p class="history-count">{{t.history.found}}: {{total()}}</p>}
 <div class="list">@for(item of items();track item.id){
  <a class="card history-card" [routerLink]="['/history',item.slug]">
   <div>
    <span class="kicker">{{dateLabel(item)}}@if(item.category_title){ · {{item.category_title}}}</span>
    <h3>{{item.title}}</h3><p>{{item.summary}}</p>
    @if(item.translation_missing){<p class="history-untranslated">{{t.history.translationMissing}}</p>}
   </div><span class="arrow">↗</span>
  </a>}@empty{<div class="empty">{{loading()?t.history.loading:t.history.empty}}</div>}</div>
 @if(pages()>1){<nav class="pager" [attr.aria-label]="t.history.pagination"><button type="button" (click)="goTo(page()-1)" [disabled]="page()===1">{{t.history.prev}}</button><span class="pager-status">{{page()}} / {{pages()}}</span><button type="button" (click)="goTo(page()+1)" [disabled]="page()===pages()">{{t.history.next}}</button></nav>}
</section>
</div></main><app-public-footer/>`,styleUrls:['./public-pages.scss','./history.scss']})
export class HistoryPage{
 private readonly api=inject(ApiService);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly seo=inject(SeoService);
 private readonly queryInput=new Subject<string>();
 protected readonly t=T;
 protected readonly tree=signal<HistoryCategoryDto[]>([]);
 protected readonly items=signal<HistoryEventDto[]>([]);
 protected readonly years=signal<number[]>([]);
 protected readonly total=signal(0);
 protected readonly totalAll=signal(0);
 protected readonly page=signal(1);
 protected readonly query=signal('');
 protected readonly category=signal<string|null>(null);
 protected readonly region=signal('all');
 protected readonly decade=signal('all');
 protected readonly withImages=signal(false);
 protected readonly loading=signal(true);
 protected readonly open=signal<Set<string>>(new Set());
 protected readonly regions=[
  {key:'all',label:T.history.regionAll},
  {key:'global',label:T.history.regionGlobal},
  {key:'ru',label:T.history.regionRu},
  {key:'en',label:T.history.regionEn},
 ];

 /** Декады строим по годам, за которые события реально есть. */
 protected readonly decades=computed(()=>{
  const buckets=[...new Set(this.years().map(year=>Math.floor(year/10)*10))].sort((a,b)=>a-b);
  return [{key:'all',label:T.history.periodAll},...buckets.map(start=>({key:String(start),label:`${start}-${start+9}`}))];
 });
 protected readonly dirty=computed(()=>Boolean(this.query())||this.region()!=='all'||this.decade()!=='all'||this.withImages()||Boolean(this.category()));

 constructor(){
  this.api.historyCategories().subscribe(nodes=>{this.tree.set(nodes);this.expandTo(this.category());});
  this.api.historyYears().subscribe(years=>this.years.set(years));
  // Счётчик «Все события» считаем отдельным запросом: при входе по ссылке с
  // фильтром общий список не загружается, и брать число из него нельзя.
  this.api.historyEvents({perPage:1}).subscribe(result=>this.totalAll.set(result.total));
  // Фильтры живут в адресе: раздел можно переслать ссылкой и вернуться назад.
  this.route.queryParamMap.subscribe(params=>{
   this.page.set(Math.max(1,Number(params.get('page'))||1));
   this.query.set(params.get('q')||'');
   this.category.set(params.get('category'));
   this.region.set(params.get('region')||'all');
   this.decade.set(params.get('decade')||'all');
   this.withImages.set(params.get('images')==='1');
   this.expandTo(this.category());
   this.load();
  });
  this.queryInput.pipe(debounceTime(350),distinctUntilChanged()).subscribe(value=>this.patch({q:value||null,page:null}));
 }

 protected heading():string{
  const current=this.findNode(this.category());
  return current?current.title:T.history.title;
 }
 protected dateLabel(item:HistoryEventDto):string{return historyDateLabel(item.date_start,item.date_precision);}
 protected pages():number{return Math.max(1,Math.ceil(this.total()/PER_PAGE));}
 protected isOpen(slug:string):boolean{return this.open().has(slug);}
 protected toggle(slug:string):void{
  const next=new Set(this.open());
  next.has(slug)?next.delete(slug):next.add(slug);
  this.open.set(next);
 }
 protected selectCategory(slug:string|null):void{
  if(slug)this.expandTo(slug);
  this.patch({category:slug,page:null});
 }
 protected reset():void{
  void this.router.navigate([],{relativeTo:this.route,queryParams:{}});
 }
 protected onQuery(value:string):void{this.query.set(value);this.queryInput.next(value);}
 protected goTo(page:number):void{if(page<1||page>this.pages())return;this.patch({page:page===1?null:page});window.scrollTo({top:0,behavior:'smooth'});}

 protected patch(params:Record<string,string|number|null>):void{
  void this.router.navigate([],{relativeTo:this.route,queryParams:params,queryParamsHandling:'merge'});
 }

 /** Раскрывает ветку до выбранного раздела, иначе выбор из ссылки не виден. */
 private expandTo(slug:string|null):void{
  if(!slug||!this.tree().length)return;
  const path:string[]=[];
  const walk=(nodes:HistoryCategoryDto[],trail:string[]):boolean=>nodes.some(node=>{
   const next=[...trail,node.slug];
   if(node.slug===slug){path.push(...trail);return true;}
   return walk(node.children,next);
  });
  walk(this.tree(),[]);
  if(!path.length)return;
  const opened=new Set(this.open());
  path.forEach(item=>opened.add(item));
  this.open.set(opened);
 }

 private findNode(slug:string|null):HistoryCategoryDto|null{
  if(!slug)return null;
  const walk=(nodes:HistoryCategoryDto[]):HistoryCategoryDto|null=>{
   for(const node of nodes){
    if(node.slug===slug)return node;
    const found=walk(node.children);
    if(found)return found;
   }
   return null;
  };
  return walk(this.tree());
 }

 private load():void{
  this.loading.set(true);
  const decade=this.decade()==='all'?null:Number(this.decade());
  this.api.historyEvents({
   page:this.page(),perPage:PER_PAGE,category:this.category(),region:this.region(),
   query:this.query(),withImages:this.withImages(),
   yearFrom:decade,yearTo:decade===null?null:decade+9,
  }).subscribe({
   next:result=>{
    this.items.set(result.items);
    this.total.set(result.total);
    this.loading.set(false);
    this.applySeo();
   },
   error:()=>{this.items.set([]);this.total.set(0);this.loading.set(false);},
  });
 }

 private applySeo():void{
  // Выборки с фильтрами закрыты от индексации: ценность для поиска несут
  // страницы событий, а не конкретная комбинация параметров.
  const filtered=this.page()>1||this.dirty();
  const current=this.findNode(this.category());
  this.seo.set({
   title:current?`${current.title} - ${T.history.seoTitle}`:T.history.seoTitle,
   description:T.history.seoDescription,
   path:'/history',
   noindex:filtered&&!this.category(),
  });
 }
}
