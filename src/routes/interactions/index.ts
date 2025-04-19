import { FastifyReply, FastifyRequest } from "fastify";
import tweetnacl from "tweetnacl";
import { Buffer } from "node:buffer";
import {
  APIInteraction,
  APIInteractionResponse,
  APIMessage,
  ApplicationCommandType,
  InteractionResponseType,
  InteractionType,
} from "discord_api_types/v10.ts";
import {
  generateBookmarkMessage,
  getBookmark,
  setBookmark,
} from "../../utils.ts";

const verifySignature = (
  body: APIInteraction,
  signature: string,
  timestamp: string,
) => {
  if (!signature || !timestamp) {
    return false;
  }

  return tweetnacl.sign.detached.verify(
    new Uint8Array(Buffer.from(timestamp + JSON.stringify(body))),
    new Uint8Array(Buffer.from(signature, "hex")),
    new Uint8Array(
      Buffer.from(Deno.env.get("PUBLIC_KEY") as string, "hex"),
    ),
  );
};

export default {
  post: async (
    req: FastifyRequest<
      {
        Body: APIInteraction;
        Headers: {
          "x-signature-ed25519": string;
          "x-signature-timestamp": string;
        };
      }
    >,
    reply: FastifyReply,
  ) => {
    if (
      !verifySignature(
        req.body,
        req.headers["x-signature-ed25519"],
        req.headers["x-signature-timestamp"],
      )
    ) {
      return reply.code(401).send();
    }

    const interactionData: APIInteraction = req.body;

    if (interactionData.type === InteractionType.Ping) {
      return { type: InteractionResponseType.Pong };
    } else if (
      interactionData.type === InteractionType.ApplicationCommand &&
      interactionData.data.name === "Bookmark"
    ) {
      if (interactionData.data.type === ApplicationCommandType.Message) {
        const targetMessage = Object.values(
          interactionData.data.resolved.messages,
        )[0] as APIMessage;

        if (!targetMessage) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: "Target message not found",
              flags: 64,
            },
          } as APIInteractionResponse;
        }

        const existingBookmark = await getBookmark(targetMessage.id);

        const bookmarked = await setBookmark({
          message: targetMessage,
          save_data: {
            channel_id: targetMessage.channel_id,
            message_id: targetMessage.id,
            saved_at: existingBookmark?.save_data.saved_at ||
              new Date().toISOString(),
            author_summary: "Author summary",
            channel_summary: "Chhannel summary",
            message_summary: "Message summary",
            author_id: targetMessage.author.id,
            guild_id: interactionData.guild?.id || "@me",
            notes: "Notes",
          },
        });

        if (!bookmarked) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: { content: "Error while bookmarking message", flags: 64 },
          } as APIInteractionResponse;
        }
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Message bookmarked",
          flags: 64,
        },
      } as APIInteractionResponse;
    }

    if (
      interactionData.type === InteractionType.ApplicationCommand ||
      interactionData.type === InteractionType.MessageComponent
    ) {
      return await generateBookmarkMessage(
        interactionData,
      );
    }
  },
};
