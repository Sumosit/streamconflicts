import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';
import { ApiService, SitePageDto } from '../api.service';
import { SeoService } from '../seo.service';
import { T } from '../i18n';
import { SITE } from '../../site-config';

@Component({selector:'app-about-page',imports:[PublicHeader,PublicFooter],template:`
<app-public-header/><main class="page">@if(page()){<span class="kicker">{{kicker}}</span><h1>{{page()!.title}}</h1><p class="lead">{{page()!.lead}}</p>
<section class="principles">@for(section of page()!.sections;track $index){<article class="principle"><span>{{section.number}}</span><h2>{{section.title}}</h2><p>{{section.body}}</p></article>}</section>
@if(page()!.contact_text){<section class="principle" style="margin-top:12px"><span>{{t.about.contact}}</span><p>{{page()!.contact_text}}</p></section>}}@else if(missing()){<div class="empty">{{t.about.notPublished}}</div>}@else{<div class="empty">{{t.about.loading}}</div>}</main><app-public-footer/>`,styleUrl:'./public-pages.scss'})
export class AboutPage{
 protected readonly t=T;private api=inject(ApiService);protected page=signal<SitePageDto|null>(null);protected missing=signal(false);
 private readonly route=inject(ActivatedRoute);
 /** Одна страница обслуживает /about и /rules: slug и заголовок приходят из маршрута. */
 protected readonly slug=this.route.snapshot.data['pageSlug']||'about';
 protected readonly kicker=this.slug==='rules'?T.rules.kicker:T.about.kicker;
 constructor(){const seo=inject(SeoService);const path=`/${this.slug==='about'?'about':this.slug}`;this.api.page(this.slug).subscribe({next:value=>{this.page.set(value);seo.set({title:`${value.title} - ${SITE.siteName}`,description:value.lead,path,breadcrumbs:[{name:value.title,path}]})},error:()=>{this.missing.set(true);seo.set({title:this.slug==='rules'?T.rules.seoTitle:T.about.seoTitle,description:this.slug==='rules'?T.rules.seoDescription:T.about.seoDescription,path,noindex:true})}})}
}
