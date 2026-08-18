import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, ConflictDto, ConflictPersonDto, EventDto, PersonDto, SourceDto } from '../api.service';
import { SITE } from '../../site-config';

type Draft = Pick<ConflictDto,'slug'|'title'|'summary'|'cover_image_url'|'is_featured'|'priority_enabled'|'priority'|'category'|'status'|'next_action'|'is_published'> & {events:EventDto[];people:ConflictPersonDto[]};
type ValidationIssue = { severity:'error'|'warning'; text:string; target:string };

@Component({selector:'app-editor-form',imports:[FormsModule,RouterLink],templateUrl:'./editor-form.html',styleUrl:'./editor.scss'})
export class EditorForm {
 private api=inject(ApiService);private route=inject(ActivatedRoute);private router=inject(Router);
 protected id=Number(this.route.snapshot.paramMap.get('id'))||null;
 /** Абсолютный путь внутри своей языковой версии: на англ. сайте добавляет /en. */
 protected siteUrl(path:string):string{return SITE.path+path;}
 private submissionId=Number(this.route.snapshot.queryParamMap.get('submission'))||null;
 protected peopleOptions=signal<PersonDto[]>([]);protected saving=signal(false);protected deleting=signal(false);protected message=signal('');protected error=signal('');
 private allConflicts:ConflictDto[]=[];
 protected exportOpen=signal(false);protected exportTitle=signal('');protected exportText=signal('');protected exportCopied=signal(false);
 protected eventImportOpen=signal(false);protected eventJson='';protected eventJsonError=signal('');
 protected readonly eventJsonExample='[{"occurred_at":"2026-08-04T14:30:00+03:00","event_type":"update","title":"Новое событие","body":"Что произошло","is_commentary":false,"sources":[]}]';
 protected personPickerOpen=signal(false);protected personSearch=signal('');protected personType=signal('all');
 protected readonly platforms=['Telegram','YouTube','Twitch','Kick','X','VK','TikTok','Instagram','Discord','Сайт'];
 protected readonly platformPicker=signal<string|null>(null);
 protected model:Draft={slug:'',title:'',summary:'',cover_image_url:null,is_featured:false,priority_enabled:false,priority:0,category:'',status:'draft',next_action:'',is_published:false,events:[],people:[]};
 protected filteredPeople=computed(()=>{const q=this.personSearch().trim().toLowerCase(),type=this.personType();const used=new Set(this.model.people.map(p=>Number(p.person_id)));return this.peopleOptions().filter(person=>!used.has(person.id)&&(type==='all'||person.entity_type===type)&&(!q||person.name.toLowerCase().includes(q)||person.slug.includes(q)));});

