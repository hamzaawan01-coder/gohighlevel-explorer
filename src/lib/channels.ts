import type { LucideIcon } from "lucide-react";
import {
  StickyNote,
  Mail,
  MessageSquareText,
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  Music2,
} from "lucide-react";
import type { MessageChannel } from "@/lib/conversations";

export type ChannelMeta = {
  key: MessageChannel;
  label: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon/badge. */
  color: string;
  /** Background tint. */
  bg: string;
};

export const CHANNELS: ChannelMeta[] = [
  { key: "note", label: "Notes", icon: StickyNote, color: "text-slate-600", bg: "bg-slate-100" },
  { key: "email", label: "Email", icon: Mail, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "sms", label: "SMS", icon: MessageSquareText, color: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-600", bg: "bg-green-50" },
  { key: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-600", bg: "bg-pink-50" },
  { key: "messenger", label: "Messenger", icon: Facebook, color: "text-sky-600", bg: "bg-sky-50" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-700", bg: "bg-blue-50" },
  { key: "tiktok", label: "TikTok", icon: Music2, color: "text-neutral-900", bg: "bg-neutral-100" },
];

export const CHANNEL_BY_KEY: Record<MessageChannel, ChannelMeta> = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c]),
) as Record<MessageChannel, ChannelMeta>;
