import { Component, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  ApiService, HistoryAdminDetailDto, HistoryCategoryAdminDto,
  HistoryEventPersonDto, HistoryImageAdminDto, HistorySourceDraft, PersonDto,
} from '../api.service';

type Tab = 'main' | 'ru' | 'en' | 'sources' | 'images' | 'people';

type TranslationDraft = {
  title: string;
  summary: string;
  content: string;
  historical_context: string;
  consequences: string;
  translation_status: 'missing' | 'draft' | 'machine' | 'reviewed';
};

const EMPTY_TRANSLATION: TranslationDraft = { title: '', summary: '', content: '', historical_context: '', consequences: '', translation_status: 'draft' };

/** Из ответа сервера берём только поля черновика: language там лишнее. */
function toDraft(source: Partial<TranslationDraft> | undefined): TranslationDraft {
  return {
    title: source?.title ?? '',
    summary: source?.summary ?? '',
    content: source?.content ?? '',
    historical_context: source?.historical_context ?? '',
    consequences: source?.consequences ?? '',
    translation_status: source?.translation_status ?? 'draft',
  };
}

@Component({selector:'app-editor-history-form',imports:[FormsModule,RouterLink,UpperCasePipe],template:`<main class="editor-shell">
<header class="editor-header"><a routerLink="/editor/history"><b>← История</b></a><nav>@if(id){<a class="button" [href]="publicUrl()" target="_blank">Открыть на сайте</a>}<button class="button primary" type="button" (click)="save()" [disabled]="saving()">{{saving()?'Сохраняем...':'Сохранить'}}</button></nav></header>
@if(error()){<p class="error">{{error()}}</p>}
@if(message()){<p class="success">{{message()}}</p>}

<div class="section-head"><div><h1>{{model.translations['ru'].title||model.translations['en'].title||'Новое событие'}}</h1>@if(id){<p class="muted">{{model.slug}}</p>}</div></div>

<nav class="history-tabs">@for(tab of tabs;track tab.key){<button type="button" [class.active]="active()===tab.key" (click)="active.set(tab.key)">{{tab.label}}{{badge(tab.key)}}</button>}</nav>

@switch(active()){
 @case('main'){<section class="panel">
  <div class="grid">
   <label>Дата начала<input type="date" [(ngModel)]="model.date_start"></label>
   <label>Дата окончания<input type="date" [(ngModel)]="model.date_end"></label>
   <label>Точность даты<select [(ngModel)]="model.date_precision"><option value="day">День</option><option value="month">Месяц</option><option value="year">Год</option><option value="period">Период</option><option value="unknown">Неизвестна</option></select><small class="muted">Показываем дату ровно с той точностью, которую подтверждают источники.</small></label>
   <label>Регион<select [(ngModel)]="model.region"><option value="global">Мировое</option><option value="ru">Рунет</option><option value="en">Зарубежное</option><option value="other">Другое</option></select></label>
   <label>Значимость (0–100)<input type="number" min="0" max="100" [(ngModel)]="model.importance"></label>
   <label>Уверенность (0–100)<input type="number" min="0" max="100" [(ngModel)]="model.confidence"></label>
   <label>Статус<select [(ngModel)]="model.status"><option value="draft">Черновик</option><option value="review">На проверке</option><option value="published">Опубликовано</option><option value="rejected">Отклонено</option></select></label>
   <label>Slug<input [(ngModel)]="model.slug" placeholder="twitch-launch"><small class="muted">Пусто — соберётся из английского заголовка.</small></label>
  </div>
  <br>
  <label class="history-check"><input type="checkbox" [(ngModel)]="model.is_published"> Показывать на сайте</label>
  <label class="history-check"><input type="checkbox" [(ngModel)]="model.needs_verification"> Требует проверки</label>
  <br><br>
  <label>Основной раздел<select [(ngModel)]="model.primary_category_id"><option [ngValue]="null">Не выбран</option>@for(item of categories();track item.id){<option [ngValue]="item.id">{{item.path}}</option>}</select></label>
  <p class="muted">Дополнительные разделы: событие может лежать сразу в нескольких.</p>
  <div class="picker-list">@for(item of categories();track item.id){<label class="history-check"><input type="checkbox" [checked]="model.category_ids.includes(item.id)" (change)="toggleCategory(item.id)"> {{item.path}}</label>}</div>
  <br>
  <label>Связанные события (slug через запятую)<input [(ngModel)]="relatedText" placeholder="twitch-launch, mixer-shutdown"></label>
 </section>}

 @case('ru'){<section class="panel">
  <span class="muted">РУССКИЙ ПЕРЕВОД</span>
  <label>Состояние перевода<select [(ngModel)]="model.translations['ru'].translation_status"><option value="draft">Черновик</option><option value="machine">Машинный</option><option value="reviewed">Проверен</option><option value="missing">Отсутствует</option></select></label>
  <label>Заголовок<input [(ngModel)]="model.translations['ru'].title"></label>
  <label>Краткое описание<textarea rows="3" [(ngModel)]="model.translations['ru'].summary"></textarea></label>
  <label>Исторический контекст<textarea rows="6" [(ngModel)]="model.translations['ru'].historical_context"></textarea></label>
  <label>Что произошло<textarea rows="10" [(ngModel)]="model.translations['ru'].content"></textarea></label>
  <label>Последствия<textarea rows="6" [(ngModel)]="model.translations['ru'].consequences"></textarea></label>
  <p class="muted">Пустой заголовок удаляет перевод целиком.</p>
 </section>}

 @case('en'){<section class="panel">
  <span class="muted">АНГЛИЙСКИЙ ПЕРЕВОД</span>
  <label>Состояние перевода<select [(ngModel)]="model.translations['en'].translation_status"><option value="draft">Черновик</option><option value="machine">Машинный</option><option value="reviewed">Проверен</option><option value="missing">Отсутствует</option></select></label>
  <label>Заголовок<input [(ngModel)]="model.translations['en'].title"></label>
  <label>Краткое описание<textarea rows="3" [(ngModel)]="model.translations['en'].summary"></textarea></label>
  <label>Исторический контекст<textarea rows="6" [(ngModel)]="model.translations['en'].historical_context"></textarea></label>
  <label>Что произошло<textarea rows="10" [(ngModel)]="model.translations['en'].content"></textarea></label>
  <label>Последствия<textarea rows="6" [(ngModel)]="model.translations['en'].consequences"></textarea></label>
 </section>}

 @case('sources'){<section class="panel">
  <div class="section-head"><h2>Источники</h2><button class="button" type="button" (click)="addSource()">Добавить</button></div>
  @if(model.sources.length<2){<p class="muted">Событие с одним источником помечается как требующее проверки.</p>}
  @for(source of model.sources;track $index){<article class="source-box">
   <div class="grid">
    <label>Ссылка<input [(ngModel)]="source.url" placeholder="https://"></label>
    <label>Заголовок<input [(ngModel)]="source.title"></label>
    <label>Издание<input [(ngModel)]="source.publisher"></label>
    <label>Дата публикации<input type="date" [(ngModel)]="source.published_at"></label>
    <label>Язык<input [(ngModel)]="source.language" placeholder="ru / en" maxlength="5"></label>
   </div>
   <button class="button danger" type="button" (click)="model.sources.splice($index,1)">Удалить</button>
  </article>}@empty{<p class="muted">Источников пока нет.</p>}
 </section>}

 @case('images'){<section class="panel">
  <div class="section-head"><h2>Изображения</h2></div>
  @if(!id){<p class="muted">Сохраните событие, потом добавляйте изображения.</p>}@else{
  <p class="muted">Ссылка становится картинкой только после скачивания: чужой адрес может отвалиться в любой момент, а права на изображение проверяет человек.</p>
  <div class="people-io-row">
   <label>Добавить по ссылке<input [(ngModel)]="newImageUrl" placeholder="https://..."></label>
   <button class="button" type="button" (click)="addImage()" [disabled]="imageBusy()">Добавить</button>
   <label>Или загрузить файл<input type="file" accept="image/jpeg,image/png,image/webp" (change)="uploadImage($any($event.target))"></label>
  </div>
  @if(imageError()){<p class="error">{{imageError()}}</p>}
  @for(image of model.images;track image.id){<article class="source-box">
   <div class="source-box-head"><b>{{reviewLabel(image.review_status)}}</b>@if(image.is_cover){<span class="badge">ОБЛОЖКА</span>}</div>
   @if(image.file_url){<img class="editor-cover" [src]="image.file_url" alt="">}@else{<p class="muted">Файл ещё не скачан — на сайте не показывается.</p>}
   <p class="muted">{{image.source_url||image.file_url}}</p>
   <div class="grid">
    <label>Подпись RU<input [(ngModel)]="image.caption['ru']"></label>
    <label>Подпись EN<input [(ngModel)]="image.caption['en']"></label>
    <label>Автор<input [(ngModel)]="image.author"></label>
    <label>Лицензия<input [(ngModel)]="image.license"></label>
   </div>
   <div class="people-io-row">
    @if(image.source_url){<button class="button" type="button" (click)="fetchImage(image)" [disabled]="imageBusy()">{{image.file_url?'Скачать заново':'Скачать файл'}}</button>}
    <button class="button" type="button" (click)="saveImage(image)" [disabled]="imageBusy()">Сохранить подписи</button>
    @if(image.review_status!=='approved'){<button class="button primary" type="button" (click)="setReview(image,'approved')" [disabled]="imageBusy()||!image.file_url">Подтвердить</button>}
    @if(image.review_status!=='rejected'){<button class="button" type="button" (click)="setReview(image,'rejected')" [disabled]="imageBusy()">Отклонить</button>}
    @if(!image.is_cover&&image.file_url){<button class="button" type="button" (click)="setCover(image)" [disabled]="imageBusy()">Сделать обложкой</button>}
    <button class="button danger" type="button" (click)="removeImage(image)" [disabled]="imageBusy()">Удалить</button>
   </div>
  </article>}@empty{<p class="muted">Изображений нет. Событие можно опубликовать и без них.</p>}}
 </section>}

 @case('people'){<section class="panel">
  <div class="section-head"><h2>Участники</h2></div>
  <p class="muted">Поиск идёт по обоим языкам справочника: история общая для RU и EN.</p>
  <label>Найти человека<input type="search" [ngModel]="personQuery()" (ngModelChange)="onPersonQuery($event)" placeholder="Имя или slug"></label>
  @if(found().length){<div class="picker-list">@for(person of found();track person.id){<button type="button" class="button" (click)="addPerson(person)">{{person.name}} · {{person.slug}} · {{person.site_lang|uppercase}}</button>}</div>}
  <br>
  @for(link of model.people;track link.person_id){<article class="source-box">
   <div class="source-box-head"><b>{{link.name}}</b><span class="muted">{{link.slug}} · {{(link.site_lang||'ru').toUpperCase()}}</span></div>
   <div class="grid"><label>Роль<input [(ngModel)]="link.role" placeholder="сооснователь"></label></div>
   <button class="button danger" type="button" (click)="removePerson(link)">Убрать</button>
  </article>}@empty{<p class="muted">Участники не указаны.</p>}
 </section>}
}

@if(id){<section class="panel"><div class="section-head"><h2>Удаление</h2></div><p class="muted">Опубликованное событие удалить нельзя — сначала снимите с публикации.</p><button class="button danger" type="button" (click)="remove()">Удалить событие</button></section>}
</main>`,styleUrl:'./editor.scss'})
export class EditorHistoryForm{
 private readonly api=inject(ApiService);
 private readonly router=inject(Router);
 protected readonly id=Number(inject(ActivatedRoute).snapshot.paramMap.get('id'))||null;
 private readonly personInput=new Subject<string>();
 protected readonly saving=signal(false);
 protected readonly error=signal('');
 protected readonly message=signal('');
 protected readonly active=signal<Tab>('main');
 protected readonly categories=signal<HistoryCategoryAdminDto[]>([]);
 protected readonly found=signal<PersonDto[]>([]);
 protected readonly personQuery=signal('');
 protected relatedText='';
 protected readonly tabs:{key:Tab;label:string}[]=[
  {key:'main',label:'Основное'},{key:'ru',label:'RU'},{key:'en',label:'EN'},
  {key:'sources',label:'Источники'},{key:'images',label:'Изображения'},{key:'people',label:'Люди'},
 ];

