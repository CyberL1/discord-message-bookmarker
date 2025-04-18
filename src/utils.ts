import {
  APIActionRowComponent,
  APIApplicationCommandInteraction,
  APIInteractionResponse,
  APIInteractionResponseCallbackData,
  APIMessageActionRowComponent,
  APIMessageComponent,
  APIMessageComponentInteraction,
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageType,
} from "discord_api_types/v10.ts";
import { BookmarkMessageData, BookmarkSaveData } from "./types.ts";

interface Bookmark {
  message: BookmarkMessageData;
  save_data: BookmarkSaveData;
}

export const getBookmarks = async () => {
  const kv = await Deno.openKv();

  const bookmarks = kv.list({ prefix: ["bookmarks"] });
  const bookmarksArray: Bookmark[] = [];

  for await (const bookmark of bookmarks) {
    bookmarksArray.push(bookmark.value as Bookmark);
  }

  kv.close();
  return bookmarksArray;
};

export const setBookmark = async ({ message, save_data }: Bookmark) => {
  const kv = await Deno.openKv();

  await kv.set(["bookmarks", save_data.message_id], { message, save_data });
  kv.close();

  return true;
};

export const generateBookmarkMessage = async (
  interactionData:
    | APIApplicationCommandInteraction
    | APIMessageComponentInteraction,
) => {
  const bookmarks = (await getBookmarks()).sort((a, b) => {
    const dateA = new Date(a.save_data.saved_at);
    const dateB = new Date(b.save_data.saved_at);
    return dateB.getTime() - dateA.getTime();
  });

  let index = 0;
  if (interactionData.type === InteractionType.MessageComponent) {
    index = parseInt(interactionData.data.custom_id.split("-")[1]);
  }

  const actionRows: APIActionRowComponent<APIMessageActionRowComponent>[] = [];
  const { save_data, message } = bookmarks[index] as Bookmark;

  if (message.components && message.components?.length > 0) {
    const messageComponents: APIMessageComponent = {
      type: 1,
      components: [],
    };

    message.components.map((actionRow) =>
      actionRow.components.map((component) => {
        component.disabled = true;
        messageComponents.components.push(component);
      })
    );

    actionRows.push(messageComponents);
  }

  const pageButtons: APIMessageActionRowComponent[] = [
    {
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: "Previous",
      custom_id: `bookmark-${index - 1}`,
      disabled: index === 0,
    },
    {
      type: ComponentType.Button,
      style: ButtonStyle.Link,
      label: "Jump to message",
      url:
        `https://discord.com/channels/${save_data.guild_id}/${save_data.channel_id}/${save_data.message_id}`,
    },
    {
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: "Next",
      custom_id: `bookmark-${index + 1}`,
      disabled: index === bookmarks.length - 1,
    },
  ];

  actionRows.push({ type: ComponentType.ActionRow, components: pageButtons });

  if (
    ![
      MessageType.Default,
      MessageType.ChatInputCommand,
      MessageType.ContextMenuCommand,
      MessageType.Reply,
    ].includes(message.type)
  ) {
    message.content =
      `Message is not sendable (type ${message.type}), click the jump button to view`;
  }

  if (message.poll) {
    message.content += "Message is a poll, click the jump button to view";
  }

  const data: APIInteractionResponseCallbackData = {
    content: message.content,
    embeds: message.embeds,
    tts: message.tts,
    components: actionRows,
    flags: 64,
  };

  return {
    type: InteractionResponseType[
      interactionData.type === InteractionType.MessageComponent
        ? "UpdateMessage"
        : "ChannelMessageWithSource"
    ],
    data,
  } as APIInteractionResponse;
};
