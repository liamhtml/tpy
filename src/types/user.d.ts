import { StringifiedNumber, Unpacked } from './util.d.ts';
import Guild from './guild.d.ts';

/**
 * Typings relevant to user interfaces on the Pylon API.
 *
 * @module
 */

/**
 * Request and response structures related to the `/user` resource.
 */
declare namespace User {
  /**
   * Schemas for `GET /user`.
   */
  export namespace GET {
    /**
     * Response schema for `GET /user`.
     *
     * Returns information based on the currently authenticated user.
     */
    export type User = {
      /**
       * The user's Discord ID.
       */
      id: StringifiedNumber;
      /**
       * The user's join date of the Pylon Discord Server.
       *
       * Follows the ISO 8601 / RFC 3339 specification.
       */
      lastSeenAt: string;
      /**
       * The user's avatar ID. Null if none set.
       *
       * `https://cdn.discordapp.com/avatars/{userId}/{avatar}.webp`
       */
      avatar: string | null;
      /**
       * The user's name.
       */
      displayName: string;
      /**
       * If user can use Pylon; if user is in the Pylon discord.
       */
      hasAccess: boolean;
    };

    /**
     * Response schema for `GET /user/guilds`.
     *
     * User's guild related resources.
     */
    export namespace Guilds {
      /**
       * Response schema for `GET /user/guilds`.
       *
       * Returns all guilds where the user can edit with Pylon.
       * More specifically, all guilds which the user has `manage
       * server` or `administrator` permissions in. The site says this
       * directly when {@link https://pylon.bot/studio/add-guild adding a guild}
       * and scrolling all the way down:
       *
       * > Don’t see the guild you’re looking for? Ensure you have the “Administrator” or “Manage Server” permission!
       */
      export type Allowed = Array<
        Unpacked<Available> & {
          /**
           * The user's nickname in the guild.
           */
          nick: string | null;
        }
      >;

      /**
       * Response schema for `GET /user/guilds/available`.
       *
       * Returns all guilds the user is in.
       */
      export type Available = Array<
        Guild.Structures.Payload & {
          /**
           * The {@link https://discord.com/developers/docs/topics/permissions Discord permissions number} of the user.
           */
          permissions: number;
        }
      >;
    }
  }
}

export default User;
