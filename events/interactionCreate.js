import database from "../utils/database.js";
import logger from "../utils/logger.js";
import { collectors, commands, messageCommands, userCommands } from "../utils/collections.js";
import { clean } from "../utils/misc.js";
import { upload } from "../utils/tempimages.js";
import { InteractionTypes } from "oceanic.js";

/**
 * Runs when a slash command/interaction is executed.
 * @param {import("oceanic.js").Client} client
 * @param {import("oceanic.js").AnyInteractionGateway} interaction
 */
export default async (client, interaction) => {
  // block if client is not ready yet
  if (!client.ready) return;

  // handle incoming non-command interactions
  if (interaction.type === InteractionTypes.MESSAGE_COMPONENT) {
    //await interaction.deferUpdate();
    const collector = collectors.get(interaction.message.id);
    if (collector) collector.emit("interaction", interaction);
    return;
  }

  // block other non-command events
  if (interaction.type !== InteractionTypes.APPLICATION_COMMAND) return;

  // check if command exists and if it's enabled
  const command = interaction.data.name;
  const cmd = commands.get(command) ?? messageCommands.get(command) ?? userCommands.get(command);
  if (!cmd) return;

  try {
    await interaction.defer((cmd.ephemeral || interaction.data.options.getBoolean("ephemeral", false)) ? 64 : undefined);
  } catch (e) {
    logger.warn(`Could not defer interaction, cannot continue further: ${e}`);
    return;
  }

  if (cmd.dbRequired && !database) {
    await interaction.createFollowup({ content: "This command is unavailable on stateless instances of esmBot.", flags: 64 });
    return;
  }

  const invoker = interaction.member ?? interaction.user;

  // actually run the command
  logger.log("main", `${invoker.username} (${invoker.id}) ran application command ${command}`);
  try {
    const commandClass = new cmd(client, { type: "application", interaction });
    const result = await commandClass.run();
    const replyMethod = commandClass.edit ? "editOriginal" : "createFollowup";
    if (typeof result === "string") {
      await interaction[replyMethod]({
        content: result,
        flags: commandClass.success ? 0 : 64
      });
    } else if (typeof result === "object") {
      if (result.contents && result.name) {
        const fileSize = 26214400;
        if (result.contents.length > fileSize) {
          if (process.env.TEMPDIR && process.env.TEMPDIR !== "" && interaction.appPermissions.has("EMBED_LINKS")) {
            await upload(client, result, interaction, commandClass.success, true);
          } else {
            await interaction[replyMethod]({
              content: "The resulting image was more than 25MB in size, so I can't upload it.",
              flags: 64
            });
          }
        } else {
          await interaction[replyMethod]({
            flags: result.flags ?? (commandClass.success ? 0 : 64),
            files: [result]
          });
        }
      } else {
        await interaction[replyMethod](Object.assign({
          flags: result.flags ?? (commandClass.success ? 0 : 64)
        }, result));
      }
    } else {
      logger.debug(`Unknown return type for command ${command}: ${result} (${typeof result})`);
      if (!result) return;
      await interaction[replyMethod](Object.assign({
        flags: commandClass.success ? 0 : 64
      }, result));
    }
  } catch (error) {
    if (error.toString().includes("Request entity too large")) {
      await interaction.createFollowup({ content: "The resulting file was too large to upload. Try again with a smaller image if possible.", flags: 64 });
    } else if (error.toString().includes("Job ended prematurely")) {
      await interaction.createFollowup({ content: "Something happened to the image servers before I could receive the image. Try running your command again.", flags: 64 });
    } else {
      logger.error(`Error occurred with application command ${command} with arguments ${JSON.stringify(interaction.data.options.raw)}: ${error.stack || error}`);
      try {
        let err = error;
        if (error?.constructor?.name === "Promise") err = await error;
        await interaction.createFollowup({
          content: "Uh oh! I ran into an error while running this command. Please report the content of the attached file at the following link or on the esmBot Support server: <https://github.com/esmBot/esmBot/issues>",
          files: [{
            contents: Buffer.from(`Message: ${clean(err)}\n\nStack Trace: ${clean(err.stack)}`),
            name: "error.txt"
          }]
        });
      } catch (e) {
        logger.error(`While attempting to send the previous error message, another error occurred: ${e.stack || e}`);
      }
    }
  } finally {
    if (database) {
      await database.addCount(command);
    }
  }
};
