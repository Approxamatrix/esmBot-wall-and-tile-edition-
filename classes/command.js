import { Constants } from "oceanic.js";

class Command {
  /**
   * @param {import("oceanic.js").Client} client
   * @param {{ type: string; args: []; message: import("oceanic.js").Message; content: string; specialArgs: {}; interaction: import("oceanic.js").CommandInteraction }} options
   */
  constructor(client, options) {
    this.client = client;
    this.origOptions = options;
    this.type = options.type;
    this.args = options.args;
    this.success = true;
    this.edit = false;
    if (options.type === "classic") {
      this.message = options.message;
      this.channel = options.message.channel;
      this.guild = options.message.guild;
      this.author = options.message.author;
      this.member = options.message.member;
      this.permissions = this.channel?.permissionsOf?.(client.user.id) ?? Constants.AllTextPermissions;
      this.content = options.content;
      this.options = options.specialArgs;
      this.reference = {
        messageReference: {
          channelID: this.message.channelID,
          messageID: this.message.id,
          guildID: this.message.guildID ?? undefined,
          failIfNotExists: false
        },
        allowedMentions: {
          repliedUser: false
        }
      };
    } else {
      this.interaction = options.interaction;
      this.args = [];
      this.channel = options.interaction.channel ?? { id: options.interaction.channelID, guildID: options.interaction.guildID };
      this.guild = options.interaction.guild;
      this.author = this.member = options.interaction.guildID ? options.interaction.member : options.interaction.user;
      this.permissions = options.interaction.appPermissions;
      this.options = options.interaction.data.options.raw.reduce((obj, item) => {
        obj[item.name] = item.value;
        return obj;
      }, {});
    }
  }

  /**
   * The main command function.
   * @returns {Promise<string | import("oceanic.js").InteractionContent | import("oceanic.js").CreateMessageOptions | undefined>}
   */
  async run() {
    return "It works!";
  }

  /**
   * @param {number | undefined} [flags]
   */
  async acknowledge(flags) {
    if (this.type === "classic") {
      const channel = this.channel ?? await this.client.rest.channels.get(this.message.channelID);
      await channel.sendTyping();
    } else if (this.interaction && !this.interaction.acknowledged) {
      await this.interaction.defer(flags);
    }
  }

  static init() {
    return this;
  }

  static description = "No description found";
  static aliases = [];
  static args = [];
  static flags = [];
  static slashAllowed = true;
  static directAllowed = true;
  static adminOnly = false;
}

export default Command;
