/**
 * Single source of truth for the plugin identity.
 *
 * The same id appears in the plugin manifest, the marketplace entry, the
 * stored-options key prefix, the default data-directory segment, and stderr
 * diagnostics. Keep this constant and the manifest names in sync when
 * renaming; the source code must never hardcode the id as a literal.
 */
export const PLUGIN_ID = "zcode-plugin-honcho";
