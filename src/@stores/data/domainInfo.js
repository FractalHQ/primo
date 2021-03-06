import { writable, readable, derived, get } from 'svelte/store';

const store = writable({
  isSubdomain: false,
  domainName: '',
  onDev: true,
  page: ''
})

export default {
  save: (prop = {}) => {
    if (prop && Object.keys(prop).length > 0) {
      store.update(s => ({...s, ...prop}))
    }
  },
  subscribe: store.subscribe
}