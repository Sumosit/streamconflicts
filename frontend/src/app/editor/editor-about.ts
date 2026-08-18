import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';

type PageSection = { number: string; title: string; body: string };
type PageDraft = { title: string; lead: string; sections: PageSection[]; contact_text: string; is_published: boolean };

@Component({selector:'app-editor-about',imports:[FormsModule,RouterLink],template:`<main class="editor-shell"><header class="editor-header"><a routerLink="/editor"><b>← Материалы</b></a><div class="actions"><button class="button" type="button" (click)="toggleJson()">{{jsonOpen()?'Скрыть JSON':'JSON'}}</button><button class="button primary" (click)="save()">Сохранить</button></div></header>@if(message()){<p class="success">{{message()}}</p>}@if(error()){<p class="error">{{error()}}</p>}
@if(jsonOpen()){<section class="panel json-panel"><div class="section-head"><div><span class="muted">СТРАНИЦА В JSON</span><h2>Выгрузка и загрузка</h2></div><div class="actions"><button class="button" type="button" (click)="copyJson()">{{copied()?'Скопировано':'Копировать'}}</button><button class="button" type="button" (click)="downloadJson()">Скачать</button></div></div><p class="muted">Правки из JSON попадают в форму и сохраняются только после нажатия «Сохранить». Разделы заменяются целиком.</p><label>Выбрать JSON-файл<input type="file" accept="application/json,.json" (change)="readFile($any($event.target))"></label><br><label>JSON<textarea class="json-input" rows="20" [(ngModel)]="json" spellcheck="false"></textarea></label><div class="actions"><button class="button primary" type="button" (click)="applyJson()">Применить к форме</button><button class="button" type="button" (click)="fillJson()">Вернуть текущее</button></div></section>}
<section class="panel"><div class="section-head"><div><span class="muted">СТРАНИЦА</span><h1>{{title}}</h1></div><label>Опубликована<input type="checkbox" [(ngModel)]="model.is_published"></label></div><label>Заголовок<input [(ngModel)]="model.title"></label><br><label>Вводный текст<textarea rows="5" [(ngModel)]="model.lead"></textarea></label></section><section class="panel"><div class="section-head"><h2>{{sectionsTitle}}</h2><button class="button" (click)="add()">Добавить</button></div>@for(section of model.sections;track $index;let i=$index){<article class="event-box"><div class="section-head"><h3>{{section.number||i+1}}</h3><div class="actions"><button class="button" type="button" (click)="move(i,-1)" [disabled]="i===0" aria-label="Поднять">↑</button><button class="button" type="button" (click)="move(i,1)" [disabled]="i===model.sections.length-1" aria-label="Опустить">↓</button><button class="button danger" (click)="model.sections.splice(i,1)">Удалить</button></div></div><div class="grid"><label>Номер<input [(ngModel)]="section.number"></label><label>Заголовок<input [(ngModel)]="section.title"></label></div><br><label>Текст<textarea rows="4" [(ngModel)]="section.body"></textarea></label></article>}@empty{<p class="muted">Разделов пока нет.</p>}</section><section class="panel"><label>Контактный блок<textarea rows="4" [(ngModel)]="model.contact_text"></textarea></label></section></main>`,styleUrl:'./editor.scss'})
export class EditorAbout{
 private api=inject(ApiService);
 protected message=signal('');protected error=signal('');
 protected model:PageDraft={title:'',lead:'',sections:[],contact_text:'',is_published:false};
 private readonly slug=inject(ActivatedRoute).snapshot.data['pageSlug']||'about';
 protected readonly title=this.slug==='rules'?'Редакционные правила':'О проекте';
 protected readonly sectionsTitle=this.slug==='rules'?'Правила':'Принципы';
 protected jsonOpen=signal(false);protected json='';protected copied=signal(false);

 constructor(){this.api.adminPage(this.slug).subscribe(v=>{this.model={title:v.title,lead:v.lead,sections:v.sections.map(x=>({...x})),contact_text:v.contact_text||'',is_published:v.is_published};if(this.jsonOpen())this.fillJson();});}

 protected add(){this.model.sections.push({number:String(this.model.sections.length+1).padStart(2,'0'),title:'',body:''});}
 protected move(index:number,direction:-1|1){const target=index+direction;if(target<0||target>=this.model.sections.length)return;[this.model.sections[index],this.model.sections[target]]=[this.model.sections[target],this.model.sections[index]];}
 protected save(){this.error.set('');this.api.updatePage(this.slug,this.model).subscribe({next:()=>this.message.set('Страница сохранена'),error:()=>this.error.set('Не удалось сохранить страницу')});}

 protected toggleJson(){const open=!this.jsonOpen();this.jsonOpen.set(open);if(open&&!this.json.trim())this.fillJson();}
 /** Текущее состояние формы в виде JSON. */
 protected fillJson(){this.json=JSON.stringify({slug:this.slug,...this.model},null,2);this.copied.set(false);}
 protected copyJson(){if(!this.json.trim())this.fillJson();void navigator.clipboard.writeText(this.json).then(()=>{this.copied.set(true);window.setTimeout(()=>this.copied.set(false),1600);},()=>this.error.set('Не удалось скопировать в буфер обмена'));}
 protected downloadJson(){if(!this.json.trim())this.fillJson();const blob=new Blob([this.json],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`page-${this.slug}.json`;link.click();URL.revokeObjectURL(url);}
 protected readFile(input:HTMLInputElement){const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{this.json=String(reader.result||'');this.error.set('');this.message.set('');};reader.readAsText(file,'utf-8');}

 protected applyJson(){
  this.error.set('');this.message.set('');
  let raw:any;
  try{raw=JSON.parse(this.json);}catch{this.error.set('JSON содержит синтаксическую ошибку');return;}
  const page=raw&&typeof raw==='object'&&raw.page&&typeof raw.page==='object'?raw.page:raw;
  if(!page||typeof page!=='object'||Array.isArray(page)){this.error.set('Ожидается объект страницы');return;}
  if(page.slug&&page.slug!==this.slug){this.error.set(`JSON относится к странице «${page.slug}», а открыта «${this.slug}»`);return;}
  if(page.sections!==undefined&&!Array.isArray(page.sections)){this.error.set('Поле sections должно быть массивом');return;}
  const sections:PageSection[]=[];
  for(const [index,item] of (page.sections??this.model.sections).entries()){
   if(!item||typeof item!=='object'){this.error.set(`Раздел ${index+1}: ожидается объект`);return;}
   const title=String(item.title??'').trim();
   const body=String(item.body??'').trim();
   if(!title&&!body){this.error.set(`Раздел ${index+1}: нужен заголовок или текст`);return;}
   sections.push({number:String(item.number??String(index+1).padStart(2,'0')),title,body});
  }
  this.model={
   title:page.title!==undefined?String(page.title):this.model.title,
   lead:page.lead!==undefined?String(page.lead):this.model.lead,
   sections,
   contact_text:page.contact_text!==undefined?String(page.contact_text??''):this.model.contact_text,
   is_published:page.is_published!==undefined?Boolean(page.is_published):this.model.is_published,
  };
  this.message.set(`Перенесено в форму. Разделов: ${sections.length}. Нажмите «Сохранить».`);
 }
}
