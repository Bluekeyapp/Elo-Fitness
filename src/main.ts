import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Remove offline caches left by the original GLUTELAB service worker (prefix `glutelab-`).
// Never from the test copy: the old app may still be in use on the same site.
if ('caches' in window && !__TEST_BUILD__) {
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('glutelab-')).map(k => caches.delete(k))))
    .catch(() => {})
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
