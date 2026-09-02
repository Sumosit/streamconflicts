import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, HistoryCategoryAdminDto } from '../api.service';

type Draft = { ru: string; en: string; parent_id: number | null; slug: string; is_platform: boolean };

@Component({selector:'app-editor-history-categories',imports:[FormsModule,RouterLink],template:`<main class="editor-shell">
<header class="editor-header"><a routerLink="/editor/history"><b>← История</b></a></header>
<div class="section-head"><div><h1>Разделы истории</h1><p class="muted">Меню левой колонки на сайте. Разделы заводятся здесь вручную: импорт их не создаёт, иначе дерево зарастает вариантами одного названия.</p></div><span>{{items().length}}</span></div>

<section class="panel">
 <span class="muted">НОВЫЙ РАЗДЕЛ</span>
 <div class="grid">
  <label>Название RU<input [(ngModel)]="draft.ru" placeholder="Платформы"></label>
  <label>Название EN<input [(ngModel)]="draft.en" placeholder="Platforms"></label>
  <label>Вложить в<select [(ngModel)]="draft.parent_id"><option [ngValue]="null">Верхний уровень</option>@for(item of items();track item.id){<option [ngValue]="item.id">{{item.path}}</option>}</select></label>
  <label>Slug<input [(ngModel)]="draft.slug" placeholder="пусто - из английского названия"></label>
 </div>
 <label class="history-check"><input type="checkbox" [(ngModel)]="draft.is_platform"> Это площадка</label>
 <div class="people-io-row"><button class="button primary" type="button" (click)="create()" [disabled]="busy()">Добавить раздел</button></div>
 @if(error()){<p class="error">{{error()}}</p>}
 @if(note()){<p class="success">{{note()}}</p>}
</section>

<section class="list">
 @for(item of items();track item.id){
  <article class="list-row">
   <div>
    <span class="badge">{{item.slug}}@if(item.is_platform){ · ПЛОЩАДКА}@if(!item.is_published){ · СКРЫТ}</span>
    <h3 [style.paddingLeft.px]="item.depth*18">{{item.title}}</h3>
    <span class="muted">{{item.path}}</span>
    <p class="muted history-row-meta"><span>событий: {{item.event_count}}</span><span>вложенных: {{item.child_count}}</span><span>EN: {{item.titles['en']||'нет'}}</span></p>
   </div>
   <div class="actions">
    <button class="button" type="button" (click)="edit(item)">Изменить</button>
    <button class="button" type="button" (click)="move(item,-1)" [disabled]="busy()">Выше</button>
    <button class="button" type="button" (click)="move(item,1)" [disabled]="busy()">Ниже</button>
    <button class="button danger" type="button" (click)="remove(item)" [disabled]="busy()">Удалить</button>
   </div>
  </article>
 }@empty{<div class="panel">{{loading()?'Загружаем...':'Разделов нет. Создайте первый в форме выше.'}}</div>}
</section>

@if(editing();as item){<section class="panel">
 <div class="section-head"><h2>{{item.title}}</h2><span class="muted">{{item.slug}}</span></div>
 <div class="grid">
  <label>Название RU<input [(ngModel)]="form.ru"></label>
  <label>Название EN<input [(ngModel)]="form.en"></label>
  <label>Вложить в<select [(ngModel)]="form.parent_id"><option [ngValue]="null">Верхний уровень</option>@for(option of parentOptions(item);track option.id){<option [ngValue]="option.id">{{option.path}}</option>}</select></label>
  <label>Slug<input [(ngModel)]="form.slug"><small class="muted">Меняет адрес раздела в фильтре на сайте.</small></label>
 </div>
 <label class="history-check"><input type="checkbox" [(ngModel)]="form.is_platform"> Это площадка</label>
 <label class="history-check"><input type="checkbox" [(ngModel)]="published"> Показывать на сайте</label>
 <div class="people-io-row"><button class="button primary" type="button" (click)="save(item)" [disabled]="busy()">Сохранить</button><button class="button" type="button" (click)="editing.set(null)">Отмена</button></div>
</section>}
</main>`,styleUrl:'./editor.scss'})
export class EditorHistoryCategories{
 private readonly api=inject(ApiService);
 protected readonly items=signal<HistoryCategoryAdminDto[]>([]);
 protected readonly editing=signal<HistoryCategoryAdminDto|null>(null);
 protected readonly loading=signal(true);
 protected readonly busy=signal(false);
 protected readonly error=signal('');
 protected readonly note=signal('');
 protected draft:Draft={ru:'',en:'',parent_id:null,slug:'',is_platform:false};
 protected form:Draft={ru:'',en:'',parent_id:null,slug:'',is_platform:false};
 protected published=true;

