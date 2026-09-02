import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService, HistoryAdminRowDto, HistoryCategoryAdminDto } from '../api.service';

const PER_PAGE = 30;

@Component({selector:'app-editor-history-list',imports:[FormsModule,RouterLink],template:`<main class="editor-shell">
<header class="editor-header"><a routerLink="/editor"><b>← Материалы</b></a><nav><a routerLink="/editor/history/research" class="button">Очередь исследования</a><a routerLink="/editor/history/import" class="button">Импорт JSON</a><a class="button primary" routerLink="/editor/history/new">Новое событие</a></nav></header>
<div class="section-head"><div><h1>История стриминга</h1><p class="muted">События хранятся в одном экземпляре, тексты RU и EN — переводы одного события.</p></div><span>{{total()}}</span></div>

<section class="panel">
 <div class="people-io-row">
  <label>Поиск<input type="search" [ngModel]="query()" (ngModelChange)="onQuery($event)" placeholder="Название или slug"></label>
  <label>Статус<select [ngModel]="status()" (ngModelChange)="patch({status:$event||null,page:null})"><option value="">Любой</option><option value="draft">Черновик</option><option value="review">На проверке</option><option value="published">Опубликовано</option><option value="rejected">Отклонено</option></select></label>
  <label>Регион<select [ngModel]="region()" (ngModelChange)="patch({region:$event||null,page:null})"><option value="">Любой</option><option value="global">Мировые</option><option value="ru">Рунет</option><option value="en">Зарубежные</option><option value="other">Другое</option></select></label>
  <label>Раздел<select [ngModel]="categoryId()" (ngModelChange)="patch({category:$event||null,page:null})"><option value="">Любой</option>@for(item of categories();track item.id){<option [value]="item.id">{{item.path}}</option>}</select></label>
 </div>
 <div class="people-io-row">
  <label class="history-check"><input type="checkbox" [ngModel]="noRu()" (ngModelChange)="patch({no_ru:$event?'1':null,page:null})"> Нет RU-перевода</label>
  <label class="history-check"><input type="checkbox" [ngModel]="noEn()" (ngModelChange)="patch({no_en:$event?'1':null,page:null})"> Нет EN-перевода</label>
  <label class="history-check"><input type="checkbox" [ngModel]="noSources()" (ngModelChange)="patch({no_sources:$event?'1':null,page:null})"> Без источников</label>
  <label class="history-check"><input type="checkbox" [ngModel]="noImages()" (ngModelChange)="patch({no_images:$event?'1':null,page:null})"> Без изображений</label>
  <label class="history-check"><input type="checkbox" [ngModel]="toVerify()" (ngModelChange)="patch({verify:$event?'1':null,page:null})"> Требуют проверки</label>
  @if(dirty()){<button class="button" type="button" (click)="reset()">Сбросить</button>}
 </div>
</section>

<section class="list">
 @for(item of items();track item.id){
  <article class="list-row">
   <div>
    <span class="badge">{{dateLabel(item)}} · {{regionLabel(item.region)}} · {{statusLabel(item.status)}}@if(item.needs_verification){ · ТРЕБУЕТ ПРОВЕРКИ}</span>
    <h3>{{item.title}}</h3>
    <span class="muted">{{item.slug}}@if(item.category_title){ · {{item.category_title}}}</span>
    <p class="muted history-row-meta">
     <span [class.warn]="!item.ru_status">RU: {{item.ru_status||'нет'}}</span>
     <span [class.warn]="!item.en_status">EN: {{item.en_status||'нет'}}</span>
     <span [class.warn]="item.source_count<2">источников: {{item.source_count}}</span>
     <span [class.warn]="!item.image_count">изображений: {{item.image_count}}</span>
     <span>людей: {{item.people_count}}</span>
    </p>
   </div>
   <div class="actions">
    <a class="button" [routerLink]="['/editor/history',item.id]">Редактировать</a>
    <button class="button danger" type="button" (click)="remove(item)"
            [disabled]="item.is_published||busy()===item.id"
            [title]="item.is_published?'Сначала снимите событие с публикации в карточке':'Удалить событие'">Удалить</button>
   </div>
  </article>
 }@empty{<div class="panel">{{loading()?'Загружаем...':'Событий по заданным условиям нет.'}}</div>}
</section>

@if(error()){<p class="error">{{error()}}</p>}
@if(pages()>1){<div class="people-io-row"><button class="button" type="button" (click)="goTo(page()-1)" [disabled]="page()===1">← Назад</button><span class="muted">{{page()}} / {{pages()}}</span><button class="button" type="button" (click)="goTo(page()+1)" [disabled]="page()===pages()">Вперёд →</button></div>}
</main>`,styleUrl:'./editor.scss'})
export class EditorHistoryList{
 private readonly api=inject(ApiService);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly queryInput=new Subject<string>();
 protected readonly items=signal<HistoryAdminRowDto[]>([]);
 protected readonly categories=signal<HistoryCategoryAdminDto[]>([]);
 protected readonly total=signal(0);
 protected readonly page=signal(1);
 protected readonly loading=signal(true);
 protected readonly query=signal('');
 protected readonly status=signal('');
 protected readonly region=signal('');
 protected readonly categoryId=signal('');
 protected readonly noRu=signal(false);
 protected readonly noEn=signal(false);
 protected readonly noSources=signal(false);
 protected readonly noImages=signal(false);
 protected readonly toVerify=signal(false);
 protected readonly error=signal('');
 /** id события, которое сейчас удаляется: блокируем только его кнопку. */
 protected readonly busy=signal<number|null>(null);

