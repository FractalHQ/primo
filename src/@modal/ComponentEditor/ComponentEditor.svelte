<script lang="ts">
  import _ from "lodash";
  import ShortUniqueId from "short-unique-id";
  import pluralize from 'pluralize'
  import { createEventDispatcher, onMount, onDestroy, setContext } from 'svelte'
  import { fade } from 'svelte/transition'
  const dispatch = createEventDispatcher()

  import API from './Fields/Api.svelte'
  import TextAreaField from './Fields/TextAreaField.svelte'
  import MessageField from './Fields/MessageField.svelte'
  import GroupField from './Fields/GroupField.svelte'
  import RepeaterField from './Fields/RepeaterField.svelte'
  // import ImageField from './ImageField.svelte'

  import {ContentField, EditField, GenericField, ImageField, SubField as SubfieldField} from '../../@components/inputs'
  import {PrimaryButton,SaveButton} from '../../@components/buttons'
  import {IconButton,Tabs} from '../../@components/misc'
  import {CodeMirror} from '../../@components'
  import {Card} from '../../@components/misc'
  import FullCodeEditor from './FullCodeEditor.svelte'
  import {CodePreview} from '../../@components/misc'

  import { parseHandlebars, convertFieldsToData, processStyles, createDebouncer, wrapInStyleTags } from '../../utils'

  import {dependencies, user} from '../../@stores/data'
  import site from '../../@stores/data/site'
  import pageData from '../../@stores/data/pageData'
  import content from '../../@stores/data/page/content'
  import symbols from '../../@stores/data/site/symbols'
  import {editorViewDev} from '../../@stores/app'
  import modal from '../../@stores/app/modal'

  // This is the only way I could figure out how to get lodash's debouncer to work correctly
  const slowDebounce = createDebouncer(1000)
  const quickDebounce = createDebouncer(500)

  import type {Subfield, Field, Fields, Component, Property, FieldType} from '../../types/components'

  export let component:Component = {
    type: 'component',
    id: getUniqueId(),
    symbolID: null,
    value: {
      raw: {
        html: '',
        css: '',
        js: '',
        fields: []
      },
      final: {
        html: '',
        css: '',
        js: ''
      }
    }
  }
  export let button;

  let localComponent:Component = _.cloneDeep(component)

  function saveRawValue(property:Property, value:any): void {
    localComponent.value.raw[property] = value
  }

  function saveFinalValue(property:Property, value:string): void {
    localComponent.value.final[property] = value
  }

  function getAllFields() {
    const siteFields = _.cloneDeep($site.fields)
    const pageFields = _.cloneDeep($pageData.fields)
    // const componentFields = localComponent.value.raw.fields;
    const allFields = _.unionBy(siteFields, pageFields, fields, "key");
    return allFields
  }

  let loading:boolean = false

  let fields:Fields = localComponent.value.raw.fields

  let rawHTML:string = localComponent.value.raw.html
  let finalHTML:string = localComponent.value.final.html
  $: compileHtml(rawHTML)
  async function compileHtml(html:string): Promise<void> {
    loading = true
    saveRawValue('html', html)
    const allFields = getAllFields()
    const data = await convertFieldsToData(allFields, 'all')
    const processedHTML = await parseHandlebars(rawHTML, data)
    finalHTML = processedHTML
    quickDebounce([() => {loading = false}])
    saveFinalValue('html', finalHTML)
  }

  let rawCSS:string = localComponent.value.raw.css
  let finalCSS:string = localComponent.value.final.css
  // $: compileCss(rawCSS)
  $: quickDebounce([compileCss, rawCSS])
  $: ((css) => { loading = true })(rawCSS)
  async function compileCss(css:string): Promise<void> {
    saveRawValue('css', css)
    loading = true
    const encapsulatedCss:string = `#component-${localComponent.id} {${css}}`
    const result:string = await processStyles(encapsulatedCss, localComponent.value.final.html, {
      tailwindConfig: $site.styles.tailwind
    })
    if (result) {
      finalCSS = result
      saveFinalValue('css', finalCSS)
    } 
    loading = false
  }

  let rawJS:string = localComponent.value.raw.js
  let finalJS:string = localComponent.value.final.js
  $: compileJs(rawJS)
  async function compileJs(js:string): Promise<void> {
    // this is where we can introduce TS/Babel later
    finalJS = js
    saveRawValue('js', js)
    saveFinalValue('js', finalJS)
  }

  async function updateHtmlWithFieldData(typeToUpdate:string): Promise<void> {
    loading = true
    const allFields:Fields = getAllFields()
    let data = await convertFieldsToData(allFields, typeToUpdate)
    finalHTML = await parseHandlebars(rawHTML, data)
    saveFinalValue('html', finalHTML)
    refreshFields()
    quickDebounce([() => {loading = false}])
  }

  function separateFromSymbol(): void {
    localComponent.symbolID = null
    disabled = false
  }

  async function loadSymbol(): Promise<void> {
    disabled = false
    const symbol:Component = symbols.get(localComponent.symbolID)
    localComponent = _.cloneDeep(symbol)
    modal.show('COMPONENT_EDITOR', {
      component: symbol,
      button: {
        label: `Save ${symbol.title || 'Symbol'}`,
        onclick: async (symbol) => {
          loading = true
          await Promise.all([
            symbols.place(symbol),
            content.updateInstances(symbol),
            // updateInstancesInDomain(symbol), // TODO
          ])
          site.save({ symbols: $symbols })
          modal.hide()
        }
      }
    }, {
      header: {
        title: `Edit ${symbol.title || 'Symbol'}`,
        icon: 'fas fa-th-large'
      },
    })
  }

  function addNewField(): void {
    fields = [
      ...fields,
      createField()
    ]
    saveRawValue('fields', fields)

    function createField () { 
      return {
        id: getUniqueId(),
        key: '',
        label: '',
        value: '',
        type: 'text',
        fields: []
      }
    }
  }

  function getUniqueId() {
    return new ShortUniqueId().randomUUID(5).toLowerCase();
  }

  function addSubField(id:string): void {
    fields = fields.map(field => ({
      ...field,
      fields: field.id === id ? [
        ...field.fields,
        {
          id: getUniqueId(),
          key: '',
          label: '',
          value: '',
          type: 'text'
        }
      ] : field.fields
    }))
    updateHtmlWithFieldData('static')
    saveRawValue('fields', fields)
  }

  function deleteSubfield(fieldId:string, subfieldId:string): void {
    fields = fields.map(field => field.id !== fieldId ? field : {
      ...field,
      fields: field.fields.filter(subfield => subfield.id !== subfieldId)
    })
    updateHtmlWithFieldData('static')
    saveRawValue('fields', fields)
  }

  function removeRepeaterItem(fieldId:string, itemId:string): void {
    fields = fields.map(field => field.id !== fieldId ? field : ({
      ...field,
      value: Array.isArray(field.value) ? field.value.filter(item => item.id !== itemId) : field.value
    }))
    refreshFields()
    updateHtmlWithFieldData('static')
    saveRawValue('fields', fields)
  }

  function moveRepeaterItem(field, item, direction): void {
    const indexOfItem:number = _.findIndex(field.value, ['id', item.id])
    const withoutItem:Fields = field.value.filter(i => i.id !== item.id)
    if (direction === 'up') {
      field.value = [...withoutItem.slice(0,indexOfItem-1), item, ...withoutItem.slice(indexOfItem-1)];
    } else {
      field.value = [...withoutItem.slice(0, indexOfItem+1), item, ...withoutItem.slice(indexOfItem+1)];
    }
    refreshFields()
    saveRawValue('fields', fields)
  }

  function addRepeaterItem(repeaterField:Field): void {
    const keys = repeaterField.fields.map(f => f.key)
    repeaterField.value = [
      ...repeaterField.value,
      keys.reduce((a,b) => (a[b]='',a), { id: getUniqueId() }) // turn keys into value object
    ]
    refreshFields()
    updateHtmlWithFieldData('static')
    saveRawValue('fields', fields)
  }


  function deleteField(id:string): void {
    fields = fields.filter(field => field.id !== id)
    updateHtmlWithFieldData('static')
    saveRawValue('fields', fields)
  }

  function refreshFields(): void {
    fields = fields.filter(f => true)
    saveRawValue('fields', fields)
  }

  function setPlaceholderValues() {
    fields = fields.map(f => !f.value ? ({
      ...f,
      value: getFakeValue(f.type)
    }) : f)
    updateHtmlWithFieldData('static')
  }

  function getFakeValue(type) {
      if (!faker) return ''
      return {
        'text' : faker.lorem.sentence(),
        'content': faker.lorem.paragraph(),
        'image' : faker.image.unsplash.image(),
      }[type] || ''
    }

  // TODO: attach component to field type
  const fieldTypes:Array<FieldType> = [
    {
      id: 'text',
      label: 'Text',
      component: ContentField
    },
    {
      id: 'content',
      label: 'Text Area',
      component: TextAreaField
    },
    {
      id: 'number',
      label: 'Number',
      component: ContentField
    },
    {
      id: 'url',
      label: 'URL',
      component: ContentField
    },
    {
      id: 'image',
      label: 'Image',
      component: ImageField
    },
    {
      id: 'checkbox',
      label: 'True / False',
      component: ContentField
    },
    {
      id: 'repeater',
      label: 'Repeater',
      component: RepeaterField
    },
    {
      id: 'group',
      label: 'Group',
      component: GroupField
    },
    {
      id: 'js',
      label: 'JavaScript',
      component: ContentField
    },
    {
      id: 'message',
      label: 'Message',
      component: MessageField
    }
  ]

  const subFieldTypes:Array<FieldType> = fieldTypes.filter(field => !['repeater','group','api','js'].includes(field.id))

  const tabs = [
    {
      label: 'Code',
      icon: 'code'
    },
    {
      label: 'Fields',
      icon: 'database'
    },
  ] 

  let activeTab = tabs[0]

  let disabled:boolean = !!localComponent.symbolID

  let faker
  onMount(async() => {
    faker = await import('faker')
  })

