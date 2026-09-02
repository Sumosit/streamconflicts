import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, HistoryImportMode, HistoryImportReportDto } from '../api.service';

@Component({selector:'app-editor-history-import',imports:[FormsModule,RouterLink],template:`<main class="editor-shell">
<header class="editor-header"><a routerLink="/editor/history"><b>← История</b></a><nav><a class="button" routerLink="/editor/history/research">Очередь исследования</a></nav></header>
<div class="section-head"><div><h1>Импорт исследования</h1><p class="muted">Формат streamconflicts-history, версия 1. Ничего не публикуется: события приходят черновиками.</p></div></div>

<section class="panel">
 <span class="muted">ФАЙЛ</span>
 <label>Выбрать JSON<input type="file" accept="application/json,.json" (change)="readFile($any($event.target))"></label>
 <label>JSON<textarea class="json-input" rows="14" [(ngModel)]="json" spellcheck="false" placeholder='{"format":"streamconflicts-history","version":1,"events":[]}'></textarea></label>
 <label>Режим<select [(ngModel)]="mode">
  <option value="create">Создать новые</option>
  <option value="create_and_update">Создать и обновить существующие</option>
  <option value="translations_only">Только дополнить переводы</option>
  <option value="sources_only">Только дополнить источники</option>
 </select></label>
 <p class="muted">{{modeHint()}}</p>
 <div class="people-io-row">
  <button class="button primary" type="button" (click)="run('validate')" [disabled]="busy()">Проверить</button>
  <button class="button" type="button" (click)="run(mode)" [disabled]="busy()||!report()">Применить</button>
 </div>
 @if(error()){<p class="error">{{error()}}</p>}
 @if(busy()){<p class="muted">Разбираем файл...</p>}
</section>

@if(report();as result){
 <section class="panel">
  <span class="muted">{{result.applied?'ПРИМЕНЕНО':'ПРЕДПРОСМОТР'}}</span>
  <h2>Событий в файле: {{result.total}}</h2>
  <div class="analytics-table">
   <div><span>Будет создано</span><b>{{result.to_create}}</b></div>
   <div><span>Будет обновлено</span><b>{{result.to_update}}</b></div>
   <div><span>Пропущено</span><b>{{result.to_skip}}</b></div>
   <div><span>С ошибками</span><b>{{result.with_errors}}</b></div>
  </div>
  @if(result.applied){<p class="success">Создано: {{result.created_events}}, обновлено: {{result.updated_events}}. Все события — черновики, проверьте их в списке.</p>}

  @if(result.unmatched_people.length){<h3>Участники не найдены в справочнике</h3>
   <p class="muted">Импорт их не создаёт: одно имя приходит от модели в разных вариантах, и автосоздание засорило бы справочник. Заведите записи вручную и привяжите в карточке события.</p>
   <div class="picker-list">@for(name of result.unmatched_people;track name){<span class="badge">{{name}}</span>}</div>}

  @if(result.unknown_categories.length){<h3>Неизвестные разделы</h3>
   <p class="muted">Разделы создаются только вручную, иначе дерево меню быстро зарастает вариантами одного и того же. События импортированы без раздела.</p>
   <div class="picker-list">@for(slug of result.unknown_categories;track slug){<span class="badge">{{slug}}</span>}</div>}
 </section>

 <section class="list">
  @for(plan of result.events;track plan.index){
   <article class="list-row">
    <div>
     <span class="badge">{{actionLabel(plan.action)}} · {{plan.reason}}</span>
     <h3>{{plan.title}}</h3>
     @if(plan.matched_slug){<span class="muted">совпало с {{plan.matched_slug}}</span>}
     @for(text of plan.errors;track text){<p class="error">{{text}}</p>}
     @for(text of plan.warnings;track text){<p class="muted">! {{text}}</p>}
    </div>
   </article>
  }
 </section>
}
</main>`,styleUrl:'./editor.scss'})
export class EditorHistoryImport{
 private readonly api=inject(ApiService);
 protected json='';
 protected mode:HistoryImportMode='create';
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 protected readonly report=signal<HistoryImportReportDto|null>(null);
 private filename:string|null=null;

 protected modeHint():string{
  return ({
   create:'Создаются только новые события. Совпавшие с существующими пропускаются.',
   create_and_update:'Новые создаются, совпавшие обновляются. Источники и картинки дополняются, а не затираются.',
   translations_only:'Затрагиваются только тексты уже существующих событий. Новые не создаются.',
   sources_only:'К существующим событиям добавляются недостающие источники.',
  } as Record<string,string>)[this.mode];
 }
 protected actionLabel(value:string):string{
  return ({create:'СОЗДАТЬ',update:'ОБНОВИТЬ',skip:'ПРОПУСТИТЬ',error:'ОШИБКА'} as Record<string,string>)[value]||value;
 }

 protected readFile(input:HTMLInputElement):void{
  const file=input.files?.[0];
  if(!file)return;
  this.filename=file.name;
  const reader=new FileReader();
  reader.onload=()=>{this.json=String(reader.result||'');this.error.set('');this.report.set(null);};
  reader.readAsText(file,'utf-8');
 }

 protected run(mode:HistoryImportMode):void{
  this.error.set('');
  let payload:unknown;
  try{payload=JSON.parse(this.json);}catch{this.error.set('JSON содержит синтаксическую ошибку');return;}
  // Применение всегда идёт после проверки: отчёт предпросмотра — это то,
  // на что редактор смотрел перед тем, как согласиться.
  if(mode!=='validate'&&!window.confirm('Применить импорт? События будут созданы черновиками.'))return;
  this.busy.set(true);
  this.api.historyImport(mode,payload,this.filename).subscribe({
   next:result=>{this.busy.set(false);this.report.set(result);},
   error:response=>{
    this.busy.set(false);
    const detail=response.error?.detail;
    this.error.set(typeof detail==='string'?detail:'Не удалось разобрать файл');
   },
  });
 }
}
