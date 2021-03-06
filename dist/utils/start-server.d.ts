/// <reference types="node" />
import webpack from "webpack";
import http from "http";
import https from "https";
import { WebsocketManager } from "../utils/websocket-manager";
import { CancelExperimentNoticeCallbackOrUndefined } from "../utils/show-experiment-notice";
import { Express } from "express";
import { IProgram } from "../commands/types";
import JestWorker from "jest-worker";
declare type ActivityTracker = any;
interface IServer {
    compiler: webpack.Compiler;
    listener: http.Server | https.Server;
    webpackActivity: ActivityTracker;
    cancelDevJSNotice: CancelExperimentNoticeCallbackOrUndefined;
    websocketManager: WebsocketManager;
    workerPool: JestWorker;
    webpackWatching: IWebpackWatchingPauseResume;
}
export interface IWebpackWatchingPauseResume extends webpack.Watching {
    suspend: () => void;
    resume: () => void;
}
export declare function startServer(program: IProgram, app: Express, workerPool?: JestWorker): Promise<IServer>;
export {};
