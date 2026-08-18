import { PLATFORM_ID, Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Уменьшает размер шрифта элемента, пока текст не поместится в заданное число строк. */
@Directive({selector:'[fitText]'})
export class FitText implements OnChanges,OnDestroy{
 /** Значение, при смене которого нужно пересчитать размер. */
 @Input() fitText:unknown;
 @Input() fitLines=3;
 /** Ниже этого размера шрифт не опускается, даже если текст не помещается. */
 @Input() fitMinSize=18;
 private readonly host=inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
 private readonly zone=inject(NgZone);
 private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));
 private resizeObserver?:ResizeObserver;
 private textObserver?:MutationObserver;
 private frame=0;
 private retries=0;
 private lastWidth=-1;

 ngOnChanges():void{
  if(!this.browser)return;
  this.observe();
  this.schedule();
 }

 ngOnDestroy():void{
  this.resizeObserver?.disconnect();
  this.textObserver?.disconnect();
  if(this.frame)cancelAnimationFrame(this.frame);
 }

 private observe():void{
  if(this.resizeObserver||typeof ResizeObserver==='undefined')return;
  this.zone.runOutsideAngular(()=>{
   // Ширина меняется при повороте экрана и при первой раскладке страницы.
   this.resizeObserver=new ResizeObserver(()=>{const width=this.host.clientWidth;if(width===this.lastWidth)return;this.lastWidth=width;this.schedule();});
   this.resizeObserver.observe(this.host);
   // Текст приходит асинхронно (данные материала), и к моменту первого замера
   // элемент может быть пустым — следим за его содержимым.
   this.textObserver=new MutationObserver(()=>this.schedule());
   this.textObserver.observe(this.host,{childList:true,characterData:true,subtree:true});
   // Веб-шрифты меняют метрики уже после первой отрисовки.
   void (document as Document & {fonts?:FontFaceSet}).fonts?.ready.then(()=>this.schedule());
  });
 }

 private schedule():void{
  this.retries=0;
  this.run();
 }

 private run():void{
  if(this.frame)cancelAnimationFrame(this.frame);
  this.zone.runOutsideAngular(()=>{this.frame=requestAnimationFrame(()=>{this.frame=0;this.fit();});});
 }

 private fit():void{
  const style=this.host.style;
  style.removeProperty('font-size');
  const computed=getComputedStyle(this.host);
  const base=parseFloat(computed.fontSize);
  // До первой раскладки ширина нулевая: повторяем на следующих кадрах,
  // иначе размер остаётся исходным и заголовок занимает лишние строки.
  if(!base||!this.host.clientWidth){if(this.retries++<20)this.run();return;}
  const ratio=parseFloat(computed.lineHeight)/base||1.2;
  const lines=Math.max(1,this.fitLines);
  const fits=(size:number):boolean=>{style.fontSize=`${size}px`;return this.host.scrollHeight<=Math.ceil(size*ratio*lines)+1;};
  this.lastWidth=this.host.clientWidth;
  if(fits(base)){style.removeProperty('font-size');return;}
  let low=this.fitMinSize,high=base;
  while(high-low>0.5){const middle=(low+high)/2;if(fits(middle))low=middle;else high=middle;}
  fits(low);
 }
}
