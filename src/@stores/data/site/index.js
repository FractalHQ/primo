import { writable, readable, derived, get } from 'svelte/store';
import ShortUniqueId from 'short-unique-id';
import { tailwindConfig } from '../../../const'

import domainInfo from '../domainInfo'
import { pageId } from '../page'
import allSites from '../allSites'

let site
const store = writable({
  pages: [
    {
      id: getUniqueId(),
      title: 'New Page',
      content: [
        {
          id: getUniqueId(),
          width: 'contained',
          columns: [
            {
              id: getUniqueId(),
              size: 'w-full',
              rows: [
                {
                  id: getUniqueId(),
                  type: 'content',
                  value: {
                    html: '<p><br></p>'
                  }
                }
              ]
            }
          ]
        }
      ],
      styles: {
        raw: '',
        final: '',
        tailwind: '{  theme: {    container: {      center: true    }  },  variants: {}}'
      },
      dependencies: {
        headEmbed : '',
        libraries: [],
        // customScripts: [],
      },
      settings: {
        javascript: '',
        identity : {
          title: '', 
          url: '',
          description: ''
        }
      },
      wrapper: {
        raw: {
          head: '',
          above: '',
          below: ''
        },
        final: {
          head: '',
          above: '',
          below: ''
        }
      },
      fields: []
    },
  ],
  fields: [],
  styles: {
    raw: '',
    final: '',
    tailwind: tailwindConfig
  },
  wrapper: {
    head: {
      raw: '',
      final: ''
    },
    below: {
      raw: '',
      final: ''
    }
  },
  symbols: [],
})
store.subscribe(s => {
  site = s
  allSites.saveSite(site)
})

export default {
  set: store.set,
  subscribe: store.subscribe, 
  update: store.update,
  fields: {
    save: (fields) => {
      store.update(s => ({
        ...s,
        fields 
      }))
    }
  },
  saveCurrentPage: (newData) => {
    console.log('saving current page', newData, get(pageId))
    store.update(s => ({
      ...s,
      pages: s.pages.map(p => p.id === get(pageId) ? ({
        ...p,
        ...newData
      }) : p)
    }))
  },
  pages: {
    add: (page) => {
      store.update(s => ({
        ...s, 
        pages: [ ...s.pages, page ]
      }))
    },
    remove: (pageId) => {
      store.update(s => ({
        ...s,
        pages: s.pages.filter(page => page.id !== pageId)
      }))
    },
    modify: (page) => {
      store.update(s => ({
        ...s,
        pages: s.pages.map(p => p.id === page.id ? page : p)
      }))
    },
    hydrateComponents: async () => {
      const updatedPages = await Promise.all(site.pages.map(async page => {
        const updatedContent = await hydrateAllComponents(page.content)
        return {
          ...page,
          content: updatedContent
        }
      }))
      store.update(s => ({
        ...s, 
        pages: updatedPages
      }))
    }
  },
  saveStyles: async (styles) => {
    store.update(s => ({ ...s, styles }))
  },
  savePageSettings: (settings) => {
    const { pageId } = get(domainInfo)
    store.update(s => ({ 
      ...s,  
      pages: s.pages.map(page => page.id === pageId ? ({
          ...page,
          settings
      }) : page)
    }))
  },
  save: (data = {}) => {
    store.update(s => ({ ...s, ...data }))
    // saveToSite(data)
  },
  saveContent: (content) => {
    const { page:pageId } = get(domainInfo)
    store.update(s => ({ 
      ...s,  
      pages: s.pages.map(page => page.id === pageId ? ({
          ...page,
          content
      }) : page)
    }))
  }
};


// REDUCERS
async function saveSiteData(data) {
  store.update(s => ({ ...s, data }))
}

async function hydrateSitePagesContent(exclude = null) {
  const updatedPages = await hydrateSiteComponents(exclude)
  // await saveAllPages(updatedPages) // TODO
}

async function hydrateComponentLibrary() {
  // const components = await getComponents() // TODO
  const hydratedComponents = await Promise.all( components.map(async component => await hydrateComponent(component)) )
  // await Promise.all([ hydratedComponents.map(async component => saveSymbolToDomain(component)) ]) TODO
}

async function hydrateAllComponents(content) {
  return await Promise.all(
    content.map(async section => ({
      ...section,
      columns: await Promise.all(
        section.columns.map(async column => ({
        ...column,
        rows: await Promise.all(
          column.rows.map(async row => {
            if (row.type === 'content') return row
            else return hydrateComponent(row)
          })
        )
      })))
    }))
  )
}

// HELPERS
async function hydrateSiteComponents(exclude = null) {
  // // const pages = await getAllPages() // TODO
  // const pages = get(store).pages
  // const updatedPages = await Promise.all(pages.filter(page => page.settings.identity.url !== exclude).map(async page => ({
  //   ...page,
  //   content: await hydrateAllComponents(page.content)
  // })))
  // return updatedPages
}

async function hydrateComponent(component) {
  const {value} = component
  const fields = getAllFields(component)
  const data = await convertFieldsToData(fields, 'all')
  const finalHTML = await parseHandlebars(value.raw.html, data)
  component.value.final.html = finalHTML
  return component
}

function getUniqueId() {
  return new ShortUniqueId().randomUUID(5).toLowerCase();
}