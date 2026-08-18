import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, ConflictDto, EventDto } from '../api.service';
import { AuthService } from '../auth.service';

@Component({ selector:'app-editor-list', imports:[RouterLink], template:`
<main class="editor-shell">
 <header class="editor-header"><a routerLink="/"><b>СТРИМАРХИВ / РЕДАКТОР</b></a><nav><a routerLink="/editor/people">Стримеры</a><a routerLink="/editor/analytics">Статистика</a><a routerLink="/editor/pages/about">О проекте</a><a routerLink="/editor/pages/rules">Правила</a><a routerLink="/editor/submissions">Предложения</a><a routerLink="/editor/corrections">Исправления</a><a class="button" routerLink="/editor/import">Импорт JSON</a><a class="button primary" routerLink="/editor/conflicts/new">Новый материал</a><button class="button" (click)="logout()">Выйти</button></nav></header>
 <div class="section-head"><div><h1>Материалы</h1><p class="muted">Черновики и опубликованные страницы текущего окружения.</p></div><span>{{items().length}}</span></div>
 @if(error()){<p class="error">{{error()}}</p>}
 <section class="panel"><span class="muted">КРАТКАЯ ВЫГРУЗКА</span><h2>Темы и последние события</h2><p class="muted">По каждому материалу: тема, дата и время последнего события и само последнее событие.</p><div class="people-io-row"><button class="button primary" type="button" (click)="exportDigest()" [disabled]="!items().length">Скачать JSON ({{items().length}})</button><button class="button" type="button" (click)="copyDigest()" [disabled]="!items().length">Скопировать</button></div>@if(exportNote()){<p class="muted">{{exportNote()}}</p>}</section>
 <section class="list">@for(item of items();track item.id){<article class="list-row"><div><span class="badge">{{item.is_published?'Опубликован':'Черновик'}} · {{item.status}}@if(item.priority_enabled){ · позиция {{item.priority}}}</span><h3>{{item.title}}</h3><span class="muted">{{item.events.length}} событий · {{item.people.length}} участников · {{item.updated_at}}</span></div><a class="button" [routerLink]="['/editor/conflicts',item.id]">Редактировать</a></article>}@empty{<div class="panel">Материалов пока нет. Создайте первый.</div>}</section>
</main>`, styleUrl:'./editor.scss' })
export class EditorList {
 private api=inject(ApiService);private auth=inject(AuthService);private router=inject(Router);
 protected items=signal<ConflictDto[]>([]);protected error=signal('');protected exportNote=signal('');
 constructor(){this.api.adminConflicts().subscribe({next:v=>this.items.set(v),error:e=>{if(e.status===401)this.logout();else this.error.set('Не удалось загрузить материалы');}})}
 protected logout():void{this.auth.clear();void this.router.navigate(['/editor/login']);}
 private lastEvent(item:ConflictDto):EventDto|null{if(!item.events.length)return null;const dated=item.events.filter(e=>e.occurred_at);if(!dated.length)return item.events[item.events.length-1];return dated.reduce((best,event)=>new Date(event.occurred_at!).getTime()>new Date(best.occurred_at!).getTime()?event:best);}
 private digest():unknown[]{return [...this.items()].map(item=>{const event=this.lastEvent(item);return{slug:item.slug,title:item.title,status:item.status,is_published:item.is_published,events:item.events.length,last_event_at:event?.occurred_at||null,last_event:event?{occurred_at:event.occurred_at,event_type:event.event_type,title:event.title,body:event.body,is_commentary:event.is_commentary,sources:event.sources.map(source=>source.url)}:null};}).sort((a,b)=>{const left=a.last_event_at?Date.parse(a.last_event_at):0,right=b.last_event_at?Date.parse(b.last_event_at):0;return right-left;});}
 private digestText():string{return JSON.stringify({exported_at:new Date().toISOString(),conflicts:this.digest()},null,2);}
 protected exportDigest():void{if(!this.items().length)return;const blob=new Blob([this.digestText()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`conflicts-digest-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);this.exportNote.set(`Выгружено материалов: ${this.items().length}`);}
 protected copyDigest():void{if(!this.items().length)return;void navigator.clipboard.writeText(this.digestText()).then(()=>this.exportNote.set(`Скопировано материалов: ${this.items().length}`),()=>this.exportNote.set('Не удалось скопировать в буфер обмена'));}
}
