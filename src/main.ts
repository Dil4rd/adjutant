import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { applyTheme, resolveTheme, storedPref } from './lib/theme'

// Settle the theme before the first paint, so a light-theme user does not get
// a flash of the dark board on every load.
applyTheme(resolveTheme(storedPref()))

export default mount(App, { target: document.getElementById('app')! })