 constructor(){
  this.api.historyAdminCategories().subscribe(rows=>this.categories.set(rows));
  this.route.queryParamMap.subscribe(params=>{
   this.page.set(Math.max(1,Number(params.get('page'))||1));
   this.query.set(params.get('q')||'');
   this.status.set(params.get('status')||'');
   this.region.set(params.get('region')||'');
   this.categoryId.set(params.get('category')||'');
   this.noRu.set(params.get('no_ru')==='1');
   this.noEn.set(params.get('no_en')==='1');
   this.noSources.set(params.get('no_sources')==='1');
   this.noImages.set(params.get('no_images')==='1');
   this.toVerify.set(params.get('verify')==='1');
   this.load();
  });
  this.queryInput.pipe(debounceTime(350),distinctUntilChanged()).subscribe(value=>this.patch({q:value||null,page:null}));
 }

 protected dirty():boolean{
  return Boolean(this.query()||this.status()||this.region()||this.categoryId())||this.noRu()||this.noEn()||this.noSources()||this.noImages()||this.toVerify();
 }
 protected pages():number{return Math.max(1,Math.ceil(this.total()/PER_PAGE));}
 protected onQuery(value:string):void{this.query.set(value);this.queryInput.next(value);}
 protected patch(params:Record<string,string|number|null>):void{
  void this.router.navigate([],{relativeTo:this.route,queryParams:params,queryParamsHandling:'merge'});
 }
 protected reset():void{void this.router.navigate([],{relativeTo:this.route,queryParams:{}});}
 protected goTo(page:number):void{if(page<1||page>this.pages())return;this.patch({page:page===1?null:page});}

 protected remove(item:HistoryAdminRowDto):void{
  const label=`«${item.title}»`;
  if(!window.confirm(`Удалить событие ${label}? Вместе с ним удалятся переводы, источники, изображения и связи с людьми.`))return;
  this.busy.set(item.id);
  this.error.set('');
  this.api.deleteHistoryEvent(item.id).subscribe({
   next:()=>{this.busy.set(null);this.load();},
   error:response=>{
    this.busy.set(null);
    this.error.set(response.error?.detail||`Не удалось удалить событие ${label}`);
   },
  });
 }

 protected statusLabel(value:string):string{
  return ({draft:'Черновик',review:'На проверке',published:'Опубликовано',rejected:'Отклонено'} as Record<string,string>)[value]||value;
 }
 protected regionLabel(value:string):string{
  return ({global:'Мировое',ru:'Рунет',en:'Зарубежное',other:'Другое'} as Record<string,string>)[value]||value;
 }
 /** Дата с той точностью, которую подтверждают источники. */
 protected dateLabel(item:HistoryAdminRowDto):string{
  if(!item.date_start)return 'Дата не установлена';
  const [year,month,day]=item.date_start.split('-');
  if(item.date_precision==='year'||item.date_precision==='period')return year;
  if(item.date_precision==='month')return `${month}.${year}`;
  return `${day}.${month}.${year}`;
 }

 private load():void{
  this.loading.set(true);
  this.api.historyAdminEvents({
   page:this.page(),perPage:PER_PAGE,query:this.query(),
   status:this.status()||null,region:this.region()||null,
   categoryId:this.categoryId()?Number(this.categoryId()):null,
   missingTranslation:this.noRu()?'ru':this.noEn()?'en':null,
   withoutSources:this.noSources(),withoutImages:this.noImages(),needsVerification:this.toVerify(),
  }).subscribe({
   next:result=>{this.items.set(result.items);this.total.set(result.total);this.loading.set(false);},
   error:()=>{this.items.set([]);this.total.set(0);this.loading.set(false);},
  });
 }
}
