import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { concat, defaultIfEmpty, toArray } from 'rxjs';

import { UpperCasePipe } from '@angular/common';

type DuplicateGroup = { key: string; title: string; reason: string; people: PersonDto[] };
import { ApiService, AvatarCheckDto, PersonDto, PersonTwinDto } from '../api.service';

@Component({selector:'app-editor-people',imports:[RouterLink,FormsModule,UpperCasePipe],template:`<main class="editor-shell"><header class="editor-header"><a routerLink="/editor"><b>← Материалы</b></a><nav><a class="button primary" routerLink="/editor/people/new">Добавить запись</a></nav></header><div class="section-head"><div><h1>Стримеры, медиа и организации</h1><p class="muted">Общий справочник участников и авторов комментариев.</p></div><span>{{items().length}}</span></div><section class="panel"><span class="muted">ВЫГРУЗКА В JSON</span><h2>Экспорт справочника</h2><p class="muted">Диапазон по id включительно. Оставьте поля пустыми, чтобы выгрузить всех.</p><div class="people-io-row"><label>ID от<input type="number" [(ngModel)]="fromId" placeholder="{{minId()}}"></label><label>ID до<input type="number" [(ngModel)]="toId" placeholder="{{maxId()}}"></label><button class="button primary" type="button" (click)="exportJson()" [disabled]="!items().length">Скачать JSON ({{selected().length}})</button><button class="button" type="button" (click)="copyJson()" [disabled]="!items().length">Скопировать</button></div>@if(exportNote()){<p class="muted">{{exportNote()}}</p>}</section><section class="panel"><span class="muted">ОБНОВЛЕНИЕ ИЗ JSON</span><h2>Импорт изменений</h2><p class="muted">Принимается массив записей или объект с полем people. Запись сопоставляется по id, при его отсутствии — по slug. Найденные записи обновляются, остальные создаются.</p><label>Выбрать JSON-файл<input type="file" accept="application/json,.json" (change)="readFile($any($event.target))"></label><br><label>JSON<textarea class="json-input" rows="16" [(ngModel)]="json" spellcheck="false" placeholder='[{"id":1,"slug":"example","name":"Example"}]'></textarea></label><div class="people-io-row"><button class="button primary" type="button" (click)="applyJson()" [disabled]="importing()">{{importing()?'Обновление...':'Обновить записи'}}</button></div>@if(error()){<p class="error">{{error()}}</p>}@if(importNote()){<p class="muted">{{importNote()}}</p>}</section><section class="panel"><span class="muted">ОДИН ЧЕЛОВЕК В ДВУХ ЯЗЫКАХ</span><h2>Связывание карточек</h2><p class="muted">Справочник разделён по языкам, а история — общая для RU и EN. Общий ключ позволяет истории найти человека независимо от того, на каком языке заведена карточка. Это не слияние: обе записи остаются.</p><div class="people-io-row"><button class="button primary" type="button" (click)="findTwins()" [disabled]="linking()">Найти пары</button></div>@if(twinNote()){<p class="muted">{{twinNote()}}</p>}@for(pair of twins();track pair.suggested_key+pair.people[0].id){<article class="event-box"><div class="section-head"><h3>{{pair.people[0].name}}</h3><span class="muted">{{pair.reason}}</span></div><div class="analytics-table">@for(person of pair.people;track person.id){<div><span>{{person.site_lang|uppercase}} · {{person.name}} · {{person.slug}}</span><b>#{{person.id}}</b></div>}</div><div class="people-io-row"><label>Общий ключ<input type="text" [ngModel]="keyFor(pair)" (ngModelChange)="setKey(pair,$event)" placeholder="justin-kan"></label><button class="button primary" type="button" (click)="linkPair(pair)" [disabled]="linking()">Связать</button></div></article>}@if(linkedKeys().length){<p class="muted">Связано пар: {{linkedKeys().length}}</p>}</section><section class="panel"><span class="muted">ОБСЛУЖИВАНИЕ СПРАВОЧНИКА</span><h2>Дубли и аватарки</h2><p class="muted">Импорт создаёт новую запись, если slug не совпал с существующей. Здесь можно найти дубли и слить их, а также убрать ссылки на аватарки, которые перестали открываться.</p><div class="people-io-row"><button class="button primary" type="button" (click)="findDuplicates()">Найти дубли</button><button class="button" type="button" (click)="checkAvatars()" [disabled]="avatarsChecking()">{{avatarsChecking()?'Проверяю...':'Проверить аватарки'}}</button>@if(brokenAvatars().length){<button class="button danger" type="button" (click)="cleanupAvatars()" [disabled]="avatarsChecking()">Очистить битые ({{brokenAvatars().length}})</button>}</div>@if(maintenanceNote()){<p class="muted">{{maintenanceNote()}}</p>}@if(brokenAvatars().length){<div class="analytics-table">@for(row of brokenAvatars();track row.id){<div><span>{{row.name}} · {{row.slug}}</span><b>{{row.detail}}</b></div>}</div>}@for(group of duplicateGroups();track group.key){<article class="event-box"><div class="section-head"><h3>{{group.title}}</h3><span class="muted">{{group.reason}}</span></div><div class="analytics-table">@for(person of group.people;track person.id){<div class="dupe-row"><span>{{person.name}} · {{person.slug}} · упоминаний {{usage(person.id)}} · описание {{(person.bio||'').length}} симв</span><button class="button" type="button" (click)="mergeInto(group,person)" [disabled]="merging()">Оставить эту</button></div>}</div></article>}</section><section class="list">@for(item of items();track item.id){<article class="list-row person-list-row"><div class="person-list-main">@if(item.avatar_url){<img class="person-list-avatar" [src]="item.avatar_url" [alt]="item.name" loading="lazy">}@else{<span class="person-list-avatar person-list-placeholder">{{item.initials||item.name.slice(0,2)}}</span>}<div><span class="badge">#{{item.id}} · {{item.site_lang|uppercase}} · {{typeLabel(item.entity_type)}} · {{item.profile_status==='hidden'?'Скрыт':'Активен'}}</span><h3>{{item.name}}</h3><span class="muted">{{item.slug}}@if(item.canonical_key){ · ключ {{item.canonical_key}}}</span></div></div><a class="button" [routerLink]="['/editor/people',item.id]">Редактировать</a></article>}@empty{<div class="panel">Справочник пока пуст.</div>}</section></main>`,styleUrl:'./editor.scss'})
export class EditorPeople{
 private api=inject(ApiService);
 protected items=signal<PersonDto[]>([]);
 protected fromId:number|null=null;protected toId:number|null=null;protected json='';
 protected error=signal('');protected exportNote=signal('');protected importNote=signal('');protected importing=signal(false);
 constructor(){this.load();this.loadUsage();}
 /** Справочник показывает оба языка: люди RU- и EN-сайтов почти не пересекаются,
  * и держать два отдельных списка незачем. */
 private load(){this.api.searchPeople('',true).subscribe(v=>this.items.set([...v].sort((a,b)=>a.id-b.id)));}
 protected readonly duplicateGroups=signal<DuplicateGroup[]>([]);
 protected readonly brokenAvatars=signal<AvatarCheckDto[]>([]);
 protected readonly avatarsChecking=signal(false);
 protected readonly merging=signal(false);
 protected readonly maintenanceNote=signal('');
 private readonly usageById=signal<Record<number,number>>({});

