<script lang="ts">  
  import _ from 'lodash'
  import pluralize from 'pluralize'
  import {createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  const dispatch = createEventDispatcher()
  import {PrimaryButton,SaveButton} from '../@components/buttons'
  import {ContentField, EditField, GenericField, ImageField} from '../@components/inputs'
  import {IconButton,Tabs} from '../@components/misc'
  import {CodeMirror} from '../@components'
  import {Card} from '../@components/misc'
  import RepeaterField from './ComponentEditor/RepeaterField.svelte'
  import {CodePreview} from '../@components/misc'
  import type {Subfield, Field, Fields, Component, Property, FieldType} from '../types/components'
  import {getUniqueId} from '../utils'

  import site from '../@stores/data/site'
  import pageData from '../@stores/data/pageData'
  import {editorViewDev,userRole} from '../@stores/app'
  import modal from '../@stores/app/modal'
  import content from '../@stores/data/page/content'

  let pageFields = _.cloneDeep($pageData.fields) || []
  let siteFields = _.cloneDeep($site.fields) || []

  let fields = pageFields 

  function saveFields(fields) {
    if (showingPage) {
      pageFields = fields
    } else {
      siteFields = fields
    }
  }

  function addField(): void {
    fields = [
      ...fields,
      {
        id: getUniqueId(),
        key: '',
        label: '',
        value: '',
        type: 'text',
        fields: []
      }
    ]
    saveFields(fields)
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
    saveFields(fields)
    updateHtmlWithFieldData('static')
  }

  function deleteSubfield(fieldId:string, subfieldId:string): void {
    fields = fields.map(field => field.id !== fieldId ? field : {
      ...field,
      fields: field.fields.filter(subfield => subfield.id !== subfieldId)
    })
    saveFields(fields)
    updateHtmlWithFieldData('static')
  }

  function deleteField(id:string): void {
    fields = fields.filter(field => field.id !== id)
    updateHtmlWithFieldData('static')
    saveFields(fields)
  }

  function addRepeaterItem(repeaterField:Field): void {
    const keys = repeaterField.fields.map(f => f.key)
    repeaterField.value = [
      ...repeaterField.value,
      keys.reduce((a,b) => (a[b]='',a), { id: getUniqueId() }) // turn keys into value object
    ]
    refreshFields()
    updateHtmlWithFieldData('static')
  }

  function removeRepeaterItem(fieldId:string, itemId:string): void {
    fields = fields.map(field => field.id !== fieldId ? field : ({
      ...field,
      value: Array.isArray(field.value) ? field.value.filter(item => item.id !== itemId) : field.value
    }))
    refreshFields()
    updateHtmlWithFieldData('static')
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
  }

  function refreshFields(): void {
    fields = fields.filter(f => true)
    saveFields(fields)
  }

  // TODO: attach component to field type
  const fieldTypes:Array<FieldType> = [
    {
      id: 'text',
      label: 'Text'
    },
    {
      id: 'content',
      label: 'Text Area'
    },
    {
      id: 'number',
      label: 'Number'
    },
    {
      id: 'url',
      label: 'URL'
    },
    {
      id: 'image',
      label: 'Image'
    },
    {
      id: 'checkbox',
      label: 'True / False'
    },
    {
      id: 'repeater',
      label: 'Repeater'
    },
    {
      id: 'group',
      label: 'Group'
    },
    {
      id: 'js',
      label: 'JavaScript'
    },
    {
      id: 'message',
      label: 'Message'
    }
  ]

  const subFieldTypes:Array<FieldType> = fieldTypes.filter(field => !['repeater','group','api','js'].includes(field.id))


  //// 
  let disabled = false
  function updateHtmlWithFieldData(type) {
    // TODO: update page preview
  }

  const tabs = [
    {
      label: 'Page',
      icon: 'square'
    },
    {
      label: 'Site',
      icon: 'th'
    }
  ]
  let activeTab = tabs[0]

  let showingPage = true
  $: showingPage = activeTab === tabs[0]

  $: if (showingPage) {
    fields = pageFields
  } else {
    fields = siteFields
  }

  function applyFields() {
    site.saveCurrentPage({ fields: pageFields })
    site.save({ fields: siteFields })
    pageData.hydrateWrapper()
    content.hydrateComponents()
    site.pages.hydrateComponents()
    modal.hide()
  }

</script>

<Tabs {tabs} bind:activeTab variants="mb-2" />

<div class="flex flex-col pt-2">
  {#if $editorViewDev}
    {#each fields as field}
    <Card>
      <EditField on:delete={() => deleteField(field.id)} {disabled}>
        <select bind:value={field.type} slot="type" on:change={refreshFields} {disabled}>
          {#each fieldTypes as field}
            <option value={field.id}>{ field.label }</option>
          {/each}
        </select>
        <input class="input" type="text" placeholder="Heading" bind:value={field.label} slot="label" {disabled}>
        <input class="input" type="text" placeholder="main-heading" bind:value={field.key} slot="key" {disabled}>
      </EditField>
      {#if field.type === 'api'}
        <div class="field is-horizontal" in:fade={{ duration: 100 }}>
          <div class="flex justify-between items-center">
            <GenericField 
              label="Endpoint" 
              bind:value={field.endpoint} 
              on:input={_.debounce( () => { updateHtmlWithFieldData('api') }, 1000 )}
              input={{
                type: 'api',
                placeholder: 'https://jsonplaceholder.typicode.com/todos/1'
              }} 
              {disabled}/>
            <GenericField 
              label="Path" 
              bind:value={field.endpointPath} 
              on:input={_.debounce( () => { updateHtmlWithFieldData('api') }, 1000 )}
              input={{
                type: 'text',
                placeholder: `2.prop.5['another-prop']`
              }} 
              {disabled}/>
              <IconButton title="Open browser console to monitor data" icon="sync-alt" variants="is-link is-outlined" on:click={() => updateHtmlWithFieldData('api')} {disabled} />
          </div>
        </div>
      {:else if field.type === 'js'}
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
            <EditField fieldTypes={subFieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
              <select bind:value={subfield.type} slot="type" {disabled}>
                {#each subFieldTypes as field}
                  <option value={field.id}>{ field.label }</option>
                {/each}
              </select>
              <input class="input" type="text" placeholder="Heading" bind:value={subfield.label} slot="label" {disabled}>
              <input class="input" type="text" placeholder="main-heading" bind:value={subfield.key} slot="key" {disabled}>
            </EditField>
          {/each}
        {/if}
        <button class="button is-fullwidth" on:click={() => addSubField(field.id)} {disabled}>Add Subfield</button>
      {:else if field.type === 'repeater'}
        {#if field.fields}
          {#each field.fields as subfield}
            <EditField fieldTypes={subFieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
              <select bind:value={subfield.type} slot="type" {disabled}>
                {#each subFieldTypes as field}
                  <option value={field.id}>{ field.label }</option>
                {/each}
              </select>
              <input class="input" type="text" placeholder="Heading" bind:value={subfield.label} slot="label" {disabled}>
              <input class="input" type="text" placeholder="main-heading" bind:value={subfield.key} slot="key" {disabled}>
            </EditField>
          {/each}
        {/if}
        <button class="button is-fullwidth" on:click={() => addSubField(field.id)} {disabled}>Add Subfield</button>
      {:else if field.type === 'message'}
        <textarea {disabled} rows="3" bind:value={field.value} class="w-full border border-solid border-gray-200 rounded"></textarea>
      {/if}
    </Card>
    {/each}
    <button class="field-button" on:click={addField} {disabled}><i class="fas fa-plus mr-2"></i>Add a Field</button>
  {:else}
    {#each fields as field}
      {#if field.type === 'api'}
          <ContentField {field} disabled={true} title="Value is set by API" />
        {:else if field.type === 'js'}
          <ContentField {field} disabled={true} title="Value is set by JavaScript" />
        {:else if field.type === 'group'}
          <Card title={field.label} variants="p-2">
            {#each field.fields as subfield}
              {#if subfield.type === 'image'}
                <Card title={subfield.label} image={subfield.value} variants="px-2 pb-2">
                  <ImageField 
                    field={subfield}  
                    on:input
                  />
                </Card>
              {:else if subfield.type === 'content'}
                <div class="field">
                  <label class="label" for={subfield.id}>
                    { subfield.label }
                    <textarea id={subfield.id} class="textarea is-medium" bind:value={subfield.value} on:input={() => updateHtmlWithFieldData('static')}></textarea>
                  </label>
                </div>
              {:else}
                <ContentField horizontal={true} field={subfield} on:input={() => updateHtmlWithFieldData('static')} />              
              {/if}
            {/each}
          </Card>
        {:else if field.type === 'repeater'}
          <Card title={field.label} variants="p-2 pb-4">
            {#each field.value as item (item.id)} 
              <RepeaterField 
                {field} 
                on:delete={() => removeRepeaterItem(field.id, item.id)}
                on:move={({detail:direction}) => moveRepeaterItem(field, item, direction)}
                let:subfield
              >
                <label slot="text">
                  <span class="text-xs font-bold">{subfield.label}</span>
                  <input class="bg-white border border-gray-300 rounded p-2 mb-2 block w-full appearance-none leading-normal" type={subfield.type} value={item[subfield.key]||''} on:input={({target}) => { item[subfield.key] = target.value; updateHtmlWithFieldData('static')}}>
                </label> 
                <label slot="checkbox">
                  <span class="text-xs font-bold">{subfield.label}</span>
                  <input type="checkbox" bind:checked={item[subfield.key]} on:input={() => updateHtmlWithFieldData('static')}>
                </label>
                <label slot="content">
                  <span class="text-xs font-bold">{subfield.label}</span>
                  <textarea class="textarea is-medium" bind:value={item[subfield.key]} on:input={() => updateHtmlWithFieldData('static')}></textarea>
                </label>
                <div slot="image">
                  <ImageField 
                    field={{
                      value: item[subfield.key]
                    }}  
                    on:input={({detail}) => {
                      item[subfield.key] = detail;
                      updateHtmlWithFieldData('static')
                    }} 
                  />
                </div>
              </RepeaterField>
            {/each}
          </Card>
          <button class="field-button" on:click={() => addRepeaterItem(field)}>Add {pluralize.singular(field.label)}</button>
        {:else if field.type === 'image'}
          <Card title={field.label} image={field.value} variants="p-2">
            <ImageField
              {field} 
              on:input={({detail}) => {
                updateHtmlWithFieldData('static')
              }} 
            />
          </Card>
        {:else if field.type === 'content'}
          <div class="field">
            <label class="label" for={field.id}>
              { field.label }
              <textarea id={field.id} class="textarea is-medium" bind:value={field.value} on:input={() => updateHtmlWithFieldData('static')}></textarea>
            </label>
          </div>
        {:else if field.type === 'message'}
          <Card>{@html field.value}</Card>
        {:else}
          <ContentField {field} on:input={() => updateHtmlWithFieldData('static')} />
        {/if}
      {:else}
      <p class="text-center h-full flex items-start p-24 justify-center text-lg text-gray-700 mt-3 bg-gray-100">
        {#if $userRole === 'developer'}
          You'll need to create and integrate a field before you can edit content from here
        {:else}
          The site developer will need to create and integrate a field before you can edit content from here
        {/if}
      </p>
    {/each}
  {/if}
</div>

<div class="flex flex-row justify-end mt-4">
  <SaveButton on:click={applyFields}>Save</SaveButton>
</div>

<style>
  .field-button {
    @apply w-full bg-gray-800 text-gray-300 py-2 rounded font-medium transition-colors duration-200;
    &:hover {
      @apply bg-gray-900;
    }
    &[disabled] {
      @apply bg-gray-500 cursor-not-allowed;
    }
  }
</style>