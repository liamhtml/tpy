import Tpy from './tpy.ts';
import type { StringifiedNumber } from './types/util.d.ts';
import type Pylon from './types/pylon.d.ts';
import TpyError, { parametersPrompt } from './error.ts';
import Context from './context.ts';

/**
 * Pylon uses an internal Key-Value persistence that can
 * be used via the {@link https://pylon.bot/docs/reference/classes/pylon.kvnamespace.html Pylon KVNamespace SDK}.
 *
 * @module
 */

/**
 * A KVNamespace interface that (almost) matches the Pylon KVNamespace SDK class.
 */
export default class TpyKV {
  /**
   * The KV namespace title.
   */
  readonly kvnamespace: string;
  private tpyc: Tpy;
  private deploymentID: StringifiedNumber;

  /**
   * @param tpyInstance An instantiation of a {@link Tpy} class.
   * @param deploymentID The deployment ID to find the KV namespace on.
   * @param kvnamespace The KV namespace title.
   */
  constructor(
    tpyInstance: Tpy,
    deploymentID: StringifiedNumber,
    kvnamespace: string,
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
    this.kvnamespace = kvnamespace;
  }

  /**
   * Sets the value of a given key within the key-value store.
   * @param key The key to set.
   * @param value The value to set - must be JSON serializeable.
   * @param options
   */
  async put(
    key: string,
    value: Pylon.Json,
    options?: Pylon.KV.OperationOptions.Put,
  ) {
    if (options?.ifNotExists && await this.get(key)) return;

    const { deploymentID, kvnamespace } = this;
    await this.tpyc.httpRaw(
      new Context({ deploymentID }),
      `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}/items/${key}`,
      'PUT',
      { body: JSON.stringify({ 'string': value }) },
    );
  }

  /**
   * Sets the value of a given key within the key-value store.
   * @param key The key to set.
   * @param value The value to set.
   * @param options
   */
  async putArrayBuffer(
    key: string,
    value: ArrayBuffer,
    options?: Pylon.KV.OperationOptions.Put,
  ) {
    if (options?.ifNotExists && await this.get(key)) return;

    const { deploymentID, kvnamespace } = this;
    await this.tpyc.httpRaw(
      new Context({ deploymentID, kvnamespace }),
      `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}/items/${key}`,
      'PUT',
      { body: JSON.stringify({ 'bytes': value }) },
    );
  }

  /**
   * Gets a key's value - returning the value or undefined.
   * @param key The Key to get.
   * @template T The return type of the function to a given Json type.
   */
  async get<T extends Pylon.Json = Pylon.Json>(
    key: string,
  ): Promise<T | undefined> {
    const { deploymentID, kvnamespace } = this;
    const response = await this.tpyc.httpRaw<Pylon.KV.GET.Items<T>>(
      new Context({ deploymentID, kvnamespace }),
      `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}/items`,
    );
    let item: T | undefined;
    for (let i = 0; i < response.length; i++) {
      const p = response[i];
      if (p.key !== key) continue;
      if (!p.value.string) {
        throw new TpyError(
          'Missing or Unexpected Value in Response',
          `response[${i}].value.string is undefined`,
          `response[${i}].value.string`,
          response,
        );
      }
      item = JSON.parse(p.value.string);
      break;
    }
    return item;
  }

  /**
   * Gets a key's value - returning the value or undefined.
   * @param key The Key to get.
   */
  async getArrayBuffer(key: string): Promise<ArrayBuffer | undefined> {
    const { deploymentID, kvnamespace } = this;
    const response = await this.tpyc.httpRaw<Pylon.KV.GET.Items>(
      new Context({ deploymentID, kvnamespace }),
      `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}/items`,
    );
    let item: ArrayBuffer | undefined;
    for (const p of response) {
      if (p.key !== key) continue;
      const arr = new TextEncoder().encode(p.value.bytes);
      item = arr.buffer.slice(arr.byteOffset, arr.byteLength + arr.byteOffset);
      break;
    }
    return item;
  }

  /**
   * Lists the keys that are set within the namespace.
   * @param options
   */
  async list(options?: Pylon.KV.OperationOptions.List) {
    const { deploymentID, kvnamespace } = this;
    const response = await this.tpyc.httpRaw<Pylon.KV.GET.Items>(
      new Context({ deploymentID, kvnamespace }),
      `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}/items`,
    );

    if (options?.limit) response.splice(0, options.limit);

    if (options?.from) {
      response.splice(
        response.findIndex((i) => i.key === options.from) + 1,
        response.length,
      );
    }

    return response.map((i) => i.key);
  }

  /**
   * Exactly like {@linkcode TpyKV.list}, except that it returns the key + value pairs instead.
   *
   * The maximum limit is 100, however.
   *
   * @template T The type of the value.
   */
  async items<T>(
    options?: Pylon.KV.OperationOptions.Items,
  ): Promise<Pylon.KV.GET.ItemsFlattened<T>> {
    const { deploymentID, kvnamespace } = this;
    let response = await this.tpyc.httpRaw<Pylon.KV.GET.Items>(
      new Context({ deploymentID, kvnamespace }),
      `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}/items`,
    );

    if (options?.from) {
      response = response.slice(
        response.findIndex((i) => i.key === options.from) + 1,
        response.length,
      );
    }

    if (options?.limit) {
      response = response.slice(0, options.limit);
    }

    return response.map((i) => {
      const j = i.value.string
        ? JSON.parse(i.value.string) as T
        : i.value.bytes;
      if (!j) {
        throw new TpyError(
          'Missing or Unexpected Value in Response',
          `response[${i}].value.string and/or response[${i}].value.bytes are undefined`,
          [
            `response[${i}].value.string`,
            `response[${i}].value.bytes`,
          ].join(', '),
          response,
        );
      }
      return {
        key: i.key,
        value: j as unknown as T,
        expiresAt: i.value.expiresAt,
      };
    });
  }

  /**
   * Returns the number of keys present in this namespace.
   */
  async count() {
    const { deploymentID, kvnamespace } = this;
    return (await this.tpyc.httpRaw<Pylon.KV.GET.Namespace>(
      new Context({ deploymentID, kvnamespace }),
      `/deployments/${deploymentID}/kv/namespaces`,
    )).find((n) => n.namespace == kvnamespace)?.count || 0;
  }

  /**
   * Clears the namespace. Returning the number of keys deleted.
   *
   * This operation will delete all the data in the namespace.
   * The data is irrecoverably deleted.
   *
   * **Use with caution!**
   */
  async clear() {
    const { deploymentID, kvnamespace } = this;
    return (await this.tpyc.httpRaw<Pylon.KV.DELETE.Namespace>(
      new Context({ deploymentID, kvnamespace }),
      `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}`,
      'DELETE',
    )).keys_deleted;
  }

  /**
   * Deletes a given key from the namespace. Throwing if the key does not exist,
   * or if {@linkcode Pylon.KV.OperationOptions.Delete options.prevValue} is set
   * the previous value is not equal to the value provided.
   * @param key The key to delete.
   * @param options Options, which can provide a delete if equals.
   */
  async delete(key: string, options?: Pylon.KV.OperationOptions.Delete) {
    const { deploymentID, kvnamespace } = this;
    const del = async () =>
      await this.tpyc.httpRaw(
        new Context({ deploymentID, kvnamespace }),
        `/deployments/${deploymentID}/kv/namespaces/${kvnamespace}/items/${key}`,
        'DELETE',
      );

    if (!options?.prevValue) await del();
    else {
      if (await this.get(key) == options.prevValue) await del();
    }
  }
}
