import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, ConflictDto, EventDto } from '../api.service';
import { AuthService } from '../auth.service';

@Component({ selector:'app-editor-list', imports:[RouterLink,FormsModule], template:`
<main class="editor-shell">
 <header class="editor-header"><a routerLink="/"><b>СТРИМАРХИВ / РЕДАКТОР</b></a><nav><a routerLink="/editor/people">Стримеры</a><a routerLink="/editor/history">История</a><a routerLink="/editor/analytics">Статистика</a><a routerLink="/editor/pages/about">О проекте</a><a routerLink="/editor/pages/rules">Правила</a><a routerLink="/editor/submissions">Предложения</a><a routerLink="/editor/corrections">Исправления</a><a class="button" routerLink="/editor/import">Импорт JSON</a><a class="button primary" routerLink="/editor/conflicts/new">Новый материал</a><button class="button" (click)="logout()">Выйти</button></nav></header>
 <div class="section-head"><div><h1>Материалы</h1><p class="muted">Черновики и опубликованные страницы текущего окружения.</p></div><span>{{items().length}}</span></div>
 @if(error()){<p class="error">{{error()}}</p>}
 <section class="panel"><span class="muted">КРАТКАЯ ВЫГРУЗКА</span><h2>Темы и последние события</h2><p class="muted">По каждому материалу: тема, дата и время последнего события и само последнее событие. Фильтры ниже влияют только на выгрузку, список материалов остаётся полным.</p><div class="people-io-row"><label>Статус<select [ngModel]="exportStatus()" (ngModelChange)="exportStatus.set($event)">@for(option of statusOptions;track option.key){<option [value]="option.key">{{option.label}}</option>}</select></label><label>Публикация<select [ngModel]="exportPublished()" (ngModelChange)="exportPublished.set($event)"><option value="all">Все</option><option value="published">Опубликованные</option><option value="draft">Черновики</option></select></label><button class="button primary" type="button" (click)="exportDigest()" [disabled]="!selected().length">Скачать JSON ({{selected().length}})</button><button class="button" type="button" (click)="copyDigest()" [disabled]="!selected().length">Скопировать</button></div>@if(exportNote()){<p class="muted">{{exportNote()}}</p>}</section>
 <section class="list">@for(item of items();track item.id){<article class="list-row"><div><span class="badge">{{item.is_published?'Опубликован':'Черновик'}} · {{item.status}}@if(item.priority_enabled){ · позиция {{item.priority}}}</span><h3>{{item.title}}</h3><span class="muted">{{item.events.length}} событий · {{item.people.length}} участников · {{item.updated_at}}</span></div><a class="button" [routerLink]="['/editor/conflicts',item.id]">Редактировать</a></article>}@empty{<div class="panel">Материалов пока нет. Создайте первый.</div>}</section>
</main>`, styleUrl:'./editor.scss' })
export class EditorList {
 private api=inject(ApiService);private auth=inject(AuthService);private router=inject(Router);
 protected items=signal<ConflictDto[]>([]);protected error=signal('');protected exportNote=signal('');
 protected readonly exportStatus=signal('all');
 protected readonly exportPublished=signal('all');
 protected readonly statusOptions=[
  {key:'all',label:'Все статусы'},
  {key:'draft',label:'Черновик'},
  {key:'review',label:'На проверке'},
  {key:'developing',label:'Развивается'},
  {key:'waiting',label:'Ожидается ответ'},
  {key:'quiet',label:'Затих'},
  {key:'closed',label:'Завершён'},
  {key:'archived',label:'Архив'},
 ];
 /** Материалы под текущими фильтрами выгрузки. */
 protected readonly selected=computed(()=>{
  const status=this.exportStatus(),published=this.exportPublished();
  return this.items().filter(item=>
   (status==='all'||item.status===status)&&
   (published==='all'||(published==='published'?item.is_published:!item.is_published)));
 });
 constructor(){this.api.adminConflicts().subscribe({next:v=>this.items.set(v),error:e=>{if(e.status===401)this.logout();else this.error.set('Не удалось загрузить материалы');}})}
 protected logout():void{this.auth.clear();void this.router.navigate(['/editor/login']);}
 private lastEvent(item:ConflictDto):EventDto|null{if(!item.events.length)return null;const dated=item.events.filter(e=>e.occurred_at);if(!dated.length)return item.events[item.events.length-1];return dated.reduce((best,event)=>new Date(event.occurred_at!).getTime()>new Date(best.occurred_at!).getTime()?event:best);}
 private digest():unknown[]{return [...this.selected()].map(item=>{const event=this.lastEvent(item);return{slug:item.slug,title:item.title,status:item.status,is_published:item.is_published,events:item.events.length,last_event_at:event?.occurred_at||null,last_event:event?{occurred_at:event.occurred_at,event_type:event.event_type,title:event.title,body:event.body,is_commentary:event.is_commentary,sources:event.sources.map(source=>source.url)}:null};}).sort((a,b)=>{const left=a.last_event_at?Date.parse(a.last_event_at):0,right=b.last_event_at?Date.parse(b.last_event_at):0;return right-left;});}
 private digestText():string{return JSON.stringify({exported_at:new Date().toISOString(),filter:{status:this.exportStatus(),published:this.exportPublished()},conflicts:this.digest()},null,2);}
 protected exportDigest():void{if(!this.selected().length)return;const blob=new Blob([this.digestText()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`conflicts-digest-${this.exportStatus()}-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);this.exportNote.set(`Выгружено материалов: ${this.selected().length}`);}
 protected copyDigest():void{if(!this.selected().length)return;void navigator.clipboard.writeText(this.digestText()).then(()=>this.exportNote.set(`Скопировано материалов: ${this.selected().length}`),()=>this.exportNote.set('Не удалось скопировать в буфер обмена'));}
}
