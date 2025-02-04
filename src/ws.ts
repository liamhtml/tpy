import Tpy from './tpy.ts';
import type { StringifiedNumber, Unpacked } from './types/util.d.ts';
import type Pylon from './types/pylon.d.ts';
import { EventEmitter } from 'events';
import TpyError, { parametersPrompt } from './error.ts';

/**
 * Pylon uses {@link WebSocket}s to listen to a deployment's console out/err.
 * While this idea is simple enough, the host closes the socket on an interval
 * ({@link https://discord.com/channels/530557949098065930/696860766665703515/983184117040562246 by design}),
 * having to make the user reconnect to the socket to continue listening.
 *
 * {@link TpyWs} is a {@link WebSocket} wrapper that expects this kind of nature
 * to aid and provide easier use.
 *
 * @module
 */

/**
 * {@link TpyWs} is a {@link WebSocket} abstraction specifically made for the
 * Pylon's socket nature. It provides the following qualities:
 *
 * - Automatic reconnection with customizable timeouts.
 * - Response formatting.
 * - Keep-alive stream. (Does not exit process on close/error unless
 * {@linkcode TpyWs.close} is used.)
 * - Raw access to WebSocket object.
 */
export default class TpyWs {
  private tpyc: Tpy;
  private deploymentID: StringifiedNumber;
  private tryToConnect = true;
  private reconnectionTimout: number;

  /**
   * {@linkcode TpyWs} uses a proxy stream that ensures the process (or at least the stream) is not terminated. This is that proxy stream.
   */
  eventEmitter = new EventEmitter();
  /**
   * The raw {@linkcode WebSocket} object, advised not to edit.
   */
  websocket?: WebSocket;

  /**
   * @param tpyInstance An instantiation of a {@linkcode Tpy} class.
   * @param deploymentID The deployment ID to look up for reconnection links.
   * @param reconnectionTimeout The reconnection timeout in milliseconds.
   */
  constructor(
    tpyInstance: Tpy,
    deploymentID: StringifiedNumber,
    reconnectionTimeout = 250,
  ) {
    if (!tpyInstance || !(tpyInstance instanceof Tpy)) {
      throw new TpyError(
        'Missing or Invalid Required Parameter',
        parametersPrompt(
          !tpyInstance ? 'missing' : 'incompatible',
          'tpyInstance',
        ),
        'tpyInstance',
        tpyInstance,
      );
    }
    if (!deploymentID) {
      throw new TpyError(
        'Missing or Invalid Required Parameter',
        parametersPrompt('missing', 'deploymentID'),
        'deploymentID',
        deploymentID,
      );
    }
    this.tpyc = tpyInstance;
    this.deploymentID = deploymentID;
    this.reconnectionTimout = reconnectionTimeout;
  }

  /**
   * Adds an event listener to WebSocket events.
   * @param type Fired when the WebSocket is (re)opened.
   * @param callback A callback function to invoke when this event is fired.
   *
   * @event
   */
  on(type: 'open', callback: (data: Event) => void): EventEmitter;
  /**
   * Adds an event listener to WebSocket events.
   * @param type Fired when the WebSocket is closed.
   * @param callback A callback function to invoke when this event is fired.
   *
   * @event
   */
  on(type: 'close', callback: (data: CloseEvent) => void): EventEmitter;
  /**
   * Adds an event listener to WebSocket events.
   * @param type Fired when the WebSocket captures an error.
   * @param callback A callback function to invoke when this event is fired.
   *
   * # Notice!
   * This event is fired every time the WebSocket is closed. This is
   * an action of the Pylon backend marking closed connections as errors.
   *
   * @event
   */
  on(type: 'error', callback: (data: ErrorEvent | Event) => void): EventEmitter;
  /**
   * Adds an event listener to WebSocket events.
   * @param type Fired when the WebSocket recieves a message.
   * @param callback A callback function to invoke when this event is fired.
   *
   * @template T The type of the `data` object inside {@linkcode Pylon.WebSocket.Response}.
   *
   * @event
   */
  on<T extends unknown[]>(
    type: 'message',
    callback: (data: Unpacked<Pylon.WebSocket.Response<T>>) => void,
  ): EventEmitter;
  on<T extends unknown[]>(
    type: unknown,
    callback: unknown,
  ) {
    if (typeof type != 'string') {
      throw new TpyError(
        'Missing or Invalid Required Parameter',
        parametersPrompt('incompatible', 'type'),
        'type',
        typeof type,
      );
    }
    if (typeof callback != 'function') {
      throw new TpyError(
        'Missing or Invalid Required Parameter',
        parametersPrompt('incompatible', 'callback'),
        'callback',
        typeof callback,
      );
    }
    return this.eventEmitter.on(
      type,
      <(data: Unpacked<Pylon.WebSocket.Response<T>>) => void> callback,
    );
  }

  /**
   * Retrieves the workbench URL and ties the WebSocket events to an event emitter.
   */
  async connect() {
    if (!this.tryToConnect) return;
    this.websocket = new WebSocket(
      (await this.tpyc.getDeployment(this.deploymentID)).workbench_url,
    );
    this.websocket.onopen = this.onOpen.bind(this);
    this.websocket.onclose = this.onClose.bind(this);
    this.websocket.onerror = this.onError.bind(this);
    this.websocket.onmessage = this.onMessage.bind(this);
  }

  private onOpen(event: Event) {
    this.eventEmitter.emit('open', event);
  }

  private onError(event: Event | ErrorEvent) {
    if (!this.websocket) return;
    this.eventEmitter.emit('error', event);

    try {
      this.websocket.close();
      // deno-lint-ignore no-empty
    } catch {}

    setTimeout(() => {
      this.connect();
    }, this.reconnectionTimout);
  }

  private onClose(event: CloseEvent) {
    this.eventEmitter.emit('close', event);
  }

  private onMessage(event: MessageEvent<string>) {
    this.eventEmitter.emit('message', (JSON.parse(event.data))[0]);
  }

  /**
   * Closes the WebSocket connection, reconnection will not be attempted.
   */
  close() {
    if (!this.websocket) return;
    this.websocket.close();
    this.tryToConnect = false;
  }
}