 constructor(){this.load();}

 /** Раздел нельзя вложить в самого себя или в собственного потомка. */
 protected parentOptions(item:HistoryCategoryAdminDto):HistoryCategoryAdminDto[]{
  const banned=new Set<number>([item.id]);
  let grew=true;
  while(grew){
   grew=false;
   for(const candidate of this.items())
    if(candidate.parent_id!==null&&banned.has(candidate.parent_id)&&!banned.has(candidate.id)){
     banned.add(candidate.id);
     grew=true;
    }
  }
  return this.items().filter(candidate=>!banned.has(candidate.id));
 }

 protected create():void{
  const titles:Record<string,string>={};
  if(this.draft.ru.trim())titles['ru']=this.draft.ru.trim();
  if(this.draft.en.trim())titles['en']=this.draft.en.trim();
  if(!Object.keys(titles).length){this.error.set('Нужно хотя бы одно название');return;}
  this.run(this.api.createHistoryCategory({
   titles,parent_id:this.draft.parent_id,slug:this.draft.slug.trim()||null,is_platform:this.draft.is_platform,
   sort_order:this.items().filter(item=>item.parent_id===this.draft.parent_id).length,
  }),()=>{
   this.note.set(`Раздел «${this.draft.ru||this.draft.en}» добавлен`);
   this.draft={ru:'',en:'',parent_id:this.draft.parent_id,slug:'',is_platform:false};
  });
 }

 protected edit(item:HistoryCategoryAdminDto):void{
  this.editing.set(item);
  this.form={
   ru:item.titles['ru']||'',en:item.titles['en']||'',
   parent_id:item.parent_id,slug:item.slug,is_platform:item.is_platform,
  };
  this.published=item.is_published;
 }

 protected save(item:HistoryCategoryAdminDto):void{
  const titles:Record<string,string>={ru:this.form.ru.trim(),en:this.form.en.trim()};
  if(!titles['ru']&&!titles['en']){this.error.set('Нужно хотя бы одно название');return;}
  this.run(this.api.updateHistoryCategory(item.id,{
   titles,slug:this.form.slug.trim()||null,is_platform:this.form.is_platform,is_published:this.published,
   // detach отличает «вынести в корень» от «родителя не меняем».
   parent_id:this.form.parent_id,detach:this.form.parent_id===null,
  }),()=>{this.note.set('Сохранено');this.editing.set(null);});
 }

 /** Порядок задаётся внутри одного уровня, поэтому переставляем среди соседей. */
 protected move(item:HistoryCategoryAdminDto,direction:number):void{
  const siblings=this.items()
   .filter(candidate=>candidate.parent_id===item.parent_id)
   .sort((left,right)=>left.sort_order-right.sort_order||left.id-right.id);
  const index=siblings.findIndex(candidate=>candidate.id===item.id);
  const target=index+direction;
  if(index===-1||target<0||target>=siblings.length)return;
  const reordered=[...siblings];
  [reordered[index],reordered[target]]=[reordered[target],reordered[index]];
  this.run(this.api.reorderHistoryCategories(reordered.map(candidate=>candidate.id)));
 }

 protected remove(item:HistoryCategoryAdminDto):void{
  if(!window.confirm(`Удалить раздел «${item.title}»?`))return;
  this.run(this.api.deleteHistoryCategory(item.id),()=>this.note.set('Раздел удалён'));
 }

 private run(request:{subscribe:Function},after?:()=>void):void{
  this.busy.set(true);this.error.set('');this.note.set('');
  request.subscribe({
   next:()=>{this.busy.set(false);after?.();this.load();},
   error:(response:any)=>{this.busy.set(false);this.error.set(response.error?.detail||'Не удалось выполнить действие');},
  });
 }

 private load():void{
  this.loading.set(true);
  this.api.historyAdminCategories().subscribe({
   next:rows=>{this.items.set(rows);this.loading.set(false);},
   error:()=>{this.items.set([]);this.loading.set(false);},
  });
 }
}
