export interface IRawSiteConfig {
    plugins?: Array<PluginRef>;
}
export interface ISiteConfig extends IRawSiteConfig {
    plugins?: Array<IPluginRefObject>;
}
export interface IPluginInfo {
    /** Unique ID describing a plugin */
    id: string;
    /** The absolute path to the plugin */
    resolve: string;
    /** The plugin name */
    name: string;
    /** The plugin version (can be content hash) */
    version: string;
    /** Options passed to the plugin */
    pluginOptions?: IPluginInfoOptions;
}
export interface IPluginInfoOptions {
    plugins?: Array<IPluginInfo>;
    path?: string;
    [option: string]: unknown;
}
export interface IFlattenedPlugin extends IPluginInfo {
    skipSSR?: boolean;
    ssrAPIs: Array<string>;
    nodeAPIs: Array<string>;
    browserAPIs: Array<string>;
}
export interface IPluginRefObject {
    resolve: string;
    options?: IPluginRefOptions;
    parentDir?: string;
}
export declare type PluginRef = string | IPluginRefObject;
export interface IPluginRefOptions {
    plugins?: Array<PluginRef>;
    path?: string;
    [option: string]: unknown;
}
