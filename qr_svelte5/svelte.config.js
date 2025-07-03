import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter()
  },
  
  // Suppress common warnings that are not critical for development
  onwarn: (warning, handler) => {
    // Suppress accessibility warnings that are common in interactive apps
    if (
      warning.code === 'a11y_click_events_have_key_events' ||
      warning.code === 'a11y_no_noninteractive_element_interactions' ||
      warning.code === 'a11y_no_static_element_interactions' ||
      warning.code === 'a11y-click-events-have-key-events' ||
      warning.code === 'a11y_missing_attribute' ||
      warning.code === 'a11y_role_has_required_aria_props' ||
      warning.code === 'a11y_no_redundant_roles' ||
      warning.code === 'a11y_label_has_associated_control' ||
      warning.code === 'a11y_autofocus' ||
      warning.code === 'a11y_media_has_caption' ||
      warning.code === 'a11y_distracting_elements' ||
      warning.code === 'a11y_structure' ||
      warning.code === 'a11y_mouse_events_have_key_events' ||
      warning.code === 'a11y_positive_tabindex' ||
      warning.code === 'a11y_invalid_attribute' ||
      warning.code === 'a11y_unknown_aria_attribute' ||
      warning.code === 'a11y_hidden' ||
      warning.code === 'a11y_misplaced_role' ||
      warning.code === 'a11y_unknown_role' ||
      warning.code === 'a11y_no_abstract_role' ||
      warning.code === 'a11y_no_redundant_roles' ||
      warning.code === 'a11y_accesskey' ||
      warning.code === 'a11y_incorrect_aria_attribute_type' ||
      // CSS related warnings
      warning.code === 'css-unused-selector' ||
      warning.code === 'css_unused_selector' ||
      // TypeScript/JavaScript warnings in .js files
      warning.code === 'typescript_error' ||
      warning.code === 'typescript-error' ||
      // Svelte 5 specific warnings
      warning.code === 'state_referenced_locally' ||
      warning.code === 'unused_export_let' ||
      warning.code === 'reactive_declaration_non_reactive_property' ||
      warning.code === 'reactive_declaration_module_script_dependency' ||
      // Store and reactivity warnings
      warning.code === 'non_reactive_update' ||
      warning.code === 'missing_declaration' ||
      // Component and prop warnings
      warning.code === 'unused-export-let' ||
      warning.code === 'missing-declaration' ||
      warning.code === 'redundant-event-modifier' ||
      // HTML and attribute warnings
      warning.code === 'unknown-attribute' ||
      warning.code === 'illegal-attribute-character' ||
      // Performance and optimization warnings
      warning.code === 'reactive-component-slot' ||
      warning.code === 'reactive_component_slot'
    ) {
      return;
    }

    // Log unhandled warnings for debugging (remove this in production)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Unhandled Svelte warning: ${warning.code}`, warning);
    }

    handler(warning);
  }
};

export default config;