 protected model:{
  slug:string; date_start:string|null; date_end:string|null; date_precision:string; region:string;
  importance:number; confidence:number; needs_verification:boolean; status:string; is_published:boolean;
  category_ids:number[]; primary_category_id:number|null;
  translations:Record<string,TranslationDraft>;
  sources:HistorySourceDraft[]; images:HistoryImageAdminDto[]; people:HistoryEventPersonDto[];
 }={
  slug:'',date_start:null,date_end:null,date_precision:'day',region:'global',
  importance:50,confidence:100,needs_verification:false,status:'draft',is_published:false,
  category_ids:[],primary_category_id:null,
  translations:{ru:{...EMPTY_TRANSLATION},en:{...EMPTY_TRANSLATION}},
  sources:[],images:[],people:[],
 };

 constructor(){
  this.api.historyAdminCategories().subscribe(rows=>this.categories.set(rows));
  if(this.id)this.api.historyAdminEvent(this.id).subscribe({
   next:item=>this.fill(item),
   error:()=>this.error.set('Событие не найдено'),
  });
  this.personInput.pipe(debounceTime(300),distinctUntilChanged()).subscribe(value=>{
   if(!value.trim()){this.found.set([]);return;}
   this.api.searchPeople(value,true).subscribe(rows=>this.found.set(rows.slice(0,12)));
  });
 }