 constructor(){forkJoin({people:this.api.people(),conflicts:this.api.adminConflicts()}).subscribe({next:r=>{this.peopleOptions.set(r.people);this.allConflicts=r.conflicts;if(this.id){const item=r.conflicts.find(x=>x.id===this.id);if(item)this.model=this.toDraft(item);else this.error.set('Материал не найден');}else if(this.submissionId){this.prefillSubmission(this.submissionId);}},error:()=>this.error.set('Не удалось загрузить данные редактора')});}
 private prefillSubmission(id:number):void{this.api.submissions().subscribe(items=>{const item=items.find(value=>value.id===id);if(!item)return;this.model.summary=item.description;this.model.events=[{occurred_at:new Date().toISOString().slice(0,16),event_type:'source',title:'Предложенный источник',body:item.description,is_commentary:false,position:0,sources:[{platform:this.platformFromUrl(item.source_url),url:item.source_url,title:'Предложенный источник',source_status:'primary',media_type:'link',thumbnail_url:''}]}];});}
 private platformFromUrl(value:string):string{try{const host=new URL(value).hostname.replace('www.','');if(host.includes('youtube'))return'YouTube';if(host.includes('twitch'))return'Twitch';if(host.includes('kick'))return'Kick';if(host.includes('t.me'))return'Telegram';return host;}catch{return'Источник';}}
 private toDraft(item:ConflictDto):Draft{return {...item,priority_enabled:Boolean(item.priority_enabled),priority:item.priority??0,next_action:item.next_action||'',events:item.events.map(e=>({...e,occurred_at:e.occurred_at?.slice(0,16)||'',sources:e.sources.map(s=>({...s}))})),people:item.people.map(p=>({...p,person_id:p.person?.id}))};}
 protected makeSlug():void{this.model.slug=this.model.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/[а-яё]/gi,c=>translit[c.toLowerCase()]||'').replace(/-+/g,'-').replace(/^-|-$/g,'');}
 protected addEvent():void{this.model.events.push({occurred_at:new Date().toISOString().slice(0,16),event_type:'update',title:'',body:'',is_commentary:false,position:this.model.events.length,sources:[]});}
 protected insertEvent(index:number):void{this.model.events.splice(index+1,0,{occurred_at:new Date().toISOString().slice(0,16),event_type:'update',title:'',body:'',is_commentary:false,position:index+1,sources:[]});this.remapEventIds(id=>id>index?id+1:id);this.renumberEvents();}
 protected removeEvent(index:number):void{this.model.events.splice(index,1);this.remapEventIds(id=>id===index?null:id>index?id-1:id);this.renumberEvents();}
 protected moveEvent(index:number,direction:-1|1):void{const target=index+direction;if(target<0||target>=this.model.events.length)return;[this.model.events[index],this.model.events[target]]=[this.model.events[target],this.model.events[index]];this.remapEventIds(id=>id===index?target:id===target?index:id);this.renumberEvents();}
 /** Переставляет события по дате. События без даты уходят в конец, их взаимный порядок сохраняется. */
 protected sortEventsByDate():void{
  const indexed=this.model.events.map((event,index)=>({event,index}));
  indexed.sort((a,b)=>{
   const left=a.event.occurred_at?Date.parse(a.event.occurred_at):Number.POSITIVE_INFINITY;
   const right=b.event.occurred_at?Date.parse(b.event.occurred_at):Number.POSITIVE_INFINITY;
   return (left-right)||(a.index-b.index);
  });
  const moved=indexed.some((entry,position)=>entry.index!==position);
  if(!moved){this.message.set('События уже идут по дате');return;}
  const mapping=new Map(indexed.map((entry,position)=>[entry.index,position]));
  this.model.events=indexed.map(entry=>entry.event);
  this.remapEventIds(id=>mapping.has(id)?mapping.get(id)!:null);
  this.renumberEvents();
  this.message.set('События переставлены по дате. Не забудьте сохранить.');
 }
 private renumberEvents():void{this.model.events.forEach((e,i)=>e.position=i);}
 private remapEventIds(map:(id:number)=>number|null):void{for(const relation of this.model.people){const next=(relation.event_ids||[]).map(map).filter((id):id is number=>id!==null);relation.event_ids=[...new Set(next)].sort((a,b)=>a-b);}}
 protected addSource(event:EventDto):void{event.sources.push({platform:'Twitch',url:'https://',title:'',source_status:'primary',media_type:'video',thumbnail_url:''});}
 protected removeSource(event:EventDto,index:number):void{event.sources.splice(index,1);}
 protected moveSource(event:EventDto,index:number,direction:-1|1):void{const target=index+direction;if(target<0||target>=event.sources.length)return;[event.sources[index],event.sources[target]]=[event.sources[target],event.sources[index]];}
 protected platformOptions(value:string):string[]{const query=value.trim().toLowerCase();if(!query||this.platforms.some(item=>item.toLowerCase()===query))return this.platforms;return this.platforms.filter(item=>item.toLowerCase().includes(query));}
 protected selectPlatform(source:SourceDto,value:string):void{source.platform=value;this.platformPicker.set(null);}
 protected closePlatformPicker(key:string):void{window.setTimeout(()=>{if(this.platformPicker()===key)this.platformPicker.set(null);},120);}
 protected addExisting(person:PersonDto):void{this.model.people.push({person_id:person.id,relation:person.entity_type==='streamer'?'participant':'commentator',role:'',event_ids:[]});this.personPickerOpen.set(false);this.personSearch.set('');}
 protected removeRelation(index:number):void{this.model.people.splice(index,1);}
 protected setEventIds(relation:ConflictPersonDto,value:string):void{relation.event_ids=value.split(',').map(v=>Number(v.trim())).filter(v=>Number.isInteger(v)&&v>=0);}
 protected uploadCover(input:HTMLInputElement):void{const file=input.files?.[0];if(!file)return;this.api.uploadImage(file).subscribe({next:r=>this.model.cover_image_url=r.url,error:()=>this.error.set('Не удалось загрузить обложку')});}
 protected showExport(detailed:boolean):void{const conflict=this.exportConflict(detailed);const root=detailed?{schema_version:1,exported_at:new Date().toISOString(),people_catalog:this.exportPeople(),conflict}:this.instructionExport(conflict);this.exportTitle.set(detailed?'Подробный JSON материала':'Короткий JSON для обновления');this.exportText.set(JSON.stringify(root,null,2));this.exportCopied.set(false);this.exportOpen.set(true);this.eventImportOpen.set(false);}
 protected async copyExport():Promise<void>{await navigator.clipboard.writeText(this.exportText());this.exportCopied.set(true);window.setTimeout(()=>this.exportCopied.set(false),1600);}
 protected openEventImport():void{this.eventJson='';this.eventJsonError.set('');this.eventImportOpen.set(true);this.exportOpen.set(false);}
 protected addEventFromJson():void{
  this.eventJsonError.set('');
  try{
   const root=JSON.parse(this.eventJson);
   const raws=Array.isArray(root)?root:Array.isArray(root?.events)?root.events:[root?.event||root];
   if(!raws.length)throw new Error('Массив событий пуст');
   const events=raws.map((raw:any,index:number)=>this.importEvent(raw,index));
   this.model.events.push(...events);
   this.eventImportOpen.set(false);this.eventJson='';
   this.message.set(events.length===1?'Событие добавлено в форму. Сохраните материал.':`Добавлено событий: ${events.length}. Сохраните материал.`);
   requestAnimationFrame(()=>document.querySelector('.event-box:last-of-type')?.scrollIntoView({behavior:'smooth',block:'center'}));
  }catch(e){this.eventJsonError.set(e instanceof Error?e.message:'Не удалось разобрать JSON событий');}
 }
 private importEvent(raw:any,index:number):EventDto{
  const prefix=`Событие ${index+1}: `;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(`${prefix}ожидается объект`);
  if(!String(raw.title||'').trim())throw new Error(`${prefix}не заполнено поле title`);
  if(!String(raw.body||'').trim())throw new Error(`${prefix}не заполнено поле body`);
  if(raw.sources!==undefined&&!Array.isArray(raw.sources))throw new Error(`${prefix}поле sources должно быть массивом`);
  const allowed=['initial','statement','response','reaction','update','resolution','correction'];
  return{occurred_at:this.importEventDate(raw.occurred_at),event_type:allowed.includes(raw.event_type)?raw.event_type:'update',title:String(raw.title).trim(),body:String(raw.body).trim(),is_commentary:Boolean(raw.is_commentary),position:this.model.events.length+index,sources:(raw.sources||[]).map((source:any,sourceIndex:number)=>{const url=this.cleanUrl(source?.url);if(!url)throw new Error(`${prefix}у источника ${sourceIndex+1} должен быть URL`);return{platform:String(source.platform||'Источник'),url,title:String(source.title||source.platform||'Источник'),source_status:['primary','confirmation','secondary'].includes(source.source_status)?source.source_status:'primary',media_type:['video','post','image','link'].includes(source.media_type)?source.media_type:'link',thumbnail_url:this.cleanUrl(source.thumbnail_url)||'',duration_seconds:source.duration_seconds==null?null:Number(source.duration_seconds)};})};
 }
 private exportPeople():unknown[]{const ids=new Set(this.model.people.map(entry=>Number(entry.person_id)));return this.peopleOptions().filter(person=>ids.has(person.id)).map(person=>({slug:person.slug,name:person.name,initials:person.initials,entity_type:person.entity_type||'streamer',profile_status:person.profile_status||'active',avatar_url:person.avatar_url||null,bio:person.bio||null,links:person.links||{}}));}
 private instructionExport(conflict:unknown):unknown{const urls=this.model.events.flatMap(event=>event.sources.map(source=>source.url.trim())).filter(Boolean);const normalized=urls.map(url=>url.replace(/\/$/,'').toLowerCase());const chronology=this.model.events.map(event=>event.occurred_at?new Date(event.occurred_at).getTime():null).filter((value):value is number=>value!==null&&!Number.isNaN(value));return{research:{topic:this.model.title,language:'ru',timezone:'Europe/Moscow',researched_at:new Date().toISOString(),limitations:[]},people_catalog:this.exportPeople(),conflict,quality_check:{all_events_have_sources:this.model.events.every(event=>event.sources.length>0),all_urls_checked:false,positions_separated_from_facts:false,chronology_sorted:chronology.every((value,index)=>index===0||chronology[index-1]<=value),duplicate_sources_removed:new Set(normalized).size===normalized.length,unverified_claims:[],missing_information:this.warningIssues().map(issue=>issue.text)}};}
 private exportConflict(detailed:boolean):unknown{const personById=new Map(this.peopleOptions().map(person=>[person.id,person]));return{slug:this.model.slug,title:this.model.title,summary:this.model.summary,cover_image_url:this.model.cover_image_url||null,is_featured:detailed?Boolean(this.model.is_featured):false,priority_enabled:detailed?Boolean(this.model.priority_enabled):false,priority:detailed?Number(this.model.priority)||0:0,category:this.model.category,status:this.model.status,next_action:this.model.next_action||null,is_published:detailed?Boolean(this.model.is_published):false,people:this.model.people.map(entry=>({person_slug:personById.get(Number(entry.person_id))?.slug||String(entry.person_id),relation:entry.relation,role:entry.role||null,event_indexes:entry.event_ids||[]})),events:this.model.events.map((event,index)=>({occurred_at:this.exportEventDate(event.occurred_at),event_type:event.event_type,title:event.title,body:event.body,is_commentary:Boolean(event.is_commentary),position:index,sources:event.sources.map(source=>({platform:source.platform,url:source.url,title:source.title,source_status:source.source_status,media_type:source.media_type,thumbnail_url:source.thumbnail_url||null,duration_seconds:source.duration_seconds??null}))}))};}
 private exportEventDate(value:string|null):string|null{if(!value)return null;return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)?`${value}:00+03:00`:value;}
 private importEventDate(raw:unknown):string{if(raw===null||raw===undefined||String(raw).trim()==='')return'';const value=String(raw).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(value))return`${value}T12:00`;const match=value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);if(match)return`${match[1]}T${match[2]}:${match[3]}`;throw new Error('Дата должна быть в формате YYYY-MM-DD, ISO 8601 или null');}
 private cleanUrl(raw:unknown):string|null{if(raw===null||raw===undefined)return null;const value=String(raw).trim();if(!value)return null;const markdown=value.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/);return markdown?markdown[1]:value;}
 protected validationIssues():ValidationIssue[]{
  const issues:ValidationIssue[]=[];const add=(severity:ValidationIssue['severity'],text:string,target:string)=>issues.push({severity,text,target});
  const title=this.model.title.trim(),slug=this.model.slug.trim(),summary=this.model.summary.trim(),category=this.model.category.trim();
  if(!title)add('error','Не заполнен заголовок','field-title');else if(title.length>70)add('warning',`Заголовок длиннее 70 символов (${title.length})`,'field-title');
  if(!slug)add('error','Не заполнен slug','field-slug');else if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))add('error','Slug может содержать только латиницу, цифры и дефисы','field-slug');else if(this.allConflicts.some(item=>item.id!==this.id&&item.slug===slug))add('error','Этот slug уже занят другим материалом','field-slug');
  if(!summary)add('error','Не заполнено краткое описание','field-summary');else{if(summary.length<120)add('warning',`Краткое описание короче 120 символов (${summary.length})`,'field-summary');if(summary.length>320)add('warning',`Краткое описание длиннее 320 символов (${summary.length})`,'field-summary');}
  if(!category)add('error','Не заполнена категория','field-category');
  if(!this.model.cover_image_url)add('warning','Не загружена обложка','field-cover');
  if(!this.model.people.some(person=>person.relation==='participant'))add('warning','Не указаны участники конфликта','people-section');
  if(!this.model.events.length)add('error','В материале нет событий','events-section');else if(this.model.events.length<3)add('warning',`В хронологии только ${this.model.events.length} события`,'events-section');
  const seenUrls=new Map<string,number>();let totalSources=0,primarySources=0;
  this.model.events.forEach((event,index)=>{const target=`event-${index}`;if(!event.occurred_at)add('error',`Событие ${index+1}: не указана дата`,target);else if(new Date(event.occurred_at).getTime()>Date.now()+300000)add('warning',`Событие ${index+1}: дата находится в будущем`,target);if(!event.title.trim())add('error',`Событие ${index+1}: не заполнен заголовок`,target);if(!event.body.trim())add('error',`Событие ${index+1}: не заполнено описание`,target);if(!event.sources.length)add('warning',`Событие ${index+1}: нет источников`,target);event.sources.forEach(source=>{totalSources++;if(source.source_status==='primary')primarySources++;const url=source.url.trim();try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw new Error();}catch{add('error',`Событие ${index+1}: некорректный URL источника`,target);}if(url){const normalized=url.replace(/\/$/,'').toLowerCase();const previous=seenUrls.get(normalized);if(previous!==undefined)add('warning',`Источник из события ${index+1} уже используется в событии ${previous+1}`,target);else seenUrls.set(normalized,index);}if(!source.title.trim())add('warning',`Событие ${index+1}: у источника нет названия`,target);});});
  if(this.model.events.length&&totalSources===0)add('error','Во всём материале нет ни одного источника','events-section');else if(totalSources>0&&primarySources===0)add('warning','Нет источников со статусом «Первоисточник»','events-section');
  if(['closed','archived'].includes(this.model.status)&&!this.model.events.some(event=>event.event_type==='resolution'))add('warning','У завершённого материала нет события с типом «Итог»','events-section');
  return issues;
 }
 protected criticalIssues():ValidationIssue[]{return this.validationIssues().filter(issue=>issue.severity==='error');}
 protected warningIssues():ValidationIssue[]{return this.validationIssues().filter(issue=>issue.severity==='warning');}
 protected readiness():number{const issues=this.validationIssues();return Math.max(0,Math.round(100-issues.filter(issue=>issue.severity==='error').length*12-issues.filter(issue=>issue.severity==='warning').length*4));}
 protected goToIssue(target:string):void{const eventMatch=target.match(/^event-(\d+)$/);const element=eventMatch?document.querySelectorAll<HTMLElement>('.event-box')[Number(eventMatch[1])+this.model.people.length]:document.getElementById(target);(element||document.querySelector<HTMLElement>('.readiness-panel'))?.scrollIntoView({behavior:'smooth',block:'center'});}
 protected save():void{this.saving.set(true);this.error.set('');this.message.set('');
  const payload={...this.model,priority_enabled:Boolean(this.model.priority_enabled),priority:Number(this.model.priority)||0,next_action:this.model.next_action||null,events:this.model.events.map((e,i)=>({occurred_at:e.occurred_at?new Date(e.occurred_at).toISOString():null,event_type:e.event_type,title:e.title,body:e.body,is_commentary:e.is_commentary,position:i,sources:e.sources.map(s=>({platform:s.platform,url:s.url,title:s.title,source_status:s.source_status,media_type:s.media_type,thumbnail_url:s.thumbnail_url||null,duration_seconds:s.duration_seconds||null}))})),people:this.model.people.map(p=>({person_id:Number(p.person_id),relation:p.relation,role:p.role||null,event_ids:p.event_ids||[]}))};
  const request=this.id?this.api.updateConflict(this.id,{...payload,change_description:'Материал обновлен через редактор'}):this.api.createConflict(payload);
  request.subscribe({next:item=>{this.saving.set(false);this.message.set('Сохранено');if(!this.id)void this.router.navigate(['/editor/conflicts',item.id]);},error:e=>{this.saving.set(false);this.error.set(typeof e.error?.detail==='string'?e.error.detail:'Не удалось сохранить материал');}});
 }
 protected deleteMaterial():void{if(!this.id||this.model.is_published)return;if(!window.confirm(`Удалить материал «${this.model.title}» без возможности восстановления?`))return;this.deleting.set(true);this.error.set('');this.api.deleteConflict(this.id).subscribe({next:()=>void this.router.navigate(['/editor']),error:e=>{this.deleting.set(false);this.error.set(typeof e.error?.detail==='string'?e.error.detail:'Не удалось удалить материал');}});}
}

const translit:Record<string,string>={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