 /** Сколько материалов ссылается на человека: помогает выбрать, какую запись оставить. */
 protected usage(personId:number):number{return this.usageById()[personId]??0;}

 private loadUsage():void{
  this.api.adminConflicts().subscribe(conflicts=>{
   const counts:Record<number,number>={};
   for(const conflict of conflicts)
    for(const relation of conflict.people){
     const id=relation.person?.id??relation.person_id;
     if(id)counts[id]=(counts[id]??0)+1;
    }
   this.usageById.set(counts);
  });
 }

 /** Ключ сравнения имён: регистр, пробелы и кириллица приводятся к одному виду. */
 private normalize(value:string):string{
  const map:Record<string,string>={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
  return value.toLowerCase().split('').map(character=>map[character]??character).join('').replace(/[^a-z0-9]/g,'');
 }

 protected findDuplicates():void{
  const groups=new Map<string,{title:string;reason:string;people:PersonDto[]}>();
  const add=(key:string,title:string,reason:string,person:PersonDto)=>{
   const group=groups.get(key)??{title,reason,people:[]};
   if(!group.people.some(item=>item.id===person.id))group.people.push(person);
   groups.set(key,group);
  };
  for(const person of this.items())add('name:'+this.normalize(person.name),person.name,'совпадает имя',person);
  for(const person of this.items())
   for(const url of Object.values(person.links??{})){
    const clean=String(url||'').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/,'').replace(/\/+$/,'');
    if(clean)add('link:'+clean,person.name,'общая ссылка: '+clean,person);
   }
  const result=[...groups.entries()].filter(([,group])=>group.people.length>1).map(([key,group])=>({key,...group}));
  this.duplicateGroups.set(result);
  this.maintenanceNote.set(result.length
   ?`Найдено групп: ${result.length}. Проверьте глазами: совпадение имени не всегда означает дубль.`
   :'Дублей не найдено.');
 }

