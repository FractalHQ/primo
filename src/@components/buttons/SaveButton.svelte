<script>
  import {Spinner} from '../misc'
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();

  export let variants = ''
  export let type = 'button'
  export let disabled = false
  export let loading = false
</script>

<button class="save-button {variants}" class:disabled={disabled || loading} disabled={disabled || loading} on:click={(e) => dispatch('click', e)} {type}>
  {#if loading}
    <Spinner />
  {:else}
    <slot></slot>
  {/if}
</button>

<style>
  .save-button {
    @apply bg-blue-600 text-white py-2 px-4 rounded transition-colors duration-200;
    &:hover {
      @apply bg-blue-700;
    }

    &.disabled {
      @apply bg-gray-600 text-gray-900;
    }
  }
</style>