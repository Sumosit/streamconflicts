import { Component, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService, ConflictDto, PersonDto } from '../api.service';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';
import { SeoService } from '../seo.service';
import { T } from '../i18n';
import { SITE } from '../../site-config';

@Component({selector:'app-person-page',imports:[RouterLink,PublicHeader,PublicFooter],template:`
<app-public-header/><main class="page"><a class="back" routerLink="/people">{{t.person.back}}</a>@if(person()){<section class="profile-head">@if(person()!.avatar_url){<img class="avatar avatar-image" [src]="person()!.avatar_url" [alt]="person()!.name">}@else{<span class="avatar">{{person()!.initials}}</span>}<div><span class="kicker">{{t.person.kicker}}</span><h1>{{person()!.name}}</h1></div></section><p class="lead">{{person()!.bio||t.person.defaultBio}}</p><div class="filters">@for(link of linkEntries();track link[0]){<a class="back" [href]="link[1]" target="_blank" rel="noopener">{{link[0]}} ↗</a>}</div><section class="list">@for(item of conflicts();track item.id){<a class="card" [routerLink]="['/conflicts',item.slug]"><div><span class="kicker">{{relation(item)}}</span><h3>{{item.title}}</h3><p>{{item.summary}}</p><div class="meta"><span>{{item.events.length}} {{t.units.events}}</span><span>{{item.category}}</span></div></div><span class="arrow">↗</span></a>}</section>}@else{<div class="empty">{{t.person.empty}}</div>}</main><app-public-footer/>`,styleUrl:'./public-pages.scss'})
export class PersonPage{
 protected readonly t=T;private api=inject(ApiService);private slug=inject(ActivatedRoute).snapshot.paramMap.get('slug')||'';protected person=signal<PersonDto|null>(null);protected conflicts=signal<ConflictDto[]>([]);
 constructor(){const seo=inject(SeoService);this.api.conflicts().subscribe(items=>{const related=items.filter(item=>item.people.some(r=>r.person?.slug===this.slug));this.conflicts.set(related);const person=related.flatMap(i=>i.people).find(r=>r.person?.slug===this.slug)?.person||null;this.person.set(person);if(person)seo.set({title:`${person.name} - ${T.people.seoTitle}`,description:person.bio||`${person.name} - ${T.people.seoDescription}`,path:`/people/${person.slug}`,image:person.avatar_url,type:'profile',breadcrumbs:[{name:T.nav.people,path:'/people'},{name:person.name,path:`/people/${person.slug}`}],structuredData:{'@context':'https://schema.org','@type':'Person',name:person.name,image:person.avatar_url||undefined,url:`${SITE.baseUrl}${SITE.path}/people/${person.slug}`,sameAs:Object.values(person.links||{}).filter(Boolean)}});else seo.set({title:T.person.notFoundTitle,description:T.person.notFoundDescription,path:`/people/${this.slug}`,noindex:true})})}
 protected relation(item:ConflictDto){return item.people.find(r=>r.person?.slug===this.slug)?.relation==='commentator'?T.person.commentated:T.person.participant}
 protected linkEntries():[string,string][]{return Object.entries(this.person()?.links||{}).filter((entry):entry is [string,string]=>Boolean(entry[1]))}
}
