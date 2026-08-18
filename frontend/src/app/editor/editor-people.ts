import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { concat, defaultIfEmpty, toArray } from 'rxjs';
import { ApiService, PersonDto } from '../api.service';

@Component({selector:'app-editor-people',imports:[RouterLink,FormsModule],template:`<main class="editor-shell"><header class="editor-header"><a routerLink="/editor"><b>← Материалы</b></a><nav><a class="button primary" routerLink="/editor/people/new">Добавить запись</a></nav></header><div class="section-head"><div><h1>Стримеры, медиа и организации</h1><p class="muted">Общий справочник участников и авторов комментариев.</p></div><span>{{items().length}}</span></div><section class="panel"><span class="muted">ВЫГРУЗКА В JSON</span><h2>Экспорт справочника</h2><p class="muted">Диапазон по id включительно. Оставьте поля пустыми, чтобы выгрузить всех.</p><div class="people-io-row"><label>ID от<input type="number" [(ngModel)]="fromId" placeholder="{{minId()}}"></label><label>ID до<input type="number" [(ngModel)]="toId" placeholder="{{maxId()}}"></label><button class="button primary" type="button" (click)="exportJson()" [disabled]="!items().length">Скачать JSON ({{selected().length}})</button><button class="button" type="button" (click)="copyJson()" [disabled]="!items().length">Скопировать</button></div>@if(exportNote()){<p class="muted">{{exportNote()}}</p>}</section><section class="panel"><span class="muted">ОБНОВЛЕНИЕ ИЗ JSON</span><h2>Импорт изменений</h2><p class="muted">Принимается массив записей или объект с полем people. Запись сопоставляется по id, при его отсутствии — по slug. Найденные записи обновляются, остальные создаются.</p><label>Выбрать JSON-файл<input type="file" accept="application/json,.json" (change)="readFile($any($event.target))"></label><br><label>JSON<textarea class="json-input" rows="16" [(ngModel)]="json" spellcheck="false" placeholder='[{"id":1,"slug":"example","name":"Example"}]'></textarea></label><div class="people-io-row"><button class="button primary" type="button" (click)="applyJson()" [disabled]="importing()">{{importing()?'Обновление...':'Обновить записи'}}</button></div>@if(error()){<p class="error">{{error()}}</p>}@if(importNote()){<p class="muted">{{importNote()}}</p>}</section><section class="list">@for(item of items();track item.id){<article class="list-row person-list-row"><div class="person-list-main">@if(item.avatar_url){<img class="person-list-avatar" [src]="item.avatar_url" [alt]="item.name" loading="lazy">}@else{<span class="person-list-avatar person-list-placeholder">{{item.initials||item.name.slice(0,2)}}</span>}<div><span class="badge">#{{item.id}} · {{typeLabel(item.entity_type)}} · {{item.profile_status==='hidden'?'Скрыт':'Активен'}}</span><h3>{{item.name}}</h3><span class="muted">{{item.slug}}</span></div></div><a class="button" [routerLink]="['/editor/people',item.id]">Редактировать</a></article>}@empty{<div class="panel">Справочник пока пуст.</div>}</section></main>`,styleUrl:'./editor.scss'})
export class EditorPeople{
 private api=inject(ApiService);
 protected items=signal<PersonDto[]>([]);
 protected fromId:number|null=null;protected toId:number|null=null;protected json='';
 protected error=signal('');protected exportNote=signal('');protected importNote=signal('');protected importing=signal(false);
 constructor(){this.load();}
 private load(){this.api.people().subscribe(v=>this.items.set([...v].sort((a,b)=>a.id-b.id)));}
 protected typeLabel(value?:string){return({streamer:'Стример',media:'Медиа',organization:'Организация',other:'Другое'} as Record<string,string>)[value||'streamer']}
 protected minId(){const list=this.items();return list.length?list[0].id:0}
 protected maxId(){const list=this.items();return list.length?list[list.length-1].id:0}
 protected selected():PersonDto[]{const from=Number(this.fromId),to=Number(this.toId);return this.items().filter(p=>(!this.fromId||p.id>=from)&&(!this.toId||p.id<=to));}
 private exportText():string{return JSON.stringify(this.selected().map(p=>({id:p.id,slug:p.slug,name:p.name,initials:p.initials,avatar_url:p.avatar_url??null,bio:p.bio??null,links:p.links||{},profile_status:p.profile_status||'active',entity_type:p.entity_type||'streamer'})),null,2);}
 protected exportJson():void{const list=this.selected();if(!list.length){this.exportNote.set('В выбранном диапазоне нет записей');return;}const blob=new Blob([this.exportText()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`people-${list[0].id}-${list[list.length-1].id}.json`;link.click();URL.revokeObjectURL(url);this.exportNote.set(`Выгружено записей: ${list.length}`);}
 protected copyJson():void{const list=this.selected();if(!list.length){this.exportNote.set('В выбранном диапазоне нет записей');return;}void navigator.clipboard.writeText(this.exportText()).then(()=>this.exportNote.set(`Скопировано записей: ${list.length}`),()=>this.exportNote.set('Не удалось скопировать в буфер обмена'));}
 protected readFile(input:HTMLInputElement):void{const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{this.json=String(reader.result||'');this.error.set('');this.importNote.set('');};reader.readAsText(file,'utf-8');}
 protected applyJson():void{
  this.error.set('');this.importNote.set('');
  let root:any;try{root=JSON.parse(this.json);}catch{this.error.set('JSON содержит синтаксическую ошибку');return;}
  const list:any[]=Array.isArray(root)?root:Array.isArray(root?.people)?root.people:Array.isArray(root?.people_catalog)?root.people_catalog:root&&typeof root==='object'?[root]:[];
  if(!list.length){this.error.set('Не найден массив записей');return;}
  const byId=new Map(this.items().map(p=>[p.id,p])),bySlug=new Map(this.items().map(p=>[p.slug,p]));
  const calls:{create:boolean;run:ReturnType<ApiService['updatePerson']>}[]=[];
  for(const [index,raw] of list.entries()){
   if(!raw||typeof raw!=='object'){this.error.set(`Запись ${index+1}: ожидается объект`);return;}
   const current=raw.id!=null?byId.get(Number(raw.id)):raw.slug?bySlug.get(String(raw.slug)):undefined;
   if(raw.id!=null&&!current){this.error.set(`Запись ${index+1}: не найдена запись с id ${raw.id}`);return;}
   const payload=this.payload(raw,index,!current);if(typeof payload==='string'){this.error.set(payload);return;}
   calls.push(current?{create:false,run:this.api.updatePerson(current.id,payload)}:{create:true,run:this.api.createPerson(payload)});
  }
  const updated=calls.filter(c=>!c.create).length,created=calls.length-updated;
  this.importing.set(true);
  concat(...calls.map(c=>c.run)).pipe(toArray(),defaultIfEmpty([] as PersonDto[])).subscribe({
   next:()=>{this.importing.set(false);this.importNote.set(`Обновлено: ${updated}, создано: ${created}`);this.load();},
   error:e=>{this.importing.set(false);const detail=e.error?.detail;this.error.set(typeof detail==='string'?detail:Array.isArray(detail)?detail.map((item:any)=>`${item.loc?.join('.')}: ${item.msg}`).join('\n'):e.message||'Не удалось обновить записи');this.load();}
  });
 }
 private payload(raw:any,index:number,isNew:boolean):any|string{
  const out:any={};
  if(raw.slug!==undefined||isNew){const slug=String(raw.slug||'').trim();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return`Запись ${index+1}: некорректный slug "${raw.slug??''}"`;out.slug=slug;}
  if(raw.name!==undefined||isNew){const name=String(raw.name||'').trim();if(!name)return`Запись ${index+1}: не заполнено поле name`;out.name=name;}
  if(raw.initials!==undefined||isNew)out.initials=String(raw.initials||out.name||'?').slice(0,8);
  if(raw.avatar_url!==undefined)out.avatar_url=this.clean(raw.avatar_url);
  if(raw.bio!==undefined)out.bio=raw.bio===null?null:String(raw.bio);
  if(raw.links!==undefined)out.links=Object.fromEntries(Object.entries(raw.links||{}).map(([key,value])=>[key,this.clean(value)||'']));
  if(raw.profile_status!==undefined)out.profile_status=raw.profile_status==='hidden'?'hidden':'active';
  if(raw.entity_type!==undefined)out.entity_type=['streamer','media','organization','other'].includes(raw.entity_type)?raw.entity_type:'streamer';
  return out;
 }
 private clean(raw:unknown):string|null{if(raw===null||raw===undefined)return null;const value=String(raw).trim();if(!value)return null;const markdown=value.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/);return markdown?markdown[1]:value;}
}