 protected publicUrl():string{return `/history/${this.model.slug}`;}
 protected badge(tab:Tab):string{
  if(tab==='ru')return this.model.translations['ru'].title?' ✓':'';
  if(tab==='en')return this.model.translations['en'].title?' ✓':'';
  if(tab==='sources')return ` ${this.model.sources.length}`;
  if(tab==='images')return this.model.images.length?` ${this.model.images.length}`:'';
  if(tab==='people')return this.model.people.length?` ${this.model.people.length}`:'';
  return '';
 }
 protected reviewLabel(value:string):string{
  return ({candidate:'Кандидат, не показывается',approved:'Подтверждено',rejected:'Отклонено'} as Record<string,string>)[value]||value;
 }
 protected toggleCategory(id:number):void{
  const list=this.model.category_ids;
  const index=list.indexOf(id);
  index===-1?list.push(id):list.splice(index,1);
 }
 protected addSource():void{
  this.model.sources.push({url:'',title:'',publisher:null,published_at:null,language:null,source_status:'primary',sort_order:this.model.sources.length});
 }
 protected onPersonQuery(value:string):void{this.personQuery.set(value);this.personInput.next(value);}
 protected addPerson(person:PersonDto):void{
  if(this.model.people.some(link=>link.person_id===person.id))return;
  this.model.people.push({person_id:person.id,relation:'participant',role:null,name:person.name,slug:person.slug,site_lang:person.site_lang});
  this.personQuery.set('');
  this.found.set([]);
 }
 protected newImageUrl='';
 protected readonly imageBusy=signal(false);
 protected readonly imageError=signal('');

