import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';

@Component({ selector:'app-editor-login', imports:[FormsModule], template:`
  <main class="login panel">
    <span class="muted">СТРИМАРХИВ</span><h1>Вход в редактор</h1>
    <form (ngSubmit)="submit()">
      <label>Email<input type="email" name="email" [(ngModel)]="email" required autocomplete="username"></label><br>
      <label>Пароль<input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password"></label><br>
      @if(error()){<p class="error">{{error()}}</p>}
      <button class="button primary" [disabled]="loading()">{{loading()?'Входим...':'Войти'}}</button>
    </form>
  </main>`, styleUrl:'./editor.scss' })
export class EditorLogin {
  private api=inject(ApiService); private auth=inject(AuthService); private router=inject(Router);
  protected email=''; protected password=''; protected loading=signal(false); protected error=signal('');
  protected submit():void { this.loading.set(true); this.error.set(''); this.api.login(this.email,this.password).subscribe({
    next:r=>{this.auth.save(r.access_token); void this.router.navigate(['/editor']);},
    error:()=>{this.loading.set(false);this.error.set('Неверный email или пароль');}
  }); }
}