</script>

<div class="flex flex-col h-full" in:fade={{ duration: 200 }}>
  <div class="flex flex-1 flex-wrap">
    <div class="w-full mb-4 lg:mb-0 lg:w-1/2">
      <div class="flex flex-col h-full">
        {#if $editorViewDev}
          <Tabs {tabs} bind:activeTab variants="my-2" />
          {#if disabled}
            <p class="mb-2 text-xs text-gray-700">This component is tied to a <button class="underline" on:click={loadSymbol} title="Edit the Symbol">Symbol</button>. You won't be able to edit it unless you <button class="underline" on:click={separateFromSymbol} title="Separate the component instance from its Symbol">emancipate it</button>.</p>
          {/if}
          {#if activeTab === tabs[0]}
            <FullCodeEditor 
              variants="flex-1" 
              height="30rem" 
              {disabled} 
              bind:html={rawHTML}
              bind:css={rawCSS}
              bind:js={rawJS}
              on:save={() => button.onclick(localComponent)}
            />
          {:else if activeTab === tabs[1]}
            <div class="flex flex-col">
              {#each fields as field}
                <Card>
                  <EditField on:delete={() => deleteField(field.id)} {disabled}>
                    <select bind:value={field.type} slot="type" on:change={setPlaceholderValues} {disabled}>
                      {#each fieldTypes as field}
                        <option value={field.id}>{ field.label }</option>
                      {/each}
                    </select>
                    <input class="input" type="text" placeholder="Heading" bind:value={field.label} slot="label" {disabled} on:focus={setPlaceholderValues}>
                    <input class="input" type="text" placeholder="main-heading" bind:value={field.key} slot="key" {disabled} on:input={() => updateHtmlWithFieldData('static')}>
                  </EditField>
                  {#if field.type === 'js'}
                    <CodeMirror 
                      {disabled}
                      mode="javascript" 
                      style="height:25vh" 
                      bind:value={field.code} 
                      on:change={() => updateHtmlWithFieldData('js')} 
                    />
                  {:else if field.type === 'group'}
                    {#if field.fields}
                      {#each field.fields as subfield}
                        <EditField variants="ml-4 text-sm" fieldTypes={subFieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
                          <select bind:value={subfield.type} slot="type" {disabled}>
                            {#each subFieldTypes as field}
                              <option value={field.id}>{ field.label }</option>
                            {/each}
                          </select>
                          <input type="text" placeholder="Heading" bind:value={subfield.label} slot="label" {disabled}>
                          <input type="text" placeholder="main-heading" bind:value={subfield.key} slot="key" {disabled}>
                        </EditField>
                      {/each}
                    {/if}
                    <button class="field-button subfield-button" on:click={() => addSubField(field.id)} {disabled}><i class="fas fa-plus mr-2"></i>Create Subfield</button>
                  {:else if field.type === 'repeater'}
                    {#if field.fields}
                      {#each field.fields as subfield}
                        <EditField variants="ml-4 text-sm" fieldTypes={subFieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
                          <select bind:value={subfield.type} slot="type" {disabled}>
                            {#each subFieldTypes as field}
                              <option value={field.id}>{ field.label }</option>
                            {/each}
                          </select>
                          <input type="text" placeholder="Heading" bind:value={subfield.label} slot="label" {disabled}>
                          <input type="text" placeholder="main-heading" bind:value={subfield.key} slot="key" {disabled}>
                        </EditField>
                      {/each}
                    {/if}
                    <button class="field-button subfield-button" on:click={() => addSubField(field.id)} {disabled}><i class="fas fa-plus mr-2"></i>Create Subfield</button>
                  {:else if field.type === 'message'}
                    <textarea {disabled} rows="3" bind:value={field.value} class="w-full border border-solid border-gray-200 rounded"></textarea>
                  {/if}
                </Card>
              {/each}
              <PrimaryButton on:click={addNewField} {disabled}><i class="fas fa-plus mr-2"></i>Create a Field</PrimaryButton>
            </div>
          {/if}
        {:else}
          <div class="pt-8">
            {#each fields as field}
              {#if field.label}
                <svelte:component this={_.find(fieldTypes, ['id', field.type]).component} {field} on:input={() => updateHtmlWithFieldData('static')} />
              {:else}
              <span>This field needs a label to be valid</span>
              {/if}
            {:else}
              <p class="text-center h-full flex items-start p-24 justify-center text-lg text-gray-700 mt-3 bg-gray-100">You'll need to create and integrate a field before you can edit this component's content</p>
            {/each}
          </div>
      {/if}
      </div>
    </div>
    <div class="w-full lg:w-1/2">
      <CodePreview 
        view="small"
        {loading}
        id={localComponent.id}
        html={finalHTML} 
        css={finalCSS} 
        js={finalJS}
        dependencies={$pageData.dependencies}
        includeParentStyles
      />
    </div>
  </div>
  <div class="flex justify-end py-2">
    <SaveButton {loading} on:click={() => button.onclick(localComponent)}>{button.label}</SaveButton>
  </div>
</div>

<style>
  .field-button {
    @apply w-full bg-gray-800 text-gray-300 py-2 rounded font-medium transition-colors duration-100;
    &:hover {
      @apply bg-gray-900;
    }
    &[disabled] {
      @apply bg-gray-500 cursor-not-allowed;
    }
  }
  .field-button.subfield-button {
    width: calc(100% - 1rem);
    @apply ml-4 text-sm py-1 mb-2 mt-2 bg-gray-100 text-gray-700 transition-colors duration-100 outline-none;
    &:hover {
      @apply bg-gray-200;
    }
  }


  input {
    &:focus {
      @apply outline-none;
    }
  }

  select {
    outline-offset: 3px;
    outline-color: rgb(248,68,73);
    padding: 0.5rem;
    border-right-width: 0.5rem;
    @apply p-2 border-transparent text-sm font-semibold;
  }

	@import "../../../node_modules/bulma/sass/utilities/_all.sass";
	@import "../../../node_modules/bulma/sass/form/_all.sass";

</style>