 protected mergeInto(group:DuplicateGroup,keep:PersonDto):void{
  const others=group.people.filter(person=>person.id!==keep.id);
  if(!others.length)return;
  const names=others.map(person=>person.slug).join(', ');
  if(!window.confirm(`Объединить ${names} в «${keep.slug}»? Связи с материалами перейдут, лишние записи будут удалены.`))return;
  this.merging.set(true);
  concat(...others.map(person=>this.api.mergePerson(person.id,keep.id))).pipe(toArray()).subscribe({
   next:()=>{
    this.merging.set(false);
    this.maintenanceNote.set(`Объединено записей: ${others.length}. Осталась «${keep.slug}».`);
    this.duplicateGroups.set([]);
    this.load();
    this.loadUsage();
   },
   error:error=>{this.merging.set(false);this.maintenanceNote.set(error.error?.detail||'Не удалось объединить записи');},
  });
 }

 protected readonly twins=signal<PersonTwinDto[]>([]);
 protected readonly twinNote=signal('');
 protected readonly linking=signal(false);
 protected readonly linkedKeys=signal<string[]>([]);
 private readonly keyEdits=signal<Record<string,string>>({});

 /** Ключ пары: предложенный сервером, пока редактор не поправил его руками. */
 protected keyFor(pair:PersonTwinDto):string{
  return this.keyEdits()[this.pairId(pair)]??pair.suggested_key;
 }
 protected setKey(pair:PersonTwinDto,value:string):void{
  this.keyEdits.set({...this.keyEdits(),[this.pairId(pair)]:value});
 }
 private pairId(pair:PersonTwinDto):string{return pair.people.map(person=>person.id).join('-');}

 protected findTwins():void{
  this.twinNote.set('');
  this.api.personTwins().subscribe({
   next:rows=>{
    this.twins.set(rows);
    this.twinNote.set(rows.length
     ?`Найдено пар: ${rows.length}. Совпадение имени не всегда означает одного человека — проверьте глазами.`
     :'Несвязанных пар не найдено.');
   },
   error:()=>this.twinNote.set('Не удалось получить список пар'),
  });
 }

 protected linkPair(pair:PersonTwinDto):void{
  const key=this.keyFor(pair).trim();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)){this.twinNote.set('Ключ: латиница, цифры и дефис');return;}
  this.linking.set(true);
  this.api.linkPeople(pair.people.map(person=>person.id),key).subscribe({
   next:()=>{
    this.linking.set(false);
    this.linkedKeys.set([...this.linkedKeys(),key]);
    this.twins.set(this.twins().filter(item=>this.pairId(item)!==this.pairId(pair)));
    this.load();
   },
   error:error=>{this.linking.set(false);this.twinNote.set(error.error?.detail||'Не удалось связать карточки');},
  });
 }

 protected checkAvatars():void{
  this.avatarsChecking.set(true);this.maintenanceNote.set('');
  this.api.checkAvatars().subscribe({
   next:rows=>{
    const broken=rows.filter(row=>!row.ok);
    this.brokenAvatars.set(broken);
    this.avatarsChecking.set(false);
    this.maintenanceNote.set(`Проверено ссылок: ${rows.length}. Не открываются: ${broken.length}.`);
   },
   error:()=>{this.avatarsChecking.set(false);this.maintenanceNote.set('Не удалось проверить аватарки');},
  });
 }

 protected cleanupAvatars():void{
  if(!window.confirm(`Очистить ${this.brokenAvatars().length} нерабочих ссылок на аватарки? Сами записи останутся.`))return;
  this.avatarsChecking.set(true);
  this.api.cleanupAvatars().subscribe({
   next:result=>{
    this.avatarsChecking.set(false);
    this.brokenAvatars.set([]);
    this.maintenanceNote.set(`Очищено ссылок: ${result.cleared} из ${result.checked} проверенных.`);
    this.load();
   },
   error:()=>{this.avatarsChecking.set(false);this.maintenanceNote.set('Не удалось очистить ссылки');},
  });
 }

 protected typeLabel(value?:string){return({streamer:'Стример',media:'Медиа',organization:'Организация',other:'Другое'} as Record<string,string>)[value||'streamer']}
 protected minId(){const list=this.items();return list.length?list[0].id:0}
 protected maxId(){const list=this.items();return list.length?list[list.length-1].id:0}
 protected selected():PersonDto[]{const from=Number(this.fromId),to=Number(this.toId);return this.items().filter(p=>(!this.fromId||p.id>=from)&&(!this.toId||p.id<=to));}
 private exportText():string{return JSON.stringify(this.selected().map(p=>({id:p.id,slug:p.slug,name:p.name,initials:p.initials,avatar_url:p.avatar_url??null,bio:p.bio??null,links:p.links||{},profile_status:p.profile_status||'active',entity_type:p.entity_type||'streamer',canonical_key:p.canonical_key??null})),null,2);}
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
  if(raw.canonical_key!==undefined)out.canonical_key=this.clean(raw.canonical_key);
  return out;
 }
 private clean(raw:unknown):string|null{if(raw===null||raw===undefined)return null;const value=String(raw).trim();if(!value)return null;const markdown=value.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/);return markdown?markdown[1]:value;}
}
