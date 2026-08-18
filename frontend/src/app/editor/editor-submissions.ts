import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, SubmissionDto } from '../api.service';

@Component({selector:'app-editor-submissions',imports:[RouterLink],template:`
<main class="editor-shell"><header class="editor-header"><a routerLink="/editor"><b>← Материалы</b></a><h2>Предложенные материалы</h2></header>
<section class="list">@for(item of items();track item.id){<article class="panel"><span class="badge">{{statusLabel(item.status)}}</span><p>{{item.description}}</p><a [href]="item.source_url" target="_blank" rel="noopener">Открыть источник ↗</a><p class="muted">{{item.contact||'Контакт не указан'}} · {{formatDate(item.created_at)}}</p><div class="actions">@if(item.status==='new'){<button class="button primary" (click)="setStatus(item,'accepted')">Взять в работу</button><button class="button danger" (click)="setStatus(item,'rejected')">Отклонить</button>}@else if(item.status==='accepted'){<a class="button primary" routerLink="/editor/conflicts/new" [queryParams]="{submission:item.id}">Создать черновик</a><button class="button" (click)="setStatus(item,'rejected')">Закрыть без материала</button>}@else{<button class="button" (click)="setStatus(item,'new')">Вернуть в новые</button>}</div></article>}@empty{<div class="panel">Новых предложений нет.</div>}</section></main>`,styleUrl:'./editor.scss'})
export class EditorSubmissions{
 private api=inject(ApiService);protected items=signal<SubmissionDto[]>([]);
 constructor(){this.load()} private load(){this.api.submissions().subscribe(v=>this.items.set(v))}
 protected setStatus(item:SubmissionDto,status:string){this.api.updateSubmission(item.id,status).subscribe(()=>this.load())}
 protected statusLabel(value:string){return({new:'Новая',accepted:'В работе',rejected:'Отклонена'} as Record<string,string>)[value]||value}
 protected formatDate(value:string){return new Date(value).toLocaleString('ru-RU')}
}
