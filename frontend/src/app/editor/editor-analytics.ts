import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsSummaryDto, ApiService } from '../api.service';

@Component({
  selector: 'app-editor-analytics',
  imports: [RouterLink],
  template: `
    <main class="editor-shell analytics-page">
      <header class="editor-header"><a routerLink="/editor"><b>← Материалы</b></a><div class="actions">@for(value of periods;track value){<button class="button" [class.primary]="days()===value" (click)="setDays(value)">{{value}} дней</button>}</div></header>
      <div class="section-head"><div><span class="muted">СОБСТВЕННАЯ АНАЛИТИКА</span><h1>Статистика посещений</h1><p class="muted">Посетитель определяется по метке в браузере, без кук. Уникальный просмотр — пара «посетитель + страница» за период, повторные обновления страницы не учитываются.</p></div></div>
      <nav class="analytics-language-tabs" aria-label="Язык статистики">@for(item of languages;track item.value){<button class="button" [class.primary]="siteLang()===item.value" (click)="setLanguage(item.value)">{{item.label}}</button>}</nav>
      @if(error()){<p class="error">{{error()}}</p>}
      @if(data();as report){
        <section class="analytics-metrics"><article><span>За всё время</span><b>{{report.all_time.visitors}}</b><small>посетителей@if(report.all_time.since){ · с {{formatDate(report.all_time.since)}}}</small></article><article><span>Возвращались</span><b>{{report.all_time.returning_visitors}}</b><small>заходили более чем в один день</small></article><article><span>Сегодня</span><b>{{report.today.visitors}}</b><small>посетителей · {{report.today.new_visitors}} впервые</small></article><article><span>За {{report.days}} дней</span><b>{{report.totals.visitors}}</b><small>посетителей · {{report.totals.views}} уникальных просмотров</small></article></section><section class="analytics-metrics"><article><span>Новые за период</span><b>{{report.audience.new_visitors}}</b><small>пришли впервые</small></article><article><span>Вернувшиеся за период</span><b>{{report.audience.returning_visitors}}</b><small>{{report.audience.returning_rate}}% активной аудитории</small></article><article><span>Дней на посетителя</span><b>{{report.audience.avg_days}}</b><small>в среднем за период</small></article><article><span>Страниц на посетителя</span><b>{{ratio(report.totals.views,report.totals.visitors)}}</b><small>{{report.totals.raw_views}} просмотров всего · {{report.totals.unique_ips}} IP</small></article></section>
        <section class="panel"><div class="section-head"><h2>По дням</h2><span class="muted">Посетители / просмотры · из них впервые</span></div><div class="analytics-chart">@for(day of report.daily;track day.date){<div class="chart-row"><time>{{formatDate(day.date)}}</time><div><i [style.width.%]="barWidth(day.views,report.daily)"></i></div><b>{{day.visitors}} / {{day.views}}@if(day.new_visitors){<em> · {{day.new_visitors}} новых</em>}</b></div>}@empty{<p class="muted">Посещений за этот период пока нет.</p>}</div></section>
        <section class="panel"><div class="section-head"><h2>Частота визитов</h2><span class="muted">Сколько разных дней заходил посетитель</span></div><div class="analytics-table">@for(item of report.frequency;track item.bucket){<div><span>{{item.bucket}}</span><b>{{item.visitors}}</b></div>}</div></section><div class="analytics-columns"><section class="panel"><div class="section-head"><h2>Популярные страницы</h2><span class="muted">Посетители / просмотры</span></div><div class="analytics-table">@for(page of report.pages;track page.path){<a [href]="page.path" target="_blank" rel="noopener"><span>{{page.path}}</span><b>{{page.visitors}} / {{page.views}}</b></a>}@empty{<p class="muted">Данных пока нет.</p>}</div></section><section class="panel"><h2>Источники переходов</h2><div class="analytics-table">@for(item of report.referrers;track item.referrer){<div><span [title]="item.referrer">{{referrerLabel(item.referrer)}}</span><b>{{item.views}}</b></div>}@empty{<p class="muted">Внешних переходов пока нет.</p>}</div></section></div>
      } @else if(!error()) { <p class="muted">Загрузка статистики...</p> }
    </main>
  `,
  styleUrl: './editor.scss',
})
export class EditorAnalytics {
  private readonly api=inject(ApiService);
  protected readonly periods=[7,30,90];
  protected readonly languages=[{value:'ru' as const,label:'RU'},{value:'en' as const,label:'EN'},{value:'all' as const,label:'Общая'}];
  protected readonly days=signal(30);
  protected readonly siteLang=signal<'ru'|'en'|'all'>('all');
  protected readonly data=signal<AnalyticsSummaryDto|null>(null);
  protected readonly error=signal('');
  constructor(){this.load();}
  protected setDays(days:number):void{this.days.set(days);this.load();}
  protected setLanguage(siteLang:'ru'|'en'|'all'):void{this.siteLang.set(siteLang);this.load();}
  private load():void{this.error.set('');this.data.set(null);this.api.analytics(this.days(),this.siteLang()).subscribe({next:value=>this.data.set(value),error:()=>this.error.set('Не удалось загрузить статистику')});}
  protected ratio(views:number,visitors:number):string{return visitors?(views/visitors).toFixed(1):'0';}
  protected barWidth(views:number,rows:{views:number}[]):number{const max=Math.max(1,...rows.map(row=>row.views));return Math.max(2,views/max*100);}
  protected formatDate(value:string):string{return new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'2-digit'});}
  protected referrerLabel(value:string):string{try{const url=new URL(value);return `${url.hostname}${url.pathname==='/'?'':url.pathname}`;}catch{return value;}}
}
