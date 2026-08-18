import { Routes } from '@angular/router';
import { editorGuard } from './auth.service';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./public/home-route').then(m => m.HomeRoute) },
  { path: 'conflicts/:slug', loadComponent: () => import('./conflict-page/conflict-page').then(m => m.ConflictPage) },
  { path: 'archive', loadComponent: () => import('./public/archive-page').then(m => m.ArchivePage) },
  { path: 'people', loadComponent: () => import('./public/people-page').then(m => m.PeoplePage) },
  { path: 'people/:slug', loadComponent: () => import('./public/person-page').then(m => m.PersonPage) },
  { path: 'about', loadComponent: () => import('./public/about-page').then(m => m.AboutPage), data: { pageSlug: 'about' } },
  { path: 'rules', loadComponent: () => import('./public/about-page').then(m => m.AboutPage), data: { pageSlug: 'rules' } },
  { path: 'editor/login', loadComponent: () => import('./editor/editor-login').then(m => m.EditorLogin) },
  { path: 'editor', loadComponent: () => import('./editor/editor-list').then(m => m.EditorList), canActivate: [editorGuard] },
  { path: 'editor/import', loadComponent: () => import('./editor/editor-json-import').then(m => m.EditorJsonImport), canActivate: [editorGuard] },
  { path: 'editor/conflicts/new', loadComponent: () => import('./editor/editor-form').then(m => m.EditorForm), canActivate: [editorGuard] },
  { path: 'editor/conflicts/:id/preview', loadComponent: () => import('./conflict-page/conflict-page').then(m => m.ConflictPage), canActivate: [editorGuard], data: { preview: true } },
  { path: 'editor/conflicts/:id', loadComponent: () => import('./editor/editor-form').then(m => m.EditorForm), canActivate: [editorGuard] },
  { path: 'editor/corrections', loadComponent: () => import('./editor/editor-corrections').then(m => m.EditorCorrections), canActivate: [editorGuard] },
  { path: 'editor/submissions', loadComponent: () => import('./editor/editor-submissions').then(m => m.EditorSubmissions), canActivate: [editorGuard] },
  { path: 'editor/analytics', loadComponent: () => import('./editor/editor-analytics').then(m => m.EditorAnalytics), canActivate: [editorGuard] },
  { path: 'editor/people', loadComponent: () => import('./editor/editor-people').then(m => m.EditorPeople), canActivate: [editorGuard] },
  { path: 'editor/people/new', loadComponent: () => import('./editor/editor-person-form').then(m => m.EditorPersonForm), canActivate: [editorGuard] },
  { path: 'editor/people/:id', loadComponent: () => import('./editor/editor-person-form').then(m => m.EditorPersonForm), canActivate: [editorGuard] },
  { path: 'editor/pages/about', loadComponent: () => import('./editor/editor-about').then(m => m.EditorAbout), canActivate: [editorGuard], data: { pageSlug: 'about' } },
  { path: 'editor/pages/rules', loadComponent: () => import('./editor/editor-about').then(m => m.EditorAbout), canActivate: [editorGuard], data: { pageSlug: 'rules' } },
  { path: '**', loadComponent: () => import('./public/not-found-page').then(m => m.NotFoundPage) },
];
