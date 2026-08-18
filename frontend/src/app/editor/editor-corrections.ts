import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, CorrectionDto } from '../api.service';

@Component({selector:'app-editor-corrections',imports:[RouterLink],template:`
<main class="editor-shell"><header class="editor-header"><a routerLink="/editor"><b>← Материалы</b></a><h2>Заявки на исправление</h2></header>
<section class="list">@for(item of items();track item.id){<article class="panel"><span class="badge">{{item.status}}</span><p>{{item.statement}}</p><a [href]="item.source_url" target="_blank" rel="noopener">Открыть источник ↗</a><p class="muted">{{item.contact||'Контакт не указан'}} · {{item.created_at}}</p><div class="actions"><button class="button primary" (click)="setStatus(item,'accepted')">Принять</button><button class="button danger" (click)="setStatus(item,'rejected')">Отклонить</button></div></article>}@empty{<div class="panel">Новых заявок нет.</div>}</section></main>`,styleUrl:'./editor.scss'})
export class EditorCorrections{
 private api=inject(ApiService);protected items=signal<CorrectionDto[]>([]);
 constructor(){this.load()} private load(){this.api.corrections().subscribe(v=>this.items.set(v))}
 protected setStatus(item:CorrectionDto,status:string){this.api.updateCorrection(item.id,status).subscribe(()=>this.load())}
}
