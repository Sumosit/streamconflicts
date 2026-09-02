import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, HistoryCategoryAdminDto, HistoryResearchBatchDto } from '../api.service';

@Component({selector:'app-editor-history-research',imports:[FormsModule,RouterLink],template:`<main class="editor-shell">
<header class="editor-header"><a routerLink="/editor/history"><b>← История</b></a><nav><a class="button" routerLink="/editor/history/import">Импорт JSON</a></nav></header>
<div class="section-head"><div><h1>Очередь исследования</h1><p class="muted">Один пакет — один срез: период, регион и тема. В запрос уходит только этот срез и список уже известных событий, а не вся база.</p></div><span>{{batches().length}}</span></div>

<section class="panel">
 <span class="muted">СОЗДАТЬ ПАКЕТЫ</span>
 <h2>Разбить годы на срезы</h2>
 <div class="people-io-row">
  <label>С года<input type="number" [(ngModel)]="yearFrom" min="1990" max="2100"></label>
  <label>По год<input type="number" [(ngModel)]="yearTo" min="1990" max="2100"></label>
  <label>Регион<select [(ngModel)]="region"><option value="global">Мировые</option><option value="ru">Рунет</option><option value="en">Зарубежные</option><option value="all">Все</option></select></label>
  <label>Дробность<select [(ngModel)]="split"><option value="year">Год целиком</option><option value="month">По месяцам</option></select></label>
  <label>Тема<select [(ngModel)]="categoryId"><option [ngValue]="null">Любая</option>@for(item of categories();track item.id){<option [ngValue]="item.id">{{item.path}}</option>}</select></label>
  <button class="button primary" type="button" (click)="plan()" [disabled]="busy()">Создать</button>
 </div>
 <p class="muted">Существующие срезы не дублируются. По месяцам стоит дробить только насыщенные годы — иначе получится много пустых запросов.</p>
 @if(note()){<p class="success">{{note()}}</p>}
 @if(error()){<p class="error">{{error()}}</p>}
</section>

@if(prompt();as text){<section class="panel">
 <div class="section-head"><h2>Запрос для пакета #{{promptBatch()}}</h2><span class="muted">{{text.length}} символов</span></div>
 <textarea class="json-input" rows="18" readonly>{{text}}</textarea>
 <div class="people-io-row"><button class="button primary" type="button" (click)="copy(text)">Скопировать</button><button class="button" type="button" (click)="prompt.set(null)">Закрыть</button></div>
 @if(copied()){<p class="success">Скопировано. Вставьте в чат с нейронкой, ответ загрузите через импорт JSON.</p>}
</section>}

<section class="list">
 @for(batch of batches();track batch.id){
  <article class="list-row">
   <div>
    <span class="badge">{{statusLabel(batch.status)}} · {{regionLabel(batch.region)}}@if(batch.category_title){ · {{batch.category_title}}}</span>
    <h3>{{periodLabel(batch)}}</h3>
    <span class="muted">известных событий в срезе: {{batch.known_count}}@if(batch.import_id){ · импорт #{{batch.import_id}}}</span>
   </div>
   <div class="actions">
    <button class="button" type="button" (click)="showPrompt(batch)">Запрос</button>
    <select [ngModel]="batch.status" (ngModelChange)="setStatus(batch,$event)">
     <option value="planned">Запланирован</option>
     <option value="researching">В работе</option>
     <option value="imported">Импортирован</option>
     <option value="reviewed">Проверен</option>
     <option value="complete">Готов</option>
    </select>
    <button class="button danger" type="button" (click)="remove(batch)">Удалить</button>
   </div>
  </article>
 }@empty{<div class="panel">{{loading()?'Загружаем...':'Пакетов пока нет. Создайте их кнопкой выше.'}}</div>}
</section>
</main>`,styleUrl:'./editor.scss'})
export class EditorHistoryResearch{
 private readonly api=inject(ApiService);
 protected readonly batches=signal<HistoryResearchBatchDto[]>([]);
 protected readonly categories=signal<HistoryCategoryAdminDto[]>([]);
 protected readonly prompt=signal<string|null>(null);
 protected readonly promptBatch=signal<number|null>(null);
 protected readonly copied=signal(false);
 protected readonly busy=signal(false);
 protected readonly loading=signal(true);
 protected readonly note=signal('');
 protected readonly error=signal('');
 protected yearFrom=2011;
 protected yearTo=new Date().getFullYear();
 protected region='global';
 protected split='year';
 protected categoryId:number|null=null;

 constructor(){
  this.api.historyAdminCategories().subscribe(rows=>this.categories.set(rows));
  this.load();
 }

 protected statusLabel(value:string):string{
  return ({planned:'ЗАПЛАНИРОВАН',researching:'В РАБОТЕ',imported:'ИМПОРТИРОВАН',reviewed:'ПРОВЕРЕН',complete:'ГОТОВ'} as Record<string,string>)[value]||value;
 }
 protected regionLabel(value:string):string{
  return ({global:'Мировые',ru:'Рунет',en:'Зарубежные',other:'Другое',all:'Все'} as Record<string,string>)[value]||value;
 }
 protected periodLabel(batch:HistoryResearchBatchDto):string{
  if(!batch.period_start&&!batch.period_end)return 'Весь период';
  const format=(value:string|null)=>value?value.split('-').reverse().join('.'):'—';
  return `${format(batch.period_start)} — ${format(batch.period_end)}`;
 }

 protected plan():void{
  this.busy.set(true);this.note.set('');this.error.set('');
  this.api.planHistoryBatches({
   year_from:Number(this.yearFrom),year_to:Number(this.yearTo),
   region:this.region,split:this.split,
   category_ids:this.categoryId?[this.categoryId]:null,
  }).subscribe({
   next:created=>{
    this.busy.set(false);
    this.note.set(created.length?`Создано пакетов: ${created.length}`:'Новых срезов нет — эти уже запланированы.');
    this.load();
   },
   error:response=>{this.busy.set(false);this.error.set(response.error?.detail||'Не удалось создать пакеты');},
  });
 }

 protected showPrompt(batch:HistoryResearchBatchDto):void{
  this.copied.set(false);
  this.api.historyBatchPrompt(batch.id).subscribe({
   next:result=>{this.prompt.set(result.prompt);this.promptBatch.set(batch.id);},
   error:()=>this.error.set('Не удалось собрать запрос'),
  });
 }

 protected copy(text:string):void{
  void navigator.clipboard.writeText(text).then(
   ()=>this.copied.set(true),
   ()=>this.error.set('Не удалось скопировать в буфер обмена'),
  );
 }

 protected setStatus(batch:HistoryResearchBatchDto,status:string):void{
  this.api.updateHistoryBatch(batch.id,{status}).subscribe({
   next:()=>this.load(),
   error:()=>this.error.set('Не удалось изменить статус'),
  });
 }

 protected remove(batch:HistoryResearchBatchDto):void{
  if(!window.confirm('Удалить пакет? События, уже импортированные по нему, останутся.'))return;
  this.api.deleteHistoryBatch(batch.id).subscribe({next:()=>this.load()});
 }

 private load():void{
  this.loading.set(true);
  this.api.historyBatches().subscribe({
   next:rows=>{this.batches.set(rows);this.loading.set(false);},
   error:()=>{this.batches.set([]);this.loading.set(false);},
  });
 }
}
