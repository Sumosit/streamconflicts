import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, HistoryEventDetailDto } from '../api.service';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';
import { SeoService } from '../seo.service';
import { SITE } from '../../site-config';
import { T } from '../i18n';
import { historyDateLabel, historyRangeLabel } from './history-format';

@Component({selector:'app-history-event-page',imports:[RouterLink,PublicHeader,PublicFooter],template:`
<app-public-header/><main class="page history-event">
@if(event();as item){
 <a class="back" routerLink="/history">{{t.history.backToList}}</a>
 @if(item.breadcrumbs.length){<nav class="history-crumbs" [attr.aria-label]="t.history.menuTitle">@for(crumb of item.breadcrumbs;track crumb.slug){<a [routerLink]="['/history']" [queryParams]="{category:crumb.slug}">{{crumb.title}}</a>}</nav>}
 <span class="kicker">{{dateLabel(item)}}</span>
 <h1>{{item.title}}</h1>
 @if(approximate(item)){<p class="history-precision">{{t.history.approximate}}</p>}
 <p class="lead">{{item.summary}}</p>
 @if(item.translation_missing){<aside class="history-notice"><span>{{t.history.translationMissing}}</span><a [href]="other.href">{{t.history.translationAction}}</a></aside>}
 @if(cover(item);as image){<figure class="history-cover"><img [src]="image.file_url" [alt]="image.alt_text||item.title" loading="lazy">@if(image.caption){<figcaption>{{image.caption}}</figcaption>}</figure>}
 <div class="history-body">
  @if(item.historical_context){<section><h2>{{t.history.context}}</h2><p>{{item.historical_context}}</p></section>}
  @if(item.content){<section><h2>{{t.history.whatHappened}}</h2><p>{{item.content}}</p></section>}
  @if(item.consequences){<section><h2>{{t.history.consequences}}</h2><p>{{item.consequences}}</p></section>}
 </div>
 @if(gallery(item).length){<section class="history-section"><h2>{{t.history.gallery}}</h2><div class="history-gallery">@for(image of gallery(item);track image.id){<figure><img [src]="image.file_url" [alt]="image.alt_text||item.title" loading="lazy">@if(image.caption){<figcaption>{{image.caption}}</figcaption>}</figure>}</div></section>}
 @if(item.people.length){<section class="history-section"><h2>{{t.history.people}}</h2><div class="history-people">@for(person of item.people;track person.id){<a class="history-person" [routerLink]="['/people',person.slug]"><span class="avatar">{{person.initials}}</span><span><b>{{person.name}}</b>@if(person.role){<small>{{person.role}}</small>}</span></a>}</div></section>}
 @if(item.sources.length){<section class="history-section"><h2>{{t.history.sources}}</h2><ol class="history-sources">@for(source of item.sources;track source.id){<li><a [href]="source.url" target="_blank" rel="noopener nofollow">{{source.title}}</a>@if(source.publisher){<small>{{source.publisher}}</small>}</li>}</ol></section>}
 @if(item.related.length){<section class="history-section"><h2>{{t.history.related}}</h2><div class="list">@for(related of item.related;track related.id){<a class="card history-card" [routerLink]="['/history',related.slug]"><div><span class="kicker">{{dateLabel(related)}}</span><h3>{{related.title}}</h3><p>{{related.summary}}</p></div><span class="arrow">↗</span></a>}</div></section>}
}@else{<div class="empty">{{loading()?t.history.loading:t.history.empty}}</div>}
</main><app-public-footer/>`,styleUrls:['./public-pages.scss','./history.scss']})
export class HistoryEventPage{
 private readonly api=inject(ApiService);
 private readonly route=inject(ActivatedRoute);
 private readonly seo=inject(SeoService);
 protected readonly t=T;
 protected readonly other=SITE.other;
 protected readonly event=signal<HistoryEventDetailDto|null>(null);
 protected readonly loading=signal(true);

 constructor(){
  this.route.paramMap.subscribe(params=>{
   const slug=params.get('slug');
   if(!slug)return;
   this.loading.set(true);
   this.api.historyEvent(slug).subscribe({
    next:item=>{this.event.set(item);this.loading.set(false);this.applySeo(item);},
    error:()=>{this.event.set(null);this.loading.set(false);},
   });
  });
 }

 protected dateLabel(item:{date_start:string|null;date_end:string|null;date_precision:string}):string{
  return historyRangeLabel(item.date_start,item.date_end,item.date_precision);
 }
 protected approximate(item:HistoryEventDetailDto):boolean{return item.date_precision!=='day'&&item.date_precision!=='unknown';}
 protected cover(item:HistoryEventDetailDto){return item.images.find(image=>image.is_cover&&image.file_url)||null;}
 protected gallery(item:HistoryEventDetailDto){return item.images.filter(image=>image.file_url&&!image.is_cover);}

 private applySeo(item:HistoryEventDetailDto):void{
  this.seo.set({
   title:`${item.title} - ${T.history.kicker}`,
   description:item.summary,
   path:`/history/${item.slug}`,
   type:'article',
   image:this.cover(item)?.file_url??item.cover_image_url??null,
   breadcrumbs:[
    {name:T.history.kicker,path:'/history'},
    ...item.breadcrumbs.map(crumb=>({name:crumb.title,path:`/history?category=${crumb.slug}`})),
    {name:item.title,path:`/history/${item.slug}`},
   ],
   structuredData:{
    '@context':'https://schema.org',
    '@type':'Article',
    headline:item.title,
    description:item.summary,
    datePublished:item.date_start??undefined,
    // Источники в разметке: событие без них мы не публикуем, и поисковику
    // полезно видеть, на что опирается текст.
    citation:item.sources.map(source=>source.url),
   },
  });
 }
}
