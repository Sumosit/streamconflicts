import { Component, computed, inject, RESPONSE_INIT, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, ConflictDto, SourceDto } from '../api.service';
import { PublicHeader } from '../public/public-header';
import { FitText } from './fit-text';
import { PublicFooter } from '../public/public-footer';
import { SeoService } from '../seo.service';
import { T, LOCALE, statusLabel, eventKindLabel } from '../i18n';
import { SITE } from '../../site-config';

interface TimelineEvent { time: string; type: string; eventType: string; title: string; text: string; source: string; url?: string; mediaType?: string; thumbnail?: string | null; sources: SourceDto[]; current?: boolean }
interface ConflictRecord {
  title: string; summary: string; cover: string | null; status: string; statusKey: string; updated: string; category: string;
  people: { name: string; slug: string; initials: string; avatar: string | null; color: string }[];
  commentators: { name: string; slug: string; initials: string; avatar: string | null; role: string; eventIndexes: number[] }[];
  events: TimelineEvent[];
}
interface RelatedConflict { slug:string; title:string; summary:string; cover:string|null; status:string; updated:string; events:number; reason:string }

@Component({
  selector: 'app-conflict-page', imports: [RouterLink, FormsModule, PublicHeader, PublicFooter, FitText],
  templateUrl: './conflict-page.html', styleUrl: './conflict-page.scss',
})
export class ConflictPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  protected conflict: ConflictRecord = { title: T.about.loading, summary: '', cover: null, status: '', statusKey: '', updated: '', category: '', people: [], commentators: [], events: [] };
  protected loadError = false;
  protected readonly t = T;
  protected readonly previewMode = this.route.snapshot.data['preview'] === true;
  protected readonly activeEventIndex = signal<number | null>(null);
  protected readonly hideCommentary = signal(false);
  protected readonly newestFirst = signal(true);
  protected readonly copiedEventIndex = signal<number | null>(null);
  protected readonly pageLinkCopied = signal(false);
  protected readonly correctionOpen = signal(false);
  protected readonly correctionSent = signal(false);
  protected changeLog: { date: string; text: string }[] = [];
  protected readonly relatedConflicts = signal<RelatedConflict[]>([]);
  protected correction = { statement: '', source_url: '', contact: '' };
  private readonly dataVersion = signal(0);
  protected readonly visibleEventsCount = computed(() => {
    this.dataVersion();
    return this.hideCommentary()
      ? this.conflict.events.filter((_, index) => !this.isCommentaryEvent(index)).length
      : this.conflict.events.length;
  });

  constructor() {
    if (this.previewMode) {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      this.api.adminConflicts().subscribe({ next: items => { const item=items.find(value=>value.id===id); if(!item){this.handleLoadError();return;} this.applyConflict(item); }, error: () => this.handleLoadError() });
      return;
    }
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.seo.set({
      title: T.record.seoTitle,
      description: T.record.seoDescription,
      path: `/conflicts/${slug}`,
      type: 'article',
    });
    this.api.conflict(slug).subscribe({ next: item => this.applyConflict(item), error: () => this.handleLoadError(slug) });
  }

  private applyConflict(item:ConflictDto):void { this.conflict = this.mapConflict(item); this.changeLog = item.changes.map(change => ({ date: this.formatDate(change.created_at), text: change.description })); this.dataVersion.update(value => value + 1); const cover=this.conflict.cover;this.seo.set({title:`${item.title}${T.record.seoRecordSuffix}`,description:item.summary,path:this.previewMode?`/editor/conflicts/${item.id}/preview`:`/conflicts/${item.slug}`,image:cover,type:'article',noindex:this.previewMode,breadcrumbs:this.previewMode?undefined:[{name:T.record.breadcrumbArchive,path:'/archive'},{name:item.title,path:`/conflicts/${item.slug}`}],structuredData:this.previewMode?undefined:{'@context':'https://schema.org','@type':'Article',headline:item.title,description:item.summary,image:cover||undefined,datePublished:item.created_at,dateModified:item.updated_at,mainEntityOfPage:`${SITE.baseUrl}${SITE.path}/conflicts/${item.slug}`,publisher:{'@type':'Organization',name:SITE.siteName,url:`${SITE.baseUrl}${SITE.path}`,logo:{'@type':'ImageObject',url:`${SITE.baseUrl}/streamconflict-logo-512x512.png`}}}}); if(!this.previewMode)this.loadRelated(item); }

  private loadRelated(current:ConflictDto):void {
    const currentParticipants=new Set(current.people.filter(entry=>entry.relation==='participant').map(entry=>entry.person?.id).filter((id):id is number=>id!=null));
    const currentCommentators=new Set(current.people.filter(entry=>entry.relation==='commentator').map(entry=>entry.person?.id).filter((id):id is number=>id!=null));
    this.api.conflicts().subscribe({next:items=>{
      const ranked=items.filter(item=>item.id!==current.id).map(item=>{
        const participants=item.people.filter(entry=>entry.relation==='participant'&&entry.person).map(entry=>entry.person!);
        const commentators=item.people.filter(entry=>entry.relation==='commentator'&&entry.person).map(entry=>entry.person!);
        const sharedParticipants=participants.filter(person=>currentParticipants.has(person.id));
        const sharedCommentators=commentators.filter(person=>currentParticipants.has(person.id)||currentCommentators.has(person.id));
        const sameCategory=Boolean(current.category&&item.category===current.category);
        const score=sharedParticipants.length*10+sharedCommentators.length*3+(sameCategory?1:0);
        const names=[...sharedParticipants,...sharedCommentators].filter((person,index,array)=>array.findIndex(value=>value.id===person.id)===index).map(person=>person.name);
        return {item,score,reason:names.length?`${T.record.sharedPeople}: ${names.join(', ')}`:sameCategory?`${T.record.category}: ${item.category}`:''};
      }).filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score||new Date(b.item.updated_at).getTime()-new Date(a.item.updated_at).getTime()).slice(0,6);
      this.relatedConflicts.set(ranked.map(({item,reason})=>({slug:item.slug,title:item.title,summary:item.summary,cover:item.cover_image_url||item.events.flatMap(event=>event.sources).find(source=>source.thumbnail_url)?.thumbnail_url||null,status:item.status,updated:this.formatDate(item.updated_at),events:item.events.length,reason})));
    }});
  }

  private handleLoadError(slug = ''): void {
    this.loadError = true;
    if (this.responseInit) this.responseInit.status = 404;
    this.seo.set({
      title: T.record.seoNotFoundTitle,
      description: T.record.seoNotFoundDescription,
      path: this.previewMode ? `/${this.route.snapshot.url.map(segment => segment.path).join('/')}` : `/conflicts/${slug}`,
      noindex: true,
    });
  }

  private mapConflict(item: ConflictDto): ConflictRecord {
    const relations = item.people.filter(entry => entry.person);
    const colors = ['#7657ff','#ed6d5a','#36a6a0','#e1a83b','#925ad5'];
    return {
      title:item.title,summary:item.summary,cover:item.cover_image_url||item.events.flatMap(event=>event.sources).find(source=>source.thumbnail_url)?.thumbnail_url||null,status:statusLabel(item.status),statusKey:item.status,updated:this.formatDate(item.updated_at),category:item.category,
      people:relations.filter(entry=>entry.relation==='participant').map((entry,index)=>({name:entry.person!.name,slug:entry.person!.slug,initials:entry.person!.initials,avatar:entry.person!.avatar_url||null,color:colors[index%colors.length]})),
      commentators:relations.filter(entry=>entry.relation==='commentator').map(entry=>({name:entry.person!.name,slug:entry.person!.slug,initials:entry.person!.initials,avatar:entry.person!.avatar_url||null,role:entry.role||T.record.publicComment,eventIndexes:entry.event_ids||[]})),
      events:item.events.map((event,index)=>{const source=event.sources[0];return {time:this.formatDate(event.occurred_at),type:`${source?.platform||T.record.update} · ${event.event_type}`.toUpperCase(),eventType:event.event_type,title:event.title,text:event.body,source:source?.title||T.record.noSource,url:source?.url||'',mediaType:source?.media_type||'link',thumbnail:source?.thumbnail_url,sources:event.sources,current:index===item.events.length-1};}),
    };
  }

  private formatDate(value:string|null):string { return value ? new Date(value).toLocaleString(LOCALE,{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) : T.record.noDate; }

  protected isCommentaryEvent(index: number): boolean {
    return this.conflict.commentators.some((person) => person.eventIndexes.includes(index));
  }

  protected scrollToEvent(index: number): void {
    if (this.hideCommentary() && this.isCommentaryEvent(index)) {
      this.hideCommentary.set(false);
    }
    this.activeEventIndex.set(index);
    requestAnimationFrame(() =>
      document.getElementById(`event-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }

  protected isVideo(type: string): boolean {
    return type.includes('TWITCH') || type.includes('YOUTUBE');
  }

  protected isPost(type: string): boolean {
    return type.includes('TELEGRAM') || type.startsWith('X ');
  }

  protected videoDuration(index: number): string {
    return ['02:18', '04:36', '01:42'][index % 3];
  }

  protected eventKind(index: number): string {
    if (this.isCommentaryEvent(index)) return T.eventKind.commentary;
    return eventKindLabel(this.conflict.events[index]?.eventType);
  }

  protected sourceStatus(event: TimelineEvent): string {
    if (event.current) return T.record.confirmations;
    if (this.isVideo(event.type) || this.isPost(event.type)) return T.sourceStatus.primary;
    return T.record.editorChecked;
  }

  protected sourceStatusLabel(value: string): string {
    return (T.sourceStatus as Record<string, string>)[value] || value;
  }

  protected sourceTypeLabel(value: string): string {
    return (T.sourceType as Record<string, string>)[value] || value;
  }

  protected nextAction(): string {
    if (this.conflict.statusKey === 'closed' || this.conflict.statusKey === 'archived') return T.record.nextClosed;
    if (this.conflict.statusKey === 'quiet') return T.record.nextQuiet;
    return T.record.nextDefault;
  }

  protected async copyEventLink(index: number): Promise<void> {
    const url = `${window.location.origin}${window.location.pathname}#event-${index}`;
    await navigator.clipboard.writeText(url);
    this.copiedEventIndex.set(index);
    window.setTimeout(() => this.copiedEventIndex.set(null), 1600);
  }

  protected async copyPageLink(): Promise<void> {
    await navigator.clipboard.writeText(window.location.href.split('#')[0]);
    this.pageLinkCopied.set(true);
    window.setTimeout(() => this.pageLinkCopied.set(false), 1600);
  }

  protected openCorrection(): void {
    this.correctionSent.set(false);
    this.correctionOpen.set(true);
  }

  protected submitCorrection(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api.submitCorrection(slug, this.correction).subscribe({ next: () => this.correctionSent.set(true) });
  }
}
