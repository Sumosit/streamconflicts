import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, ConflictDto, PersonDto } from '../api.service';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';
import { SeoService } from '../seo.service';
import { T, LOCALE } from '../i18n';

interface PersonSummary { person:PersonDto; conflicts:number; comments:number }

@Component({selector:'app-people-page',imports:[FormsModule,RouterLink,PublicHeader,PublicFooter],template:`
<app-public-header/><main class="page"><span class="kicker">{{t.people.kicker}}</span><h1>{{t.people.title}}</h1><p class="lead">{{t.people.lead}}</p><div class="toolbar"><input class="search" type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="t.people.searchPlaceholder"><span class="meta">{{filtered().length}} {{t.people.profiles}}</span></div>
<section class="people-grid">@for(item of filtered();track item.person.id){<a class="person" [routerLink]="['/people',item.person.slug]"><div class="person-head">@if(item.person.avatar_url){<img class="avatar avatar-image" [src]="item.person.avatar_url" [alt]="item.person.name">}@else{<span class="avatar">{{item.person.initials}}</span>}<div><h3>{{item.person.name}}</h3><small>{{item.person.slug}}</small></div></div><dl><div><dt>{{t.people.participation}}</dt><dd>{{item.conflicts}}</dd></div><div><dt>{{t.people.comments}}</dt><dd>{{item.comments}}</dd></div></dl></a>}@empty{<div class="empty">{{t.people.empty}}</div>}</section></main><app-public-footer/>`,styleUrl:'./public-pages.scss'})
export class PeoplePage{
 protected readonly t=T;private api=inject(ApiService);private items=signal<PersonSummary[]>([]);protected query=signal('');protected filtered=computed(()=>{const q=this.query().trim().toLowerCase();return this.items().filter(x=>!q||x.person.name.toLowerCase().includes(q)||x.person.slug.includes(q))});
 constructor(){inject(SeoService).set({title:T.people.seoTitle,description:T.people.seoDescription,path:'/people'});this.api.conflicts().subscribe(v=>this.items.set(this.summarize(v)))}
 private summarize(conflicts:ConflictDto[]):PersonSummary[]{const map=new Map<number,PersonSummary>();for(const conflict of conflicts)for(const relation of conflict.people){if(!relation.person||relation.person.profile_status==='hidden'||(relation.person.entity_type&&relation.person.entity_type!=='streamer'))continue;const current=map.get(relation.person.id)??{person:relation.person,conflicts:0,comments:0};if(relation.relation==='participant')current.conflicts++;if(relation.relation==='commentator')current.comments++;map.set(relation.person.id,current)}return [...map.values()].sort((a,b)=>a.person.name.localeCompare(b.person.name,LOCALE))}
}
