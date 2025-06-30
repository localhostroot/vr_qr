import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	},

	onwarn: (warning, handler) => {

    console.log('CODE WARNING', warning.code);

    if (
        warning.code === 'css-unused-selector'
        || warning.code === 'unused-export-let'
        || warning.code === 'a11y_click_events_have_key_events'
        || warning.code === 'a11y_no_noninteractive_element_interactions'
        || warning.code === 'a11y_no_static_element_interactions'
        || warning.code === 'a11y-click-events-have-key-events'
      ) {
        
      return;
    }

    handler(warning);
  }
};

export default config;