 protected addImage():void{
  const url=this.newImageUrl.trim();
  if(!this.id||!url)return;
  this.runImage(this.api.addHistoryImage(this.id,{source_url:url}),()=>this.newImageUrl='');
 }
 protected uploadImage(input:HTMLInputElement):void{
  const file=input.files?.[0];
  if(!this.id||!file)return;
  this.runImage(this.api.uploadHistoryImage(this.id,file),()=>input.value='');
 }
 protected fetchImage(image:HistoryImageAdminDto):void{
  this.runImage(this.api.fetchHistoryImage(image.id));
 }
 protected saveImage(image:HistoryImageAdminDto):void{
  this.runImage(this.api.updateHistoryImage(image.id,{
   caption:image.caption,author:image.author,license:image.license,
  }));
 }
 protected setReview(image:HistoryImageAdminDto,status:'approved'|'rejected'):void{
  this.runImage(this.api.updateHistoryImage(image.id,{review_status:status}));
 }
 protected setCover(image:HistoryImageAdminDto):void{
  this.runImage(this.api.updateHistoryImage(image.id,{is_cover:true}));
 }
 protected removeImage(image:HistoryImageAdminDto):void{
  if(!window.confirm('Удалить изображение?'))return;
  this.runImage(this.api.deleteHistoryImage(image.id));
 }

