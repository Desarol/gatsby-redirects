import { IFlattenedPlugin, IRawSiteConfig } from "./types";
export declare function loadPlugins(rawConfig?: IRawSiteConfig, rootDir?: string | null): Promise<Array<IFlattenedPlugin>>;
