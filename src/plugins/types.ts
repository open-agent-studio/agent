/**
 * Plugin System — Types
 *
 * A plugin is a distributable package that bundles extensions:
 * skills, commands, hooks, tools, and rules into a single
 * installable unit via `plugin.json`.
 */

/**
 * Plugin manifest (plugin.json)
 */
export interface PluginManifest {
    /** Unique plugin name */
    name: string;
    /** Semver version */
    version: string;
    /** Human-readable description */
    description: string;
    /** Author name or org */
    author?: string;
    /** Homepage URL */
    homepage?: string;
    /** License identifier */
    license?: string;

    /** Relative paths to skill directories */
    skills?: string[];
    /** Relative paths to command directories */
    commands?: string[];
    /** Relative path to hooks.json */
    hooks?: string;
    /** Relative paths to tool modules */
    tools?: string[];
    /** Relative paths to script directories */
    scripts?: string[];
}

/**
 * Loaded plugin with resolved paths
 */
export interface LoadedPlugin {
    manifest: PluginManifest;
    /** Absolute path to the plugin directory */
    path: string;
    /** Number of skills loaded from this plugin */
    skillsCount: number;
    /** Number of commands loaded from this plugin */
    commandsCount: number;
    /** Number of hooks loaded from this plugin */
    hooksCount: number;
    /** Number of scripts loaded from this plugin */
    scriptsCount: number;
}