 /** Любое действие с картинкой перечитывает событие: статусы и обложка
  * меняются на сервере, и держать их копию в форме — верный способ разойтись. */
 private runImage(request:{subscribe:Function},after?:()=>void):void{
  this.imageBusy.set(true);this.imageError.set('');
  request.subscribe({
   next:()=>{
    this.imageBusy.set(false);
    after?.();
    if(this.id)this.api.historyAdminEvent(this.id).subscribe(item=>this.model.images=item.images);
   },
   error:(response:any)=>{
    this.imageBusy.set(false);
    this.imageError.set(response.error?.detail||'Не удалось выполнить действие с изображением');
   },
  });
 }

 protected removePerson(link:HistoryEventPersonDto):void{
  this.model.people=this.model.people.filter(item=>item.person_id!==link.person_id);
 }

 private fill(item:HistoryAdminDetailDto):void{
  this.model={
   slug:item.slug,date_start:item.date_start,date_end:item.date_end,date_precision:item.date_precision,
   region:item.region,importance:item.importance,confidence:item.confidence,
   needs_verification:item.needs_verification,status:item.status,is_published:item.is_published,
   category_ids:[...item.category_ids],primary_category_id:item.primary_category_id,
   translations:{ru:toDraft(item.translations['ru']),en:toDraft(item.translations['en'])},
   sources:item.sources.map(source=>({...source})),
   images:item.images,
   people:item.people.map(link=>({...link})),
  };
  this.relatedText=item.related_slugs.join(', ');
 }

 protected save():void{
  this.error.set('');this.message.set('');
  const translations:Record<string,unknown>={};
  for(const language of ['ru','en']){
   const block=this.model.translations[language];
   // Пустой заголовок означает «перевода нет»: сервер такой блок удаляет.
   translations[language]={...block,title:block.title.trim()};
  }
  const payload={
   slug:this.model.slug||null,
   date_start:this.model.date_start||null,
   date_end:this.model.date_end||null,
   date_precision:this.model.date_precision,
   region:this.model.region,
   importance:Number(this.model.importance),
   confidence:Number(this.model.confidence),
   needs_verification:this.model.needs_verification,
   status:this.model.status,
   is_published:this.model.is_published,
   category_ids:this.model.category_ids,
   primary_category_id:this.model.primary_category_id,
   translations,
   sources:this.model.sources.filter(source=>source.url.trim()).map((source,index)=>({...source,sort_order:index,title:source.title||source.url})),
   people:this.model.people.map(link=>({person_id:link.person_id,relation:link.relation,role:link.role||null})),
   related_slugs:this.relatedText.split(',').map(value=>value.trim()).filter(Boolean),
  };
  this.saving.set(true);
  const request=this.id?this.api.updateHistoryEvent(this.id,payload):this.api.createHistoryEvent(payload);
  request.subscribe({
   next:item=>{
    this.saving.set(false);
    this.message.set('Сохранено');
    if(!this.id)void this.router.navigate(['/editor/history',item.id]);
    else this.fill(item);
   },
   error:response=>{
    this.saving.set(false);
    const detail=response.error?.detail;
    this.error.set(typeof detail==='string'?detail:Array.isArray(detail)?detail.map((entry:any)=>`${entry.loc?.join('.')}: ${entry.msg}`).join('\n'):'Не удалось сохранить событие');
   },
  });
 }

 protected remove():void{
  if(!this.id||!window.confirm('Удалить событие вместе с переводами, источниками и связями?'))return;
  this.api.deleteHistoryEvent(this.id).subscribe({
   next:()=>void this.router.navigate(['/editor/history']),
   error:response=>this.error.set(response.error?.detail||'Не удалось удалить событие'),
  });
 }
}
