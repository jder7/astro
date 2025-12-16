import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app');

if (target) {
  const page = target.dataset.page || 'home';
  mount(App, {
    target,
    props: { page },
  });
}
