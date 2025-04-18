import { APIApplicationCommandInteraction, APIMessage } from "discord_api_types/v10.ts";

export interface Command {
  name: string;
  handler: (interaction: APIApplicationCommandInteraction) => void;
}

export interface Bookmark {
  message: BookmarkMessageData;
  save_data: BookmarkSaveData;
}

export type BookmarkMessageData = APIMessage;

export interface BookmarkSaveData {
  channel_id: string;
  message_id: string;
  saved_at: string;
  author_summary: string;
  channel_summary: string;
  message_summary: string;
  guild_id: string;
  author_id: string;
  notes: string;
  due_at?: string;
}
