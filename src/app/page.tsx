"use client";

import { type ChangeEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GameLogo } from "@/components/game-logo";
import { requestNotificationPermission, showSystemNotification } from "@/lib/browser-notifications";
import { supabase } from "@/lib/supabase";

type Progress = {
  career: "Unemployed" | "Worker" | "Skilled Pro" | "Manager" | "Executive";
  reputation: number;
  spouse: string | null;
  children: number;
  house: "None" | "Starter Home" | "Family House" | "Luxury Estate";
  record: number;
  jailYears: number;
};

type PlayerRecord = {
  id: string;
  name: string | null;
  age: number | null;
  money: number | null;
  health: number | null;
  happiness: number | null;
  education: number | null;
  country: string | null;
  is_online?: boolean | null;
  updated_at?: string | null;
};

type PlayerPresence = {
  is_online: boolean;
  last_seen_at: string | null;
};

type DatingProfile = {
  user_id: string;
  display_name: string;
  age: number;
  city: string;
  country?: string | null;
  bio: string;
  interests: string[] | null;
  photo_url: string | null;
  gallery_urls: string[] | null;
  gender: string | null;
  preferred_gender: string | null;
  relationship_goal: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_verified: boolean;
  profile_verified: boolean;
  is_photo_verified: boolean;
  selfie_url: string | null;
  is_active: boolean;
  onboarding_complete: boolean;
  official_partner_id?: string | null;
  official_partner_name?: string | null;
  official_since?: string | null;
  partnership_visible?: boolean | null;
  intent_lounge?: string | null;
  wants_kids?: string | null;
  has_kids?: string | null;
  smokes?: string | null;
  drinks?: string | null;
  sober_dates?: boolean | null;
};

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type DatingBlockRow = {
  blocker_id: string;
  blocked_user_id: string;
};

type DatingReportRow = {
  reported_user_id: string;
  reason: string | null;
};

type AppTab = "swipe" | "explore" | "likes" | "chat" | "profile";
type CallKind = "voice" | "video";
type CallStatus = "idle" | "calling" | "ringing" | "incoming" | "connecting" | "connected";
type PartnerSafetySettings = {
  messageNotifications: boolean;
  quietMode: boolean;
  scamWarnings: boolean;
  chatSearch: boolean;
  hideDistance: boolean;
  hideOnlineStatus: boolean;
  sendReadReceipts: boolean;
};
type RecommendationMode = "balanced" | "recent";
type VisibilityMode = "standard" | "incognito";
type AppearanceMode = "system" | "light" | "dark";
type DistanceUnit = "km" | "mi";
type PremiumTier = "platinum" | "gold" | "plus";
type PartnerAppSettings = {
  premiumTier: PremiumTier;
  globalMode: boolean;
  maxDistanceKm: number;
  allowOutsideRange: boolean;
  interestedIn: "Women" | "Men" | "Everyone";
  ageMin: number;
  ageMax: number;
  minimumPhotos: number;
  requireBio: boolean;
  recommendationMode: RecommendationMode;
  visibilityMode: VisibilityMode;
  enableDiscovery: boolean;
  photoVerifiedChat: boolean;
  appearance: AppearanceMode;
  autoplayVideos: boolean;
  distanceUnit: DistanceUnit;
  phoneNumber: string;
  locationName: string;
  interestsSelection: string[];
  lookingFor: string;
  languages: string[];
  zodiac: string;
  educationLevel: string;
  familyPlans: string;
  communicationStyle: string;
  loveStyle: string;
  pets: string;
  drinkingPreference: string;
  smokingPreference: string;
  workoutHabit: string;
  socialMediaHandle: string;
  notificationsEnabled: boolean;
  emailUpdates: boolean;
  pushNotifications: boolean;
  smsUpdates: boolean;
  teamPartnerUpdates: boolean;
};
type PartnerUserControls = {
  muted?: boolean;
  blocked?: boolean;
  blockedBy?: boolean;
  reported?: boolean;
  reportNote?: string;
  favourite?: boolean;
  listed?: boolean;
  disappearingMessages?: boolean;
  chatClearedAt?: string;
  deletedChat?: boolean;
  closed?: boolean;
  unmatched?: boolean;
};
type CallState = {
  status: CallStatus;
  kind: CallKind;
  matchId: string;
  peerId: string;
  peerName: string;
  error?: string;
};

const baseProgress: Progress = {
  career: "Unemployed",
  reputation: 0,
  spouse: null,
  children: 0,
  house: "None",
  record: 0,
  jailYears: 0,
};
type OfficialRequestRow = {
  id: string;
  match_id: string;
  requester_id: string;
  partner_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
};
type VouchRow = {
  voucher_id: string;
  vouched_user_id: string;
};
type ExploreSection = {
  title: string;
  subtitle: string;
  countLabel: string;
  themeClass: string;
  featured?: boolean;
  profiles: DatingProfile[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const schemaHelp = "Dating tables are missing or outdated. Run the latest SQL in supabase/dating_schema.sql, then try again.";
const sortPair = (first: string, second: string) => (first < second ? [first, second] : [second, first]);
const summaryKey = (userId: string) => `dating-notification-summary:${userId}`;
const safetySettingsKey = (userId: string) => `dating-safety-settings:${userId}`;
const appSettingsKey = (userId: string) => `dating-app-settings:${userId}`;
const userControlsKey = (userId: string) => `dating-user-controls:${userId}`;
const defaultSafetySettings: PartnerSafetySettings = {
  messageNotifications: true,
  quietMode: false,
  scamWarnings: true,
  chatSearch: true,
  hideDistance: false,
  hideOnlineStatus: false,
  sendReadReceipts: true,
};
const defaultPartnerAppSettings: PartnerAppSettings = {
  premiumTier: "gold",
  globalMode: false,
  maxDistanceKm: 18,
  allowOutsideRange: true,
  interestedIn: "Women",
  ageMin: 18,
  ageMax: 24,
  minimumPhotos: 1,
  requireBio: false,
  recommendationMode: "balanced",
  visibilityMode: "standard",
  enableDiscovery: true,
  photoVerifiedChat: false,
  appearance: "system",
  autoplayVideos: true,
  distanceUnit: "km",
  phoneNumber: "27 68 207 4981",
  locationName: "Eersterivier, South Africa",
  interestsSelection: [],
  lookingFor: "",
  languages: [],
  zodiac: "",
  educationLevel: "",
  familyPlans: "",
  communicationStyle: "",
  loveStyle: "",
  pets: "",
  drinkingPreference: "",
  smokingPreference: "",
  workoutHabit: "",
  socialMediaHandle: "",
  notificationsEnabled: true,
  emailUpdates: true,
  pushNotifications: true,
  smsUpdates: false,
  teamPartnerUpdates: false,
};
const chatImagePrefix = "[chat-image]";
const chatAudioPrefix = "[chat-audio]";
const chatVideoPrefix = "[chat-video]";
const chatDocumentPrefix = "[chat-document]";
const chatContactPrefix = "[chat-contact]";
const chatPollPrefix = "[chat-poll]";
const chatEventPrefix = "[chat-event]";
const chatStickerPrefix = "[chat-sticker]";
const chatLocationPrefix = "[chat-location]";
const chatDatePlanPrefix = "[chat-date-plan]";
const chatReplyPrefix = "[chat-reply]";
const chatEmojis = ["ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨"];
const turnUrls = (process.env.NEXT_PUBLIC_TURN_URLS || process.env.NEXT_PUBLIC_TURN_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME || "";
const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "";
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
    ...(turnUrls.length && turnUsername && turnCredential ? [{ urls: turnUrls, username: turnUsername, credential: turnCredential }] : []),
  ],
  iceCandidatePoolSize: 8,
};
const intentLounges = ["Serious Relationship", "Casual Dating", "Friendship/Social", "Networking"];
const filterAny = "Any";
const kidsFilters = [filterAny, "Open", "Yes", "No", "Prefer not to say"];
const habitFilters = [filterAny, "No", "Sometimes", "Yes", "Prefer not to say"];
const settingsGenderTargets = {
  Women: ["woman", "women", "female"],
  Men: ["man", "men", "male"],
  Everyone: [],
} satisfies Record<PartnerAppSettings["interestedIn"], string[]>;
const activeChatLimit = 5;
const voiceAudioConstraints: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const isProfileVerified = (profile?: Pick<DatingProfile, "contact_verified" | "profile_verified" | "is_photo_verified" | "selfie_url">) =>
  Boolean(profile?.contact_verified || profile?.profile_verified || (profile?.is_photo_verified && profile.selfie_url));
const matchesPreferredGender = (profile: DatingProfile, preferredGender?: string | null) =>
  !preferredGender || preferredGender === "All" || profile.gender === preferredGender;
type ProfileCoordinates = { latitude: number; longitude: number };
const profileHasCoordinates = (profile?: Pick<DatingProfile, "latitude" | "longitude"> | null): profile is ProfileCoordinates =>
  typeof profile?.latitude === "number" && typeof profile.longitude === "number";
const distanceBetweenProfilesInKm = (
  first?: Pick<DatingProfile, "latitude" | "longitude"> | null,
  second?: Pick<DatingProfile, "latitude" | "longitude"> | null
) => {
  if (!profileHasCoordinates(first) || !profileHasCoordinates(second)) return null;

  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};
const formatDistanceLabel = (distanceKm: number | null) => {
  if (distanceKm === null) return null;
  if (distanceKm < 1) return "Less than 1 km away";
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km away`;
  return `${Math.round(distanceKm)} km away`;
};
const distanceLabelBetweenProfiles = (ownProfile?: DatingProfile | null, partnerProfile?: DatingProfile | null) =>
  formatDistanceLabel(distanceBetweenProfilesInKm(ownProfile, partnerProfile));
const isChatImageMessage = (body: string) => body.startsWith(chatImagePrefix);
const chatImageUrl = (body: string) => body.replace(chatImagePrefix, "");
const isChatAudioMessage = (body: string) => body.startsWith(chatAudioPrefix);
const chatAudioUrl = (body: string) => body.replace(chatAudioPrefix, "");
const isChatVideoMessage = (body: string) => body.startsWith(chatVideoPrefix);
const isChatDocumentMessage = (body: string) => body.startsWith(chatDocumentPrefix);
const isChatContactMessage = (body: string) => body.startsWith(chatContactPrefix);
const isChatPollMessage = (body: string) => body.startsWith(chatPollPrefix);
const isChatEventMessage = (body: string) => body.startsWith(chatEventPrefix);
const isChatStickerMessage = (body: string) => body.startsWith(chatStickerPrefix);
const isChatLocationMessage = (body: string) => body.startsWith(chatLocationPrefix);
const isChatDatePlanMessage = (body: string) => body.startsWith(chatDatePlanPrefix);
type ChatAttachmentPayload = { url: string; name: string; type?: string; size?: number };
const encodeChatPayload = (payload: unknown) => encodeURIComponent(JSON.stringify(payload));
const decodeChatPayload = <T,>(body: string, prefix: string, fallback: T): T => {
  try {
    return JSON.parse(decodeURIComponent(body.replace(prefix, ""))) as T;
  } catch {
    return fallback;
  }
};
const chatVideoPayload = (body: string) => decodeChatPayload<ChatAttachmentPayload>(body, chatVideoPrefix, { url: "", name: "Video" });
const chatDocumentPayload = (body: string) => decodeChatPayload<ChatAttachmentPayload>(body, chatDocumentPrefix, { url: "", name: "Document" });
const chatContactPayload = (body: string) => decodeChatPayload<{ name: string; detail: string }>(body, chatContactPrefix, { name: "Contact", detail: "" });
const chatPollPayload = (body: string) => decodeChatPayload<{ question: string; options: string[] }>(body, chatPollPrefix, { question: "Poll", options: [] });
const chatEventPayload = (body: string) => decodeChatPayload<{ title: string; detail: string }>(body, chatEventPrefix, { title: "Event", detail: "" });
const chatStickerValue = (body: string) => decodeURIComponent(body.replace(chatStickerPrefix, "")) || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â";
const chatLocationPayload = (body: string) => decodeChatPayload<{ latitude: number; longitude: number; label: string }>(body, chatLocationPrefix, { latitude: 0, longitude: 0, label: "Shared location" });
const chatDatePlanPayload = (body: string) => decodeChatPayload<{ title: string; when: string; place: string; note: string }>(body, chatDatePlanPrefix, { title: "Date plan", when: "Soon", place: "To be decided", note: "" });
type ChatReplyReference = { id: string; senderName: string; preview: string };
const decodeChatReply = (body: string): { reply: ChatReplyReference | null; text: string } => {
  if (!body.startsWith(chatReplyPrefix)) return { reply: null, text: body };
  const separatorIndex = body.indexOf("\n");
  if (separatorIndex === -1) return { reply: null, text: body };

  try {
    const reply = JSON.parse(decodeURIComponent(body.slice(chatReplyPrefix.length, separatorIndex))) as ChatReplyReference;
    return { reply, text: body.slice(separatorIndex + 1) };
  } catch {
    return { reply: null, text: body.slice(separatorIndex + 1) || body };
  }
};
const encodeChatReply = (reply: ChatReplyReference, text: string) =>
  `${chatReplyPrefix}${encodeURIComponent(JSON.stringify(reply))}\n${text}`;
const chatMessageText = (body: string) => decodeChatReply(body).text;
const chatNotificationBody = (body: string) => {
  const text = chatMessageText(body);
  if (isChatImageMessage(text)) return "Sent you a photo.";
  if (isChatAudioMessage(text)) return "Sent you a voice note.";
  if (isChatVideoMessage(text)) return "Sent you a video.";
  if (isChatDocumentMessage(text)) return "Sent you a document.";
  if (isChatContactMessage(text)) return "Sent you a contact.";
  if (isChatPollMessage(text)) return "Sent you a poll.";
  if (isChatEventMessage(text)) return "Sent you an event.";
  if (isChatStickerMessage(text)) return "Sent you a sticker.";
  if (isChatLocationMessage(text)) return "Sent you a location.";
  if (isChatDatePlanMessage(text)) return "Sent you a date plan.";
  return text || "Open the inbox to reply.";
};
const riskyMessagePatterns = [
  /send\s+(me\s+)?(the\s+)?code/i,
  /verification\s+code/i,
  /password/i,
  /bank\s*(card|account|details)?/i,
  /crypto|bitcoin|forex|investment/i,
  /gift\s*card/i,
  /wire\s+transfer|western\s+union|moneygram/i,
  /urgent(ly)?\s+send/i,
  /whatsapp\s+code/i,
];
const riskyMessageWarning = (body: string) => {
  if (isChatImageMessage(body) || isChatAudioMessage(body) || isChatVideoMessage(body) || isChatDocumentMessage(body)) return "";
  return riskyMessagePatterns.some((pattern) => pattern.test(body))
    ? "Be careful: never share passwords, OTP codes, banking details, or money with someone you just met."
    : "";
};
const fullProfileLocation = (profile?: DatingProfile | null) => {
  if (!profile) return "";
  const rawParts = [profile.country, profile.city, profile.location_label]
    .flatMap((value) => (value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const parts = rawParts.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return parts.join(" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ") || profile.location_label || profile.city || profile.country || "";
};
const formatLastSeen = (value?: string | null) => {
  const date = value ? new Date(value) : null;
  const safeDate = date && !Number.isNaN(date.getTime()) ? date : new Date();

  return `Last seen ${safeDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}, ${safeDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const presenceFromRow = (
  row: { is_online?: boolean | null; updated_at?: string | null },
  current?: PlayerPresence
): PlayerPresence => {
  const isOnline = Boolean(row.is_online);
  return {
    is_online: isOnline,
    last_seen_at: isOnline ? current?.last_seen_at || row.updated_at || null : row.updated_at || current?.last_seen_at || new Date().toISOString(),
  };
};

const officialPartnerLabel = (profile?: Pick<DatingProfile, "official_partner_name" | "partnership_visible"> | null) =>
  profile?.partnership_visible && profile.official_partner_name ? `Taken by ${profile.official_partner_name}` : "";

const formatChatDivider = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return safeDate.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatSentAt = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return safeDate.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const sortMessagesByCreatedAt = (rows: MessageRow[]) =>
  [...rows].sort((first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime());

const mergeMessagesPreservingReads = (current: MessageRow[], incoming: MessageRow[]) => {
  const nextMap = new Map(current.map((message) => [message.id, message]));

  incoming.forEach((message) => {
    const existing = nextMap.get(message.id);
    nextMap.set(message.id, {
      ...existing,
      ...message,
      read_at: message.read_at || existing?.read_at || null,
    });
  });

  return sortMessagesByCreatedAt(Array.from(nextMap.values()));
};

export default function PartnerScenePage() {
  const [player, setPlayer] = useState<PlayerRecord | null>(null);
  const [progress, setProgress] = useState<Progress>(baseProgress);
  const [profiles, setProfiles] = useState<DatingProfile[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, DatingProfile>>({});
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, PlayerPresence>>({});
  const [typingByMatch, setTypingByMatch] = useState<Record<string, boolean>>({});
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [likedMeIds, setLikedMeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Swipe, explore, match, and chat with real player profiles.");
  const [activeTab, setActiveTab] = useState<AppTab>("swipe");
  const [stackIndex, setStackIndex] = useState(0);
  const [activeMatchId, setActiveMatchId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [isLightMode, setIsLightMode] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [safetySettings, setSafetySettings] = useState<PartnerSafetySettings>(defaultSafetySettings);
  const [appSettings, setAppSettings] = useState<PartnerAppSettings>(defaultPartnerAppSettings);
  const [userControls, setUserControls] = useState<Record<string, PartnerUserControls>>({});
  const [activeLounge, setActiveLounge] = useState("Serious Relationship");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [kidsFilter, setKidsFilter] = useState(filterAny);
  const [smokesFilter, setSmokesFilter] = useState(filterAny);
  const [drinksFilter, setDrinksFilter] = useState(filterAny);
  const [soberDatesOnly, setSoberDatesOnly] = useState(false);
  const [officialRequests, setOfficialRequests] = useState<OfficialRequestRow[]>([]);
  const [vouchCounts, setVouchCounts] = useState<Record<string, number>>({});
  const [vouchedIds, setVouchedIds] = useState<string[]>([]);
  const [matchCelebrationProfile, setMatchCelebrationProfile] = useState<DatingProfile | null>(null);
  const [selectedExploreSectionTitle, setSelectedExploreSectionTitle] = useState<string | null>(null);
  const [selectedExploreProfile, setSelectedExploreProfile] = useState<DatingProfile | null>(null);
  const [callState, setCallState] = useState<CallState | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingHeartbeatRef = useRef<number | null>(null);
  const incomingTypingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef("");
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callChannelsRef = useRef<Record<string, ReturnType<typeof supabase.channel>>>({});
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const ringtoneContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<number | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const broadcastTypingState = (isTyping: boolean, force = false) => {
    if (!player || !activeMatchId || !typingChannelRef.current) return;

    const typingKey = `${activeMatchId}:${isTyping}`;
    if (!force && lastTypingSentRef.current === typingKey) return;

    lastTypingSentRef.current = typingKey;
    void typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { match_id: activeMatchId, sender_id: player.id, is_typing: isTyping },
    });
  };

  const updateSafetySettings = (changes: Partial<PartnerSafetySettings>) => {
    setSafetySettings((current) => {
      const next = { ...current, ...changes };
      if (player && typeof window !== "undefined") {
        window.localStorage.setItem(safetySettingsKey(player.id), JSON.stringify(next));
      }
      return next;
    });
  };
  const updateAppSettings = (changes: Partial<PartnerAppSettings>) => {
    setAppSettings((current) => {
      const next = { ...current, ...changes };
      if (player && typeof window !== "undefined") {
        window.localStorage.setItem(appSettingsKey(player.id), JSON.stringify(next));
      }
      return next;
    });
  };

  const updateUserControls = (userId: string, changes: PartnerUserControls) => {
    setUserControls((current) => {
      const next = {
        ...current,
        [userId]: { ...current[userId], ...changes },
      };

      if (player && typeof window !== "undefined") {
        window.localStorage.setItem(userControlsKey(player.id), JSON.stringify(next));
      }

      return next;
    });
  };

  const logout = async () => {
    setSaving(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setSaving(false);

    if (signOutError) {
      setStatus(`Could not log out: ${signOutError.message}`);
      return;
    }

    window.location.href = "/auth";
  };

  const saveBlockControl = async (userId: string, blocked: boolean) => {
    if (!player) return;

    updateUserControls(userId, { blocked });

    if (blocked) {
      const { error: blockError } = await supabase
        .from("dating_blocks")
        .upsert({ blocker_id: player.id, blocked_user_id: userId }, { onConflict: "blocker_id,blocked_user_id" });
      if (blockError) console.warn("Could not persist dating block", blockError);
      return;
    }

    const { error: unblockError } = await supabase
      .from("dating_blocks")
      .delete()
      .eq("blocker_id", player.id)
      .eq("blocked_user_id", userId);
    if (unblockError) console.warn("Could not persist dating unblock", unblockError);
  };

  const saveReportControl = async (userId: string, reason: string) => {
    if (!player) return;

    updateUserControls(userId, { reported: true, reportNote: reason });

    const { error: reportError } = await supabase
      .from("dating_reports")
      .upsert(
        {
          reporter_id: player.id,
          reported_user_id: userId,
          reason: reason || "No details provided.",
          status: "open",
        },
        { onConflict: "reporter_id,reported_user_id" }
      );
    if (reportError) console.warn("Could not persist dating report", reportError);
  };

  const loadScene = async (preserveMatchId?: string) => {
    try {
      setError("");
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth";
        return;
      }

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("id, name, age, money, health, happiness, education, country, is_online, updated_at")
        .eq("id", user.id)
        .single();

      if (playerError || !playerData) {
        setError(playerError?.message || "Could not open the partner finder.");
        setLoading(false);
        return;
      }

      void supabase
        .from("players")
        .update({ is_online: true, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      const stored = window.localStorage.getItem(`partner-progress:${user.id}`);
      let extra = baseProgress;
      if (stored) {
        try {
          extra = { ...baseProgress, ...JSON.parse(stored) } as Progress;
        } catch {
          window.localStorage.removeItem(`partner-progress:${user.id}`);
        }
      }

      const { data: ownProfile, error: ownProfileError } = await supabase
        .from("dating_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (ownProfileError) {
        setError(schemaHelp);
        setLoading(false);
        return;
      }

      if (!ownProfile || !ownProfile.onboarding_complete) {
        window.location.href = "/setup";
        return;
      }

      const { data: allProfiles, error: profilesError } = await supabase
        .from("dating_profiles")
        .select("*")
        .neq("user_id", user.id)
        .eq("onboarding_complete", true);

      if (profilesError) {
        setError(schemaHelp);
        setLoading(false);
        return;
      }

      const { data: likesMade, error: likesError } = await supabase.from("dating_likes").select("liked_user_id").eq("liker_id", user.id);
      const { data: likesReceived, error: likesReceivedError } = await supabase.from("dating_likes").select("liker_id").eq("liked_user_id", user.id);
      const { data: matchRows, error: matchError } = await supabase
        .from("dating_matches")
        .select("id, user_a, user_b, created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (likesError || likesReceivedError || matchError) {
        setError(schemaHelp);
        setLoading(false);
        return;
      }

      const { data: blockRows, error: blockError } = await supabase
        .from("dating_blocks")
        .select("blocker_id, blocked_user_id")
        .or(`blocker_id.eq.${user.id},blocked_user_id.eq.${user.id}`);
      const { data: reportRows, error: reportError } = await supabase
        .from("dating_reports")
        .select("reported_user_id, reason")
        .eq("reporter_id", user.id);

      if (blockError) console.warn("Could not load dating blocks", blockError);
      if (reportError) console.warn("Could not load dating reports", reportError);

      const typedMatches = (matchRows || []) as MatchRow[];
      const partnerIds = typedMatches.map((row) => (row.user_a === user.id ? row.user_b : row.user_a));
      const ownDatingProfile = ownProfile as DatingProfile;
      const visibleProfiles = ((allProfiles || []) as DatingProfile[]).filter(
        (profile) => (profile.is_active ?? true) && matchesPreferredGender(profile, ownDatingProfile.preferred_gender)
      );
      const mergedProfiles = [...visibleProfiles, ownDatingProfile];
      const missingIds = partnerIds.filter((id) => !mergedProfiles.some((profile) => profile.user_id === id));
      let matchedProfiles: DatingProfile[] = [];

      if (missingIds.length) {
        const { data: fetchedProfiles } = await supabase
          .from("dating_profiles")
          .select("*")
          .in("user_id", missingIds);
        matchedProfiles = (fetchedProfiles || []) as DatingProfile[];
      }

      const nextMap = [...mergedProfiles, ...matchedProfiles].reduce<Record<string, DatingProfile>>((accumulator, profile) => {
        accumulator[profile.user_id] = profile;
        return accumulator;
      }, {});
      const presenceIds = Array.from(new Set([...Object.keys(nextMap), user.id]));
      let nextPresenceMap: Record<string, PlayerPresence> = {};

      if (presenceIds.length) {
        const { data: presenceRows } = await supabase
          .from("players")
          .select("id, is_online, updated_at, country")
          .in("id", presenceIds);

        ((presenceRows || []) as Array<{ id: string; is_online: boolean | null; updated_at: string | null; country?: string | null }>).forEach((row) => {
          if (nextMap[row.id]) {
            nextMap[row.id] = { ...nextMap[row.id], country: row.country || nextMap[row.id].country || null };
          }
        });

        nextPresenceMap = ((presenceRows || []) as Array<{ id: string; is_online: boolean | null; updated_at: string | null }>).reduce<Record<string, PlayerPresence>>(
          (accumulator, row) => {
            accumulator[row.id] = presenceFromRow(row);
            return accumulator;
          },
          {}
        );
      }

      const matchIds = typedMatches.map((row) => row.id);
      let messageRows: MessageRow[] = [];
      let requestRows: OfficialRequestRow[] = [];
      if (matchIds.length) {
        const { data: fetchedMessages, error: messageError } = await supabase
          .from("dating_messages")
          .select("id, match_id, sender_id, body, created_at, read_at")
          .in("match_id", matchIds)
          .order("created_at", { ascending: true });
        if (messageError) {
          setError(schemaHelp);
          setLoading(false);
          return;
        }
        messageRows = (fetchedMessages || []) as MessageRow[];

        const { data: fetchedRequests } = await supabase
          .from("dating_official_requests")
          .select("id, match_id, requester_id, partner_id, status, created_at, responded_at")
          .in("match_id", matchIds);
        requestRows = (fetchedRequests || []) as OfficialRequestRow[];
      }

      const { data: fetchedVouches } = await supabase
        .from("dating_vouches")
        .select("voucher_id, vouched_user_id")
        .in("vouched_user_id", presenceIds);
      const typedVouches = (fetchedVouches || []) as VouchRow[];
      const nextVouchCounts = typedVouches.reduce<Record<string, number>>((accumulator, row) => {
        accumulator[row.vouched_user_id] = (accumulator[row.vouched_user_id] || 0) + 1;
        return accumulator;
      }, {});

      const nextLikedIds = (likesMade || []).map((row) => row.liked_user_id);
      const remoteBlockControls = ((blockRows || []) as DatingBlockRow[]).map((row) =>
        row.blocker_id === user.id
          ? ([row.blocked_user_id, { blocked: true }] as const)
          : ([row.blocker_id, { blockedBy: true }] as const)
      );
      const remoteControls = [
        ...remoteBlockControls,
        ...(((reportRows || []) as DatingReportRow[]).map((row) => [
          row.reported_user_id,
          { reported: true, reportNote: row.reason || "" },
        ] as const)),
      ].reduce<Record<string, PartnerUserControls>>((accumulator, [userId, controls]) => {
        accumulator[userId] = { ...accumulator[userId], ...controls };
        return accumulator;
      }, {});
      setPlayer(playerData as PlayerRecord);
      setProgress(extra);
      setActiveLounge(ownDatingProfile.intent_lounge || ownDatingProfile.relationship_goal || "Serious Relationship");
      setProfiles(visibleProfiles);
      setProfileMap(nextMap);
      setPresenceMap(nextPresenceMap);
      setMatches(typedMatches);
      setMessages(messageRows);
      setOfficialRequests(requestRows);
      setVouchCounts(nextVouchCounts);
      setVouchedIds(typedVouches.filter((row) => row.voucher_id === user.id).map((row) => row.vouched_user_id));
      setLikedIds(nextLikedIds);
      setLikedMeIds((likesReceived || []).map((row) => row.liker_id));
      if (Object.keys(remoteControls).length) {
        setUserControls((current) => {
          const next = { ...current, ...remoteControls };
          if (typeof window !== "undefined") {
            window.localStorage.setItem(userControlsKey(user.id), JSON.stringify(next));
          }
          return next;
        });
      }
      setActiveMatchId((current) => preserveMatchId || current);
      setLoading(false);
    } catch (loadError) {
      console.error("Partner scene load failed", loadError);
      setError("Could not open the partner finder right now.");
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadScene();
  }, []);

  useEffect(() => {
    if (!player || typeof window === "undefined") return;

    const stored = window.localStorage.getItem(safetySettingsKey(player.id));
    if (!stored) {
      setSafetySettings(defaultSafetySettings);
    } else {
      try {
        setSafetySettings({ ...defaultSafetySettings, ...JSON.parse(stored) });
      } catch {
        window.localStorage.removeItem(safetySettingsKey(player.id));
        setSafetySettings(defaultSafetySettings);
      }
    }

    const storedAppSettings = window.localStorage.getItem(appSettingsKey(player.id));
    if (!storedAppSettings) {
      setAppSettings(defaultPartnerAppSettings);
    } else {
      try {
        setAppSettings({ ...defaultPartnerAppSettings, ...JSON.parse(storedAppSettings) });
      } catch {
        window.localStorage.removeItem(appSettingsKey(player.id));
        setAppSettings(defaultPartnerAppSettings);
      }
    }

    const storedControls = window.localStorage.getItem(userControlsKey(player.id));
    if (!storedControls) {
      setUserControls({});
      return;
    }

    try {
      setUserControls(JSON.parse(storedControls) as Record<string, PartnerUserControls>);
    } catch {
      window.localStorage.removeItem(userControlsKey(player.id));
      setUserControls({});
    }
  }, [player]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (appSettings.appearance === "light") {
      setIsLightMode(true);
      return;
    }

    if (appSettings.appearance === "dark") {
      setIsLightMode(false);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const syncMode = () => setIsLightMode(mediaQuery.matches);
    syncMode();
    mediaQuery.addEventListener("change", syncMode);
    return () => mediaQuery.removeEventListener("change", syncMode);
  }, [appSettings.appearance]);

  useEffect(() => {
    if (!player) return;

    const markOnline = () => {
      setPresenceMap((current) => ({ ...current, [player.id]: { is_online: true, last_seen_at: current[player.id]?.last_seen_at || null } }));
      void supabase.from("players").update({ is_online: true, updated_at: new Date().toISOString() }).eq("id", player.id);
    };
    const markOffline = () => {
      setPresenceMap((current) => ({ ...current, [player.id]: { is_online: false, last_seen_at: new Date().toISOString() } }));
      void supabase.from("players").update({ is_online: false, updated_at: new Date().toISOString() }).eq("id", player.id);
    };
    const syncVisibility = () => {
      if (document.visibilityState === "visible") markOnline();
    };

    if (safetySettings.hideOnlineStatus) {
      markOffline();
      return;
    }

    markOnline();
    const heartbeat = window.setInterval(markOnline, 15000);
    window.addEventListener("focus", markOnline);
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", markOffline);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("focus", markOnline);
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pagehide", markOffline);
    };
  }, [player, safetySettings.hideOnlineStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "swipe" || tab === "explore" || tab === "likes" || tab === "chat" || tab === "profile") {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !player) return;

    if (Notification.permission === "default") {
      void requestNotificationPermission();
    }

    const interval = window.setInterval(() => {
      void loadScene(activeMatchId || undefined);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [activeMatchId, player]);

  useEffect(() => {
    if (!player) return;

    const matchIds = matches.map((match) => match.id);
    const presenceIds = Array.from(new Set([player.id, ...matches.map((match) => (match.user_a === player.id ? match.user_b : match.user_a))]));

    const notifyIncomingMessage = (row: MessageRow) => {
      if (row.sender_id === player.id || notifiedMessageIdsRef.current.has(row.id)) return;
      if (!safetySettings.messageNotifications || safetySettings.quietMode) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      if (document.visibilityState === "visible" && activeTab === "chat" && activeMatchId === row.match_id) return;

      const match = matches.find((entry) => entry.id === row.match_id);
      const senderProfile = match ? profileMap[match.user_a === player.id ? match.user_b : match.user_a] : null;
      if (senderProfile && (userControls[senderProfile.user_id]?.muted || userControls[senderProfile.user_id]?.blocked)) return;
      notifiedMessageIdsRef.current.add(row.id);

      void showSystemNotification({
        title: senderProfile ? `${senderProfile.display_name} sent a message` : "New message",
        body: chatNotificationBody(row.body),
        url: `/?tab=chat`,
        tag: `dating-message-${player.id}-${row.id}`,
      });
    };

    const mergeMessage = (row: MessageRow) => {
      setMessages((current) => mergeMessagesPreservingReads(current, [row]));
    };

    const refreshChatState = async () => {
      if (presenceIds.length) {
        const { data: presenceRows } = await supabase.from("players").select("id, is_online, updated_at").in("id", presenceIds);
        setPresenceMap((current) => ({
          ...current,
          ...((presenceRows || []) as Array<{ id: string; is_online: boolean | null; updated_at: string | null }>).reduce<Record<string, PlayerPresence>>(
            (accumulator, row) => {
              accumulator[row.id] = presenceFromRow(row, current[row.id]);
              return accumulator;
            },
            {}
          ),
        }));
      }

      if (matchIds.length) {
        const { data: fetchedMessages } = await supabase
          .from("dating_messages")
          .select("id, match_id, sender_id, body, created_at, read_at")
          .in("match_id", matchIds)
          .order("created_at", { ascending: true });

        if (fetchedMessages) setMessages((current) => mergeMessagesPreservingReads(current, fetchedMessages as MessageRow[]));
      }
    };

    const channel = supabase
      .channel(`dating-live-${player.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dating_messages" }, (payload) => {
        const row = payload.new as MessageRow | null;
        if (!row?.match_id || !matchIds.includes(row.match_id)) return;
        mergeMessage(row);
        if (payload.eventType === "INSERT") notifyIncomingMessage(row);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "players" }, (payload) => {
        const row = payload.new as { id?: string; is_online?: boolean | null; updated_at?: string | null };
        if (!row.id || !presenceIds.includes(row.id)) return;
        setPresenceMap((current) => ({
          ...current,
          [row.id as string]: presenceFromRow(row, current[row.id as string]),
        }));
      })
      .subscribe();

    const interval = window.setInterval(refreshChatState, activeTab === "chat" ? 5000 : 12000);
    void refreshChatState();

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [activeMatchId, activeTab, matches, player, profileMap, safetySettings.messageNotifications, safetySettings.quietMode, userControls]);

  useEffect(() => {
    if (!player) return;

    const presenceIds = Array.from(new Set([player.id, ...matches.map((match) => (match.user_a === player.id ? match.user_b : match.user_a))]));
    const channel = supabase.channel("dating-online-presence", { config: { presence: { key: player.id } } });
    const syncPresenceState = () => {
      const state = channel.presenceState() as Record<string, Array<{ user_id?: string; online_at?: string }>>;
      const onlineIds = new Set(
        Object.values(state)
          .flat()
          .map((entry) => entry.user_id)
          .filter(Boolean) as string[]
      );

      setPresenceMap((current) => {
        const next = { ...current };
        presenceIds.forEach((id) => {
          const isOnline = onlineIds.has(id);
          const wasOnline = Boolean(next[id]?.is_online);
          next[id] = {
            is_online: isOnline,
            last_seen_at: isOnline ? next[id]?.last_seen_at || null : wasOnline ? new Date().toISOString() : next[id]?.last_seen_at || null,
          };
        });
        return next;
      });
    };

    channel
      .on("presence", { event: "sync" }, syncPresenceState)
      .on("presence", { event: "join" }, syncPresenceState)
      .on("presence", { event: "leave" }, syncPresenceState)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ user_id: player.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [matches, player, safetySettings.hideOnlineStatus]);

  useEffect(() => {
    if (!player || activeTab !== "chat" || !activeMatchId || !safetySettings.sendReadReceipts) return;

    const unreadMessageIds = messages
      .filter((message) => message.match_id === activeMatchId && message.sender_id !== player.id && !message.read_at)
      .map((message) => message.id);

    if (!unreadMessageIds.length) return;

    const readAt = new Date().toISOString();
    setMessages((current) =>
      current.map((message) => (unreadMessageIds.includes(message.id) ? { ...message, read_at: readAt } : message))
    );

    void supabase
      .from("dating_messages")
      .update({ read_at: readAt })
      .eq("match_id", activeMatchId)
      .neq("sender_id", player.id)
      .is("read_at", null)
      .select("id, match_id, sender_id, body, created_at, read_at")
      .then(({ data, error: readError }) => {
        if (readError) {
          console.error("Could not mark active chat as read", readError);
          return;
        }

        if (data?.length) {
          setMessages((current) => mergeMessagesPreservingReads(current, data as MessageRow[]));
        }
      });
  }, [activeMatchId, activeTab, messages, player, safetySettings.sendReadReceipts]);

  useEffect(() => {
    if (!player || !activeMatchId) return;

    const channel = supabase
      .channel(`dating-typing-${activeMatchId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typingPayload = payload as { match_id?: string; sender_id?: string; is_typing?: boolean };
        if (typingPayload.match_id !== activeMatchId || typingPayload.sender_id === player.id) return;

        const isTyping = Boolean(typingPayload.is_typing);
        setTypingByMatch((current) => ({ ...current, [activeMatchId]: isTyping }));

        if (incomingTypingTimeoutRef.current) {
          window.clearTimeout(incomingTypingTimeoutRef.current);
          incomingTypingTimeoutRef.current = null;
        }

        if (isTyping) {
          incomingTypingTimeoutRef.current = window.setTimeout(() => {
            setTypingByMatch((current) => ({ ...current, [activeMatchId]: false }));
            incomingTypingTimeoutRef.current = null;
          }, 3600);
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (incomingTypingTimeoutRef.current) {
        window.clearTimeout(incomingTypingTimeoutRef.current);
        incomingTypingTimeoutRef.current = null;
      }
      if (lastTypingSentRef.current === `${activeMatchId}:true`) {
        void channel.send({
          type: "broadcast",
          event: "typing",
          payload: { match_id: activeMatchId, sender_id: player.id, is_typing: false },
        });
        lastTypingSentRef.current = `${activeMatchId}:false`;
      }
      setTypingByMatch((current) => ({ ...current, [activeMatchId]: false }));
      typingChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [activeMatchId, player]);

  useEffect(() => {
    if (!player || activeTab !== "chat" || !activeMatchId || !typingChannelRef.current) return;

    const isTyping = Boolean(chatDraft.trim());

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (typingHeartbeatRef.current) {
      window.clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }

    if (isTyping) {
      broadcastTypingState(true);
      typingHeartbeatRef.current = window.setInterval(() => {
        broadcastTypingState(true, true);
      }, 1500);
      typingTimeoutRef.current = window.setTimeout(() => {
        if (typingHeartbeatRef.current) {
          window.clearInterval(typingHeartbeatRef.current);
          typingHeartbeatRef.current = null;
        }
        broadcastTypingState(false);
        typingTimeoutRef.current = null;
      }, 2500);
    } else {
      broadcastTypingState(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingHeartbeatRef.current) {
        window.clearInterval(typingHeartbeatRef.current);
        typingHeartbeatRef.current = null;
      }
    };
  }, [activeMatchId, activeTab, chatDraft, player]);

  useEffect(() => {
    if (typeof window === "undefined" || !player || Notification.permission !== "granted" || safetySettings.quietMode) return;

    let reminderTimer: number | null = null;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        reminderTimer = window.setTimeout(() => {
          void showSystemNotification({
            title: "Your matches are waiting",
            body: matches.length ? "You have chats and matches waiting in the partner finder." : "Finish your profile and keep swiping when you come back.",
            url: "/",
            tag: `dating-reminder-${player.id}`,
          });
        }, 60000);
      } else if (reminderTimer) {
        window.clearTimeout(reminderTimer);
        reminderTimer = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reminderTimer) window.clearTimeout(reminderTimer);
    };
  }, [matches.length, player]);

  const ownDatingProfile = player ? profileMap[player.id] : null;
  const visiblePartnerProfiles = useMemo(
    () =>
      profiles.filter((profile) => {
        const controls = userControls[profile.user_id] || {};
        if (controls.blocked || controls.blockedBy) return false;
        if (!appSettings.enableDiscovery) return false;
        if ((profile.intent_lounge || profile.relationship_goal || "Serious Relationship") !== activeLounge) return false;
        if (appSettings.interestedIn !== "Everyone" && profile.gender) {
          const normalizedGender = profile.gender.toLowerCase();
          if (!settingsGenderTargets[appSettings.interestedIn].some((value) => normalizedGender.includes(value))) return false;
        }
        if (profile.age < appSettings.ageMin || profile.age > appSettings.ageMax) return false;
        const photoCount = [profile.photo_url, ...(profile.gallery_urls || [])].filter(Boolean).length;
        if (photoCount < appSettings.minimumPhotos) return false;
        if (appSettings.requireBio && !profile.bio.trim()) return false;
        if (kidsFilter !== filterAny && profile.wants_kids !== kidsFilter) return false;
        if (smokesFilter !== filterAny && profile.smokes !== smokesFilter) return false;
        if (drinksFilter !== filterAny && profile.drinks !== drinksFilter) return false;
        if (soberDatesOnly && !profile.sober_dates) return false;
        if (!appSettings.globalMode) {
          const distanceKm = distanceBetweenProfilesInKm(ownDatingProfile, profile);
          if (distanceKm !== null && distanceKm > appSettings.maxDistanceKm && !appSettings.allowOutsideRange) return false;
        }
        return true;
      }),
    [activeLounge, appSettings, drinksFilter, kidsFilter, ownDatingProfile, profiles, smokesFilter, soberDatesOnly, userControls]
  );

  const currentProfile = useMemo(() => {
    if (!visiblePartnerProfiles.length) return null;
    return visiblePartnerProfiles[stackIndex % visiblePartnerProfiles.length] ?? null;
  }, [visiblePartnerProfiles, stackIndex]);

  const canUseDating = useMemo(() => {
    if (!player) return false;
    return (player.age ?? 18) >= 18;
  }, [player]);

  const activeMatch = matches.find((match) => match.id === activeMatchId) || null;
  const activeMatchProfile = activeMatch ? profileMap[activeMatch.user_a === player?.id ? activeMatch.user_b : activeMatch.user_a] : null;
  const activeMatchControls = activeMatchProfile ? userControls[activeMatchProfile.user_id] || {} : {};
  const activeOfficialRequest = activeMatch && player && activeMatchProfile
    ? officialRequests.find(
        (request) =>
          request.match_id === activeMatch.id &&
          request.status === "pending" &&
          ((request.requester_id === player.id && request.partner_id === activeMatchProfile.user_id) ||
            (request.requester_id === activeMatchProfile.user_id && request.partner_id === player.id))
      )
    : null;
  const officialButtonLabel = activeOfficialRequest
    ? activeOfficialRequest.requester_id === player?.id
      ? "Official request sent"
      : "Confirm Official"
    : "Make It Official";
  const activeMessages = activeMatch ? messages.filter((message) => message.match_id === activeMatch.id) : [];
  const distanceForProfile = (profile?: DatingProfile | null) =>
    safetySettings.hideDistance ? null : distanceLabelBetweenProfiles(ownDatingProfile, profile);
  const unreadCounts = useMemo(() => {
    if (!player) return {};

    return messages.reduce<Record<string, number>>((accumulator, message) => {
      if (message.sender_id !== player.id && !message.read_at && !userControls[message.sender_id]?.blocked) {
        accumulator[message.match_id] = (accumulator[message.match_id] || 0) + 1;
      }

      return accumulator;
    }, {});
  }, [messages, player, userControls]);
  const totalUnreadCount = Object.values(unreadCounts).reduce((total, count) => total + count, 0);
  const chatMatches = matches;
  const visibleMatches = matches.filter((match) => {
    const partnerId = match.user_a === player?.id ? match.user_b : match.user_a;
    const controls = userControls[partnerId] || {};
    return !controls.blocked && !controls.unmatched;
  });
  const activeChatMatches = visibleMatches.filter((match) => {
    const partnerId = match.user_a === player?.id ? match.user_b : match.user_a;
    const controls = userControls[partnerId] || {};
    return !controls.deletedChat && !controls.closed;
  });
  const canOpenActiveChat = (match: MatchRow) => {
    const partnerId = match.user_a === player?.id ? match.user_b : match.user_a;
    if (!userControls[partnerId]?.closed && !userControls[partnerId]?.deletedChat) return true;
    return activeChatMatches.length < activeChatLimit;
  };
  const openMatchChat = (match: MatchRow) => {
    const partnerId = match.user_a === player?.id ? match.user_b : match.user_a;
    if (!canOpenActiveChat(match)) {
      setStatus(`You can keep ${activeChatLimit} active chats. Close or archive one before opening another.`);
      setActiveTab("chat");
      return;
    }
    updateUserControls(partnerId, { closed: false, deletedChat: false });
    markMatchAsRead(match.id);
    setActiveMatchId(match.id);
    setActiveTab("chat");
  };
  const matchForProfile = (profile?: DatingProfile | null) =>
    profile
      ? matches.find(
          (match) =>
            (match.user_a === player?.id && match.user_b === profile.user_id) ||
            (match.user_b === player?.id && match.user_a === profile.user_id)
        ) || null
      : null;
  const openExploreProfile = (profile: DatingProfile) => {
    setSelectedExploreProfile(profile);
    setStatus(`Viewing ${profile.display_name}'s account from Explore.`);
  };
  const openExploreSection = (title: string) => {
    setSelectedExploreSectionTitle(title);
    setSelectedExploreProfile(null);
  };
  const exploreProfiles = visiblePartnerProfiles;
  const exploreProfileScore = (profile: DatingProfile) =>
    (vouchCounts[profile.user_id] || 0) +
    (likedMeIds.includes(profile.user_id) ? 200 : 0) +
    (isProfileVerified(profile) ? 100 : 0) +
    (profile.relationship_goal?.toLowerCase().includes("long") ? 40 : 0) +
    (profile.intent_lounge === activeLounge ? 25 : 0);
  const exploreSections = useMemo<ExploreSection[]>(() => {
    if (!exploreProfiles.length) return [];

    const sorted = [...exploreProfiles].sort((first, second) => exploreProfileScore(second) - exploreProfileScore(first));
    const longTerm = sorted.filter((profile) => {
      const goal = (profile.relationship_goal || "").toLowerCase();
      return goal.includes("long") || goal.includes("serious") || goal.includes("marriage");
    });
    const social = sorted.filter((profile) => {
      const goal = (profile.relationship_goal || "").toLowerCase();
      return goal.includes("casual") || goal.includes("friend") || goal.includes("tonight") || goal.includes("social");
    });
    const remaining = sorted.filter((profile) => !longTerm.includes(profile) && !social.includes(profile));

    const sections: ExploreSection[] = [
      {
        title: activeLounge === "Serious Relationship" ? "Serious Daters" : activeLounge,
        subtitle: "Top profiles in your current lounge.",
        countLabel: `${sorted.length} account${sorted.length === 1 ? "" : "s"}`,
        themeClass: "from-[#9f4a32] via-[#582215] to-[#1a1417]",
        featured: true,
        profiles: sorted,
      },
      {
        title: "Long-term partner",
        subtitle: "People looking for something steady.",
        countLabel: `${(longTerm.length ? longTerm : sorted).length} account${(longTerm.length ? longTerm : sorted).length === 1 ? "" : "s"}`,
        themeClass: "from-[#5d2449] via-[#2c1730] to-[#17131c]",
        profiles: longTerm.length ? longTerm : sorted,
      },
      {
        title: "Fresh connections",
        subtitle: "A mix worth opening right now.",
        countLabel: `${(social.length ? social : remaining.length ? remaining : sorted).length} account${(social.length ? social : remaining.length ? remaining : sorted).length === 1 ? "" : "s"}`,
        themeClass: "from-[#745f10] via-[#3b2d16] to-[#171411]",
        profiles: social.length ? social : remaining.length ? remaining : sorted,
      },
    ];

    return sections.filter((section) => section.profiles.length);
  }, [activeLounge, exploreProfileScore, exploreProfiles, likedMeIds, vouchCounts]);
  const activeExploreSection = selectedExploreSectionTitle
    ? exploreSections.find((section) => section.title === selectedExploreSectionTitle) || null
    : null;
  const hasExploreOverlay = activeTab === "explore" && (Boolean(activeExploreSection) || Boolean(selectedExploreProfile));
  const selectedExploreIndex = selectedExploreProfile && activeExploreSection
    ? activeExploreSection.profiles.findIndex((profile) => profile.user_id === selectedExploreProfile.user_id)
    : -1;
  const showPreviousExploreProfile = () => {
    if (!activeExploreSection?.profiles.length || selectedExploreIndex < 0) return;
    setSelectedExploreProfile(activeExploreSection.profiles[(selectedExploreIndex - 1 + activeExploreSection.profiles.length) % activeExploreSection.profiles.length]);
  };
  const showNextExploreProfile = () => {
    if (!activeExploreSection?.profiles.length || selectedExploreIndex < 0) return;
    setSelectedExploreProfile(activeExploreSection.profiles[(selectedExploreIndex + 1) % activeExploreSection.profiles.length]);
  };

  const markMatchAsRead = (matchId: string) => {
    if (!player) return;
    if (!safetySettings.sendReadReceipts) return;

    const hasUnread = messages.some((message) => message.match_id === matchId && message.sender_id !== player.id && !message.read_at);
    const readAt = new Date().toISOString();

    if (hasUnread) {
      setMessages((current) =>
        current.map((message) =>
          message.match_id === matchId && message.sender_id !== player.id && !message.read_at ? { ...message, read_at: readAt } : message
        )
      );
    }

    void supabase
      .from("dating_messages")
      .update({ read_at: readAt })
      .eq("match_id", matchId)
      .neq("sender_id", player.id)
      .is("read_at", null)
      .select("id, match_id, sender_id, body, created_at, read_at")
      .then(({ data, error: readError }) => {
        if (readError) {
          console.error("Could not mark match as read", readError);
          return;
        }

        if (data?.length) {
          setMessages((current) => mergeMessagesPreservingReads(current, data as MessageRow[]));
        }
      });
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      window.clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const playRingPulse = () => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = ringtoneContextRef.current || new AudioContextClass();
    ringtoneContextRef.current = context;
    void context.resume();

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    gain.connect(context.destination);

    [0, 0.24].forEach((offset) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(660, now + offset + 0.18);
      oscillator.connect(gain);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.22);
    });
  };

  const startRingtone = () => {
    if (ringtoneIntervalRef.current) return;
    playRingPulse();
    ringtoneIntervalRef.current = window.setInterval(playRingPulse, 1800);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current !== null) {
      window.clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDurationSeconds(0);
  };

  const startCallTimer = () => {
    if (callTimerRef.current !== null) return;
    const startedAt = Date.now();
    setCallDurationSeconds(0);
    callTimerRef.current = window.setInterval(() => {
      setCallDurationSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
  };

  const stopCallStreams = () => {
    localCallStream?.getTracks().forEach((track) => track.stop());
    remoteCallStream?.getTracks().forEach((track) => track.stop());
    setLocalCallStream(null);
    setRemoteCallStream(null);
  };

  const sendCallSignal = (payload: Record<string, unknown>) => {
    const matchId = typeof payload.match_id === "string" ? payload.match_id : "";
    const channel = matchId ? callChannelsRef.current[matchId] : null;
    void channel?.send({
      type: "broadcast",
      event: "call",
      payload,
    });
  };

  const createPeerConnection = (matchId: string, peerId: string) => {
    peerConnectionRef.current?.close();
    const peerConnection = new RTCPeerConnection(rtcConfig);
    const remoteStream = new MediaStream();
    setRemoteCallStream(remoteStream);

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !player) return;
      sendCallSignal({
        type: "candidate",
        match_id: matchId,
        from: player.id,
        to: peerId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
      setRemoteCallStream(remoteStream);
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const endCall = (notifyPeer = true) => {
    stopRingtone();
    stopCallTimer();
    if (notifyPeer && player && callState) {
      sendCallSignal({
        type: "end",
        match_id: callState.matchId,
        from: player.id,
        to: callState.peerId,
      });
    }

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    pendingOfferRef.current = null;
    stopCallStreams();
    setCallState(null);
  };

  const startCall = async (kind: CallKind) => {
    if (!player || !activeMatch || !activeMatchProfile) return;
    if (userControls[activeMatchProfile.user_id]?.blocked || userControls[activeMatchProfile.user_id]?.blockedBy) {
      setError(
        userControls[activeMatchProfile.user_id]?.blocked
          ? `Unblock ${activeMatchProfile.display_name} before starting a call.`
          : `You cannot call ${activeMatchProfile.display_name} right now.`
      );
      return;
    }
    if (!callChannelsRef.current[activeMatch.id]) {
      setError("Call service is still connecting. Wait a moment and try again.");
      return;
    }

    try {
      const stream = await getCallStream(kind);
      setLocalCallStream(stream);
      const peerConnection = createPeerConnection(activeMatch.id, activeMatchProfile.user_id);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      setCallState({
        status: "calling",
        kind,
        matchId: activeMatch.id,
        peerId: activeMatchProfile.user_id,
        peerName: activeMatchProfile.display_name,
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendCallSignal({
        type: "offer",
        match_id: activeMatch.id,
        from: player.id,
        to: activeMatchProfile.user_id,
        kind,
        peer_name: player.name || "Your match",
        sdp: offer,
      });
    } catch (callError) {
      console.error("Could not start call", callError);
      setError("Could not start the call. Allow microphone/camera access and try again.");
      endCall(false);
    }
  };

  const acceptCall = async () => {
    if (!player || !callState || !pendingOfferRef.current) return;

    try {
      stopRingtone();
      setCallState((current) => (current ? { ...current, status: "connecting" } : current));
      const stream = await getCallStream(callState.kind);
      setLocalCallStream(stream);
      const peerConnection = createPeerConnection(callState.matchId, callState.peerId);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendCallSignal({
        type: "answer",
        match_id: callState.matchId,
        from: player.id,
        to: callState.peerId,
        sdp: answer,
      });
      pendingOfferRef.current = null;
      setCallState((current) => (current ? { ...current, status: "connected" } : current));
      startCallTimer();
    } catch (callError) {
      console.error("Could not accept call", callError);
      setError("Could not join the call. Allow microphone/camera access and try again.");
      endCall(true);
    }
  };

  const rejectCall = () => endCall(true);

  const getCallStream = (kind: CallKind) =>
    navigator.mediaDevices.getUserMedia({
      audio: voiceAudioConstraints,
      video: kind === "video" ? { facingMode: "user" } : false,
    });

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localCallStream;
  }, [localCallStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteCallStream;
  }, [remoteCallStream]);

  useEffect(() => {
    if (callState?.status === "incoming" || callState?.status === "ringing") {
      startRingtone();
      return;
    }

    stopRingtone();
  }, [callState?.status]);

  useEffect(() => {
    return () => {
      stopRingtone();
      stopCallTimer();
      void ringtoneContextRef.current?.close();
      ringtoneContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!player || !matches.length) return;

    const nextChannels: Record<string, ReturnType<typeof supabase.channel>> = {};
    matches.forEach((match) => {
      const peerId = match.user_a === player.id ? match.user_b : match.user_a;
      const channel = supabase
        .channel(`dating-call-${match.id}`)
        .on("broadcast", { event: "call" }, async ({ payload }) => {
        const callPayload = payload as {
          type?: string;
          match_id?: string;
          from?: string;
          to?: string;
          kind?: CallKind;
          peer_name?: string;
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
        };

        if (callPayload.match_id !== match.id || callPayload.from === player.id || callPayload.to !== player.id) return;

        if (callPayload.type === "offer" && callPayload.sdp && callPayload.kind) {
          const peerProfile = profileMap[callPayload.from || peerId];
          pendingOfferRef.current = callPayload.sdp;
          setActiveMatchId(match.id);
          setActiveTab("chat");
          setCallState({
            status: "incoming",
            kind: callPayload.kind,
            matchId: match.id,
            peerId: callPayload.from || peerId,
            peerName: callPayload.peer_name || peerProfile?.display_name || "Your match",
          });
          sendCallSignal({
            type: "ringing",
            match_id: match.id,
            from: player.id,
            to: callPayload.from || peerId,
          });
          return;
        }

        if (callPayload.type === "ringing") {
          setCallState((current) => (current && current.peerId === (callPayload.from || peerId) ? { ...current, status: "ringing" } : current));
          return;
        }

        if (callPayload.type === "answer" && callPayload.sdp && peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(callPayload.sdp));
          setCallState((current) => (current ? { ...current, status: "connected" } : current));
          startCallTimer();
          return;
        }

        if (callPayload.type === "candidate" && callPayload.candidate && peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(callPayload.candidate));
          } catch (candidateError) {
            console.warn("Could not add call candidate", candidateError);
          }
          return;
        }

        if (callPayload.type === "end") {
          endCall(false);
        }
      })
      .subscribe();

      nextChannels[match.id] = channel;
    });

    callChannelsRef.current = nextChannels;

    return () => {
      callChannelsRef.current = {};
      Object.values(nextChannels).forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [matches, player, profileMap]);

  useEffect(() => {
    if (typeof window === "undefined" || !player || Notification.permission !== "granted") return;

    const summary = {
      likedMeCount: likedMeIds.length,
      matchCount: matches.length,
      messageCount: messages.length,
      lastMessageId: messages[messages.length - 1]?.id || "",
      lastMessageMatchId: messages[messages.length - 1]?.match_id || "",
    };

    const stored = window.localStorage.getItem(summaryKey(player.id));
    if (!stored) {
      window.localStorage.setItem(summaryKey(player.id), JSON.stringify(summary));
      return;
    }

    try {
      const previous = JSON.parse(stored) as typeof summary;

      if (document.visibilityState === "hidden") {
        if (summary.likedMeCount > previous.likedMeCount) {
          void showSystemNotification({
            title: "New like waiting",
            body: "Someone new liked your profile. Open the app to see who it is.",
            url: "/?tab=likes",
            tag: `dating-like-${player.id}`,
          });
        }

        if (summary.matchCount > previous.matchCount) {
          const newestMatch = matches[0];
          const newestProfile = newestMatch ? profileMap[newestMatch.user_a === player.id ? newestMatch.user_b : newestMatch.user_a] : null;
          void showSystemNotification({
            title: "It's a new match",
            body: newestProfile ? `${newestProfile.display_name} matched with you. Start chatting now.` : "You have a new mutual match waiting.",
            url: "/?tab=chat",
            tag: `dating-match-${player.id}`,
          });
        }

        if (summary.messageCount > previous.messageCount) {
          const latestMessage = messages[messages.length - 1];
          const latestMatch = latestMessage ? matches.find((match) => match.id === latestMessage.match_id) : null;
          const latestProfile = latestMatch ? profileMap[latestMatch.user_a === player.id ? latestMatch.user_b : latestMatch.user_a] : null;
          if (
            safetySettings.messageNotifications &&
            latestMessage?.sender_id !== player.id &&
            latestMessage &&
            (!latestProfile || (!userControls[latestProfile.user_id]?.muted && !userControls[latestProfile.user_id]?.blocked)) &&
            !notifiedMessageIdsRef.current.has(latestMessage.id)
          ) {
            notifiedMessageIdsRef.current.add(latestMessage.id);
            void showSystemNotification({
              title: latestProfile ? `${latestProfile.display_name} sent a message` : "New message",
              body: chatNotificationBody(latestMessage.body),
              url: "/?tab=chat",
              tag: `dating-message-${player.id}-${latestMessage.id}`,
            });
          }
        }
      }
    } catch {
      // Ignore bad local notification state and reset below.
    }

    window.localStorage.setItem(summaryKey(player.id), JSON.stringify(summary));
  }, [likedMeIds.length, matches, messages, player, profileMap, safetySettings.messageNotifications, safetySettings.quietMode, userControls]);

  useEffect(() => {
    if (activeTab !== "explore") setSelectedExploreProfile(null);
  }, [activeTab]);
  useEffect(() => {
    if (activeTab !== "explore") setSelectedExploreSectionTitle(null);
  }, [activeTab]);

  const advanceStack = () => setStackIndex((value) => (visiblePartnerProfiles.length ? (value + 1) % visiblePartnerProfiles.length : 0));

  const passProfile = () => {
    if (!currentProfile) return;
    setError("");
    setStatus(`Showing the next account after ${currentProfile.display_name}.`);
    advanceStack();
  };

  const likeSpecificProfile = async (profile: DatingProfile, superLike = false) => {
    if (!player) return;
    setSaving(true);
    setError("");

    try {
      const { error: likeError } = await supabase.from("dating_likes").insert({
        liker_id: player.id,
        liked_user_id: profile.user_id,
      });

      const alreadyLiked =
        likeError?.code === "23505" ||
        Boolean(likeError?.message.toLowerCase().includes("duplicate") || likeError?.message.toLowerCase().includes("unique"));

      if (likeError && !alreadyLiked) {
        console.warn("Dating like could not be saved", likeError);
        setStatus(`Could not save the like for ${profile.display_name} right now.`);
        setSaving(false);
        return;
      }

      const { data: mutualLike, error: mutualError } = await supabase
        .from("dating_likes")
        .select("liker_id")
        .eq("liker_id", profile.user_id)
        .eq("liked_user_id", player.id)
        .maybeSingle();

      if (mutualError) {
        console.warn("Could not check mutual like", mutualError);
        setStatus(`You liked ${profile.display_name}.`);
        setSaving(false);
        return;
      }

      setLikedIds((current) => [...new Set([...current, profile.user_id])]);

      if (mutualLike) {
        const [userA, userB] = sortPair(player.id, profile.user_id);
        const { data: matchRow, error: matchInsertError } = await supabase
          .from("dating_matches")
          .upsert({ user_a: userA, user_b: userB }, { onConflict: "user_a,user_b" })
          .select("id, user_a, user_b, created_at")
          .single();

        if (matchInsertError) {
          console.warn("Could not create dating match", matchInsertError);
          setStatus(`You liked ${profile.display_name}.`);
          setSaving(false);
          return;
        }

        setStatus(`It is a match with ${profile.display_name}. You can start chatting now.`);
        setMatchCelebrationProfile(profile);
        setSelectedExploreProfile(profile);
        if (currentProfile?.user_id === profile.user_id) advanceStack();
        await loadScene(matchRow?.id);
      } else {
        setStatus(superLike ? `You gave ${profile.display_name} a strong like.` : `You liked ${profile.display_name}.`);
        if (currentProfile?.user_id === profile.user_id) advanceStack();
      }
    } catch (likeError) {
      console.error("Dating like failed", likeError);
      setError("Could not save your like right now.");
    } finally {
      setSaving(false);
    }
  };
  const likeProfile = async (superLike = false) => {
    if (!currentProfile) return;
    await likeSpecificProfile(currentProfile, superLike);
  };
  const openProfileChatFromExplore = (profile: DatingProfile) => {
    const match = matchForProfile(profile);
    if (!match) {
      setStatus(`You need a mutual match with ${profile.display_name} before opening chat.`);
      return;
    }
    setSelectedExploreProfile(null);
    openMatchChat(match);
  };

  const sendMessage = async (quickBody?: string, clearDraftOverride?: boolean) => {
    const body = (quickBody || chatDraft).trim();
    if (!player || !activeMatch || !body) return;
    if (activeMatchProfile && (userControls[activeMatchProfile.user_id]?.blocked || userControls[activeMatchProfile.user_id]?.blockedBy)) {
      setError(
        userControls[activeMatchProfile.user_id]?.blocked
          ? `Unblock ${activeMatchProfile.display_name} before sending a message.`
          : `You cannot message ${activeMatchProfile.display_name} right now.`
      );
      return;
    }
    setSaving(true);
    setError("");
    const tempId = `temp-${Date.now()}`;
    const tempMessage: MessageRow = {
      id: tempId,
      match_id: activeMatch.id,
      sender_id: player.id,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    const shouldClearDraft = clearDraftOverride ?? !quickBody;

    try {
      setMessages((current) => [...current, tempMessage]);
      if (shouldClearDraft) {
        broadcastTypingState(false, true);
        setChatDraft("");
      }

      const { data: sentMessage, error: sendError } = await supabase
        .from("dating_messages")
        .insert({
          match_id: activeMatch.id,
          sender_id: player.id,
          body,
        })
        .select("id, match_id, sender_id, body, created_at, read_at")
        .single();

      if (sendError) {
        setMessages((current) => current.filter((message) => message.id !== tempId));
        if (shouldClearDraft) setChatDraft(body);
        setError(schemaHelp);
        setSaving(false);
        return;
      }

      if (sentMessage) {
        setMessages((current) => {
          const typedMessage = sentMessage as MessageRow;
          if (current.some((message) => message.id === typedMessage.id)) {
            return current.filter((message) => message.id !== tempId);
          }

          return current.map((message) => (message.id === tempId ? typedMessage : message));
        });
      }

      setStatus(`Message sent to ${activeMatchProfile?.display_name || "your match"}.`);
    } catch (sendError) {
      console.error("Dating message failed", sendError);
      setMessages((current) => current.filter((message) => message.id !== tempId));
      if (shouldClearDraft) setChatDraft(body);
      setError("Could not send the message right now.");
    } finally {
      setSaving(false);
    }
  };

  const sendChatImage = async (file: File) => {
    if (!player || !activeMatch || !file.type.startsWith("image/")) return;
    if (activeMatchProfile && (userControls[activeMatchProfile.user_id]?.blocked || userControls[activeMatchProfile.user_id]?.blockedBy)) {
      setError(
        userControls[activeMatchProfile.user_id]?.blocked
          ? `Unblock ${activeMatchProfile.display_name} before sending a picture.`
          : `You cannot send ${activeMatchProfile.display_name} a picture right now.`
      );
      return;
    }
    setSaving(true);
    setError("");

    try {
      const extension = file.name.split(".").pop() || "jpg";
      const filePath = `${player.id}/chat-${activeMatch.id}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("dating-photos").upload(filePath, file, { upsert: true });

      if (uploadError) {
        setError(`Could not upload picture: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("dating-photos").getPublicUrl(filePath);
      const { data: sentMessage, error: sendError } = await supabase
        .from("dating_messages")
        .insert({
          match_id: activeMatch.id,
          sender_id: player.id,
          body: `${chatImagePrefix}${publicUrlData.publicUrl}`,
        })
        .select("id, match_id, sender_id, body, created_at, read_at")
        .single();

      if (sendError) {
        setError(schemaHelp);
        setSaving(false);
        return;
      }

      if (sentMessage) {
        setMessages((current) => (current.some((message) => message.id === sentMessage.id) ? current : [...current, sentMessage as MessageRow]));
      }
      setStatus(`Picture sent to ${activeMatchProfile?.display_name || "your match"}.`);
    } catch (sendError) {
      console.error("Dating picture message failed", sendError);
      setError("Could not send the picture right now.");
    } finally {
      setSaving(false);
    }
  };

  const sendChatAttachment = async (file: File, kind: "document" | "media" | "camera" | "audio") => {
    if (!player || !activeMatch || !file.size) return;
    if (activeMatchProfile && (userControls[activeMatchProfile.user_id]?.blocked || userControls[activeMatchProfile.user_id]?.blockedBy)) {
      setError(
        userControls[activeMatchProfile.user_id]?.blocked
          ? `Unblock ${activeMatchProfile.display_name} before sending an attachment.`
          : `You cannot send ${activeMatchProfile.display_name} an attachment right now.`
      );
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    if ((kind === "media" || kind === "camera") && !isImage && !isVideo) return;
    if (kind === "audio" && !isAudio) return;

    setSaving(true);
    setError("");

    try {
      const extension = file.name.split(".").pop() || (isVideo ? "mp4" : isAudio ? "mp3" : isImage ? "jpg" : "file");
      const safeKind = kind === "camera" ? "photo" : kind;
      const filePath = `${player.id}/${safeKind}-${activeMatch.id}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("dating-photos").upload(filePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

      if (uploadError) {
        setError(`Could not upload attachment: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("dating-photos").getPublicUrl(filePath);
      const payload: ChatAttachmentPayload = { url: publicUrlData.publicUrl, name: file.name || "Attachment", type: file.type, size: file.size };
      const body = isImage
        ? `${chatImagePrefix}${publicUrlData.publicUrl}`
        : isVideo
          ? `${chatVideoPrefix}${encodeChatPayload(payload)}`
          : isAudio
            ? `${chatAudioPrefix}${publicUrlData.publicUrl}`
            : `${chatDocumentPrefix}${encodeChatPayload(payload)}`;

      const { data: sentMessage, error: sendError } = await supabase
        .from("dating_messages")
        .insert({ match_id: activeMatch.id, sender_id: player.id, body })
        .select("id, match_id, sender_id, body, created_at, read_at")
        .single();

      if (sendError) {
        setError(schemaHelp);
        setSaving(false);
        return;
      }

      if (sentMessage) {
        setMessages((current) => (current.some((message) => message.id === sentMessage.id) ? current : [...current, sentMessage as MessageRow]));
      }
      setStatus(`Attachment sent to ${activeMatchProfile?.display_name || "your match"}.`);
    } catch (sendError) {
      console.error("Dating attachment failed", sendError);
      setError("Could not send the attachment right now.");
    } finally {
      setSaving(false);
    }
  };

  const sendVoiceNote = async (blob: Blob) => {
    if (!player || !activeMatch || !blob.size) return;
    if (activeMatchProfile && (userControls[activeMatchProfile.user_id]?.blocked || userControls[activeMatchProfile.user_id]?.blockedBy)) {
      setError(
        userControls[activeMatchProfile.user_id]?.blocked
          ? `Unblock ${activeMatchProfile.display_name} before sending a voice note.`
          : `You cannot send ${activeMatchProfile.display_name} a voice note right now.`
      );
      return;
    }
    setSaving(true);
    setError("");

    try {
      const filePath = `${player.id}/voice-${activeMatch.id}-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from("dating-photos").upload(filePath, blob, {
        contentType: blob.type || "audio/webm",
        upsert: true,
      });

      if (uploadError) {
        setError(`Could not upload voice note: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("dating-photos").getPublicUrl(filePath);
      const { data: sentMessage, error: sendError } = await supabase
        .from("dating_messages")
        .insert({
          match_id: activeMatch.id,
          sender_id: player.id,
          body: `${chatAudioPrefix}${publicUrlData.publicUrl}`,
        })
        .select("id, match_id, sender_id, body, created_at, read_at")
        .single();

      if (sendError) {
        setError(schemaHelp);
        setSaving(false);
        return;
      }

      if (sentMessage) {
        setMessages((current) => (current.some((message) => message.id === sentMessage.id) ? current : [...current, sentMessage as MessageRow]));
      }
      setStatus(`Voice note sent to ${activeMatchProfile?.display_name || "your match"}.`);
    } catch (sendError) {
      console.error("Dating voice note failed", sendError);
      setError("Could not send the voice note right now.");
    } finally {
      setSaving(false);
    }
  };

  const makeItOfficial = async () => {
    if (!player || !activeMatch || !activeMatchProfile || saving) return;
    if (activeMatchProfile.official_partner_id && activeMatchProfile.official_partner_id !== player.id) {
      setError(`${activeMatchProfile.display_name} is already marked as taken by ${activeMatchProfile.official_partner_name || "someone else"}.`);
      return;
    }
    setSaving(true);
    setError("");

    try {
      const ownProfile = profileMap[player.id];
      const nextProgress = { ...progress, spouse: activeMatchProfile.display_name };
      const officialSince = new Date().toISOString();
      const incomingRequest = officialRequests.find(
        (request) =>
          request.match_id === activeMatch.id &&
          request.requester_id === activeMatchProfile.user_id &&
          request.partner_id === player.id &&
          request.status === "pending"
      );

      if (!incomingRequest) {
        const { data: createdRequest, error: requestError } = await supabase
          .from("dating_official_requests")
          .upsert(
            {
              match_id: activeMatch.id,
              requester_id: player.id,
              partner_id: activeMatchProfile.user_id,
              status: "pending",
            },
            { onConflict: "match_id,requester_id,partner_id" }
          )
          .select("id, match_id, requester_id, partner_id, status, created_at, responded_at")
          .single();

        if (requestError) {
          setError(requestError.message || schemaHelp);
          setSaving(false);
          return;
        }

        if (createdRequest) {
          setOfficialRequests((current) => [...current.filter((request) => request.id !== createdRequest.id), createdRequest as OfficialRequestRow]);
        }
        await sendMessage(`${activeMatchProfile.display_name}, I want us to make it official. Please tap Make It Official to confirm.`, false);
        setStatus(`Official request sent to ${activeMatchProfile.display_name}. They must confirm too.`);
        setSaving(false);
        return;
      }

      await supabase
        .from("dating_official_requests")
        .update({ status: "accepted", responded_at: officialSince })
        .eq("id", incomingRequest.id);
      setOfficialRequests((current) =>
        current.map((request) => (request.id === incomingRequest.id ? { ...request, status: "accepted", responded_at: officialSince } : request))
      );

      window.localStorage.setItem(`partner-progress:${player.id}`, JSON.stringify(nextProgress));
      window.sessionStorage.setItem(`partner-flash:${player.id}`, `You and ${activeMatchProfile.display_name} made it official.`);

      const { error: ownProfileError } = await supabase
        .from("dating_profiles")
        .update({
          official_partner_id: activeMatchProfile.user_id,
          official_partner_name: activeMatchProfile.display_name,
          official_since: officialSince,
          partnership_visible: true,
          updated_at: officialSince,
        })
        .eq("user_id", player.id);

      const { error: partnerProfileError } = await supabase
        .from("dating_profiles")
        .update({
          official_partner_id: player.id,
          official_partner_name: ownProfile?.display_name || player.name || "Your partner",
          official_since: officialSince,
          partnership_visible: true,
          updated_at: officialSince,
        })
        .eq("user_id", activeMatchProfile.user_id);

      if (ownProfileError || partnerProfileError) {
        setError(ownProfileError?.message || partnerProfileError?.message || schemaHelp);
        setSaving(false);
        return;
      }

      setProgress(nextProgress);
      setProfileMap((current) => ({
        ...current,
        [player.id]: current[player.id]
          ? {
              ...current[player.id],
              official_partner_id: activeMatchProfile.user_id,
              official_partner_name: activeMatchProfile.display_name,
              official_since: officialSince,
              partnership_visible: true,
            }
          : current[player.id],
        [activeMatchProfile.user_id]: {
          ...activeMatchProfile,
          official_partner_id: player.id,
          official_partner_name: ownProfile?.display_name || player.name || "Your partner",
          official_since: officialSince,
          partnership_visible: true,
        },
      }));
      setStatus(`You and ${activeMatchProfile.display_name} are official now.`);
      setSaving(false);
    } catch (updateError) {
      console.error("Partner match save failed", updateError);
      setError("Could not save this match right now. Please try again.");
      setSaving(false);
    }
  };

  const vouchForMatch = async () => {
    if (!player || !activeMatch || !activeMatchProfile) return;
    const note = window.prompt(`Confirm you met ${activeMatchProfile.display_name} in person. Optional note:`, "Real person, met safely.");
    if (note === null) return;

    const { error: vouchError } = await supabase
      .from("dating_vouches")
      .upsert(
        {
          voucher_id: player.id,
          vouched_user_id: activeMatchProfile.user_id,
          match_id: activeMatch.id,
          note: note.trim() || "Met in person.",
        },
        { onConflict: "voucher_id,vouched_user_id" }
      );

    if (vouchError) {
      setError(vouchError.message || schemaHelp);
      return;
    }

    setVouchedIds((current) => [...new Set([...current, activeMatchProfile.user_id])]);
    setVouchCounts((current) => ({ ...current, [activeMatchProfile.user_id]: (current[activeMatchProfile.user_id] || 0) + 1 }));
    setStatus(`You vouched that ${activeMatchProfile.display_name} is a real person.`);
  };

  const planSafeDate = async () => {
    if (!player || !activeMatch || !activeMatchProfile) return;
    const title = window.prompt("Date plan title", "First safe meet-up");
    if (!title?.trim()) return;
    const place = window.prompt("Public place", "A cafe or public mall nearby");
    if (!place?.trim()) return;
    const when = window.prompt("When? Use a date/time or words", "This weekend");
    const emergencyContact = window.prompt("Emergency contact phone/email (optional)", "") || "";

    const { error: dateError } = await supabase.from("dating_date_plans").insert({
      match_id: activeMatch.id,
      creator_id: player.id,
      partner_id: activeMatchProfile.user_id,
      title: title.trim(),
      place: place.trim(),
      planned_for: null,
      emergency_contact: emergencyContact.trim() || null,
    });

    if (dateError) {
      setError(dateError.message || schemaHelp);
      return;
    }

    await sendMessage(`${chatDatePlanPrefix}${encodeChatPayload({ title: title.trim(), when: when?.trim() || "To be confirmed", place: place.trim(), note: emergencyContact.trim() ? "Safe-date check-in saved with emergency contact." : "Safe-date check-in reminder saved." })}`, false);
    setStatus(`Safe date plan created with ${activeMatchProfile.display_name}.`);
  };

  const suggestMeetupSpot = async () => {
    if (!activeMatchProfile) return;
    const location = activeMatchProfile.location_label || activeMatchProfile.city || "nearby";
    const mapsUrl = `https://www.google.com/maps/search/public+cafe+mall+well+lit+place+near+${encodeURIComponent(location)}`;
    await sendMessage(`${chatDatePlanPrefix}${encodeChatPayload({ title: "Suggested public meet-up spots", when: "Choose a safe time", place: location, note: mapsUrl })}`, false);
    setStatus("Suggested public meet-up spots shared in chat.");
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#0c0b10] text-white"><p className="text-2xl font-semibold">Opening partner finder...</p></main>;

  if (error && !player) {
    return (
      <main className="min-h-screen bg-[#0c0b10] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-rose-300/20 bg-black/50 p-8">
          <p className="text-sm uppercase tracking-[0.35em] text-rose-200">Partner Finder Error</p>
          <h1 className="mt-4 text-4xl font-black">Could not open the partner scene</h1>
          <p className="mt-4 text-lg text-stone-300">{error}</p>
          <button onClick={() => { window.location.href = "/"; }} className="mt-8 rounded-2xl bg-white px-5 py-3 font-semibold text-black">Back Home</button>
        </div>
      </main>
    );
  }

  if (!canUseDating) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#251724_0%,#0d0b10_45%,#020202_100%)] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-black/45 p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-200">Partner Finder Locked</p>
          <h1 className="mt-4 text-4xl font-black">You must be 18 or older</h1>
          <p className="mt-4 text-lg leading-8 text-stone-300">Find A Partner is only available for adult profiles.</p>
          <button onClick={() => { window.location.href = "/"; }} className="mt-8 rounded-2xl bg-white px-5 py-3 font-semibold text-black">Back Home</button>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen transition-colors ${
        activeMatch
          ? "overflow-hidden bg-[#050b14] text-white lg:flex lg:items-center lg:justify-center lg:p-6"
          : `px-3 pb-24 pt-16 sm:px-4 sm:pb-32 sm:pt-24 ${
              isLightMode
                ? "bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_34%,#ffffff_100%)] text-slate-950"
                : "bg-[linear-gradient(180deg,#17181d_0%,#111318_28%,#090a0f_100%)] text-white"
            }`
      }`}
    >
      {!activeMatch && !hasExploreOverlay ? (
        <>
          <button
            type="button"
            onClick={() => { window.location.href = "/"; }}
            className={`fixed left-4 top-4 z-[80] rounded-full px-5 py-3 text-sm font-semibold shadow-xl backdrop-blur transition ${
              isLightMode
                ? "border border-slate-200 bg-white/90 text-slate-950 hover:bg-white"
                : "border border-white/15 bg-black/75 text-white hover:bg-black/85"
            }`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => updateAppSettings({ appearance: isLightMode ? "dark" : "light" })}
            className={`fixed right-4 top-4 z-[80] rounded-full px-5 py-3 text-sm font-semibold shadow-xl backdrop-blur transition ${
              isLightMode ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-white text-slate-950 hover:bg-stone-100"
            }`}
          >
            {isLightMode ? "Dark" : "Light"}
          </button>
        </>
      ) : null}

      <div className={`mx-auto flex w-full flex-col ${activeMatch ? "h-dvh max-w-6xl gap-0 lg:h-[calc(100dvh-3rem)]" : "max-w-md gap-5 lg:max-w-5xl"}`}>
        {error ? <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

        {activeTab === "swipe" ? (
          <section className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,#1b1e24_0%,#101216_16%,#090a0f_100%)] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur">
            <div className="rounded-[1.7rem] border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.38em] text-white/45">Discover</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-white">Swipe</h2>
                  <p className="mt-1 text-sm text-white/58">Find your next real connection.</p>
                </div>
                <div className="rounded-full border border-emerald-300/30 bg-emerald-400/12 px-3 py-1.5 text-xs font-black text-emerald-100">
                  {visiblePartnerProfiles.length} active
                </div>
              </div>
            </div>
            <DiscoveryControls
              activeLounge={activeLounge}
              onLoungeChange={setActiveLounge}
              filtersOpen={filtersOpen}
              onToggleFilters={() => setFiltersOpen((current) => !current)}
              kidsFilter={kidsFilter}
              onKidsFilterChange={setKidsFilter}
              smokesFilter={smokesFilter}
              onSmokesFilterChange={setSmokesFilter}
              drinksFilter={drinksFilter}
              onDrinksFilterChange={setDrinksFilter}
              soberDatesOnly={soberDatesOnly}
              onSoberDatesOnlyChange={setSoberDatesOnly}
            />
            {currentProfile ? <SwipeCard profile={currentProfile} distanceLabel={distanceForProfile(currentProfile)} saving={saving} onPass={passProfile} onLike={() => void likeProfile()} onSuperLike={() => void likeProfile(true)} /> : <EmptySwipeState />}
          </section>
        ) : null}

        {activeTab === "explore" ? (
          <section className="rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-xl backdrop-blur">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Explore</p>
            <h2 className="mt-2 text-3xl font-bold">Find your people</h2>
            <DiscoveryControls
              activeLounge={activeLounge}
              onLoungeChange={setActiveLounge}
              filtersOpen={filtersOpen}
              onToggleFilters={() => setFiltersOpen((current) => !current)}
              kidsFilter={kidsFilter}
              onKidsFilterChange={setKidsFilter}
              smokesFilter={smokesFilter}
              onSmokesFilterChange={setSmokesFilter}
              drinksFilter={drinksFilter}
              onDrinksFilterChange={setDrinksFilter}
              soberDatesOnly={soberDatesOnly}
              onSoberDatesOnlyChange={setSoberDatesOnly}
            />
            {exploreSections.length ? (
              <div className="mt-5 space-y-6">
                {exploreSections.map((section) => (
                  <div key={section.title}>
                    <ExploreCategoryCard
                      title={section.title}
                      subtitle={section.subtitle}
                      countLabel={section.countLabel}
                      themeClass={section.themeClass}
                      featured={Boolean(section.featured)}
                      onOpen={() => openExploreSection(section.title)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <DefaultExploreEmpty />
            )}
            {activeExploreSection ? (
              <ExploreSectionSheet
                section={activeExploreSection}
                distanceForProfile={distanceForProfile}
                onClose={() => setSelectedExploreSectionTitle(null)}
                onOpenProfile={(profile) => openExploreProfile(profile)}
              />
            ) : null}
            {selectedExploreProfile ? (
              <ExploreProfileSheet
                profile={selectedExploreProfile}
                distanceLabel={distanceForProfile(selectedExploreProfile)}
                matched={Boolean(matchForProfile(selectedExploreProfile))}
                liked={likedIds.includes(selectedExploreProfile.user_id)}
                saving={saving}
                vouchCount={vouchCounts[selectedExploreProfile.user_id] || 0}
                positionLabel={activeExploreSection?.profiles.length && selectedExploreIndex >= 0 ? `${selectedExploreIndex + 1}/${activeExploreSection.profiles.length}` : ""}
                onClose={() => setSelectedExploreProfile(null)}
                onLike={() => void likeSpecificProfile(selectedExploreProfile)}
                onOpenChat={() => openProfileChatFromExplore(selectedExploreProfile)}
                onPrevious={showPreviousExploreProfile}
                onNext={showNextExploreProfile}
              />
            ) : null}
          </section>
        ) : null}

        {activeTab === "likes" ? (
          <section className="rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-xl backdrop-blur">
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Likes</p>
            <h2 className="mt-2 text-3xl font-bold">Your activity</h2>
            <div className="mt-5 grid gap-3">
              <StatBox label="Matches" value={visibleMatches.length} />
              <StatBox label="People who liked you" value={likedMeIds.length} />
              <StatBox label="People you liked" value={likedIds.length} />
            </div>
            <div className="mt-6 space-y-3">{visibleMatches.map((match) => {
              const profile = profileMap[match.user_a === player?.id ? match.user_b : match.user_a];
              return <MatchRowButton key={match.id} match={match} playerId={player?.id || ""} profile={profile} distanceLabel={distanceForProfile(profile)} onOpen={() => openMatchChat(match)} />;
            })}</div>
          </section>
        ) : null}

        {activeTab === "chat" ? (
          <section className={activeMatch ? "fixed inset-0 z-[90] h-dvh overflow-hidden bg-[#050b14] text-white lg:flex lg:items-center lg:justify-center lg:p-6" : "rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-xl backdrop-blur"}>
            {!activeMatch ? (
              <>
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">Inbox</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <h2 className="text-3xl font-bold">Chats</h2>
                  {totalUnreadCount ? <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">{totalUnreadCount} unread</span> : null}
                </div>
              </>
            ) : null}

            {activeMatch && activeMatchProfile ? (
                <ChatPanel
                activeMatchProfile={activeMatchProfile}
                activeMessages={activeMessages}
                activePlayerId={player?.id || ""}
                chatDraft={chatDraft}
                setChatDraft={setChatDraft}
                saving={saving}
                onSend={(body, clearDraft) => void sendMessage(body, clearDraft)}
                onQuickSend={(body) => void sendMessage(body)}
                onCommit={() => void makeItOfficial()}
                officialButtonLabel={officialButtonLabel}
                onBack={() => {
                  setActiveMatchId("");
                setChatDraft("");
                }}
                presence={presenceMap[activeMatchProfile.user_id]}
                distanceLabel={distanceForProfile(activeMatchProfile)}
                safetySettings={safetySettings}
                userControls={activeMatchControls}
                isTyping={Boolean(typingByMatch[activeMatch.id])}
                onImageSend={(file) => void sendChatImage(file)}
                onAttachmentSend={(file, kind) => void sendChatAttachment(file, kind)}
                onVoiceSend={(blob) => void sendVoiceNote(blob)}
                onStartCall={(kind) => void startCall(kind)}
                onPlanSafeDate={() => void planSafeDate()}
                onSuggestMeetupSpot={() => void suggestMeetupSpot()}
                onVouch={() => void vouchForMatch()}
                vouchCount={vouchCounts[activeMatchProfile.user_id] || 0}
                hasVouched={vouchedIds.includes(activeMatchProfile.user_id)}
                onToggleMute={() => updateUserControls(activeMatchProfile.user_id, { muted: !activeMatchControls.muted })}
                onToggleFavourite={() => updateUserControls(activeMatchProfile.user_id, { favourite: !activeMatchControls.favourite })}
                onToggleListed={() => updateUserControls(activeMatchProfile.user_id, { listed: !activeMatchControls.listed })}
                onToggleDisappearing={() => updateUserControls(activeMatchProfile.user_id, { disappearingMessages: !activeMatchControls.disappearingMessages })}
                onClearChat={() => updateUserControls(activeMatchProfile.user_id, { chatClearedAt: new Date().toISOString(), deletedChat: false })}
                onCloseChat={() => {
                  updateUserControls(activeMatchProfile.user_id, { closed: true });
                  setActiveMatchId("");
                }}
                onDeleteChat={() => {
                  updateUserControls(activeMatchProfile.user_id, { deletedChat: true, chatClearedAt: new Date().toISOString() });
                  setActiveMatchId("");
                }}
                onBlock={() => {
                  void saveBlockControl(activeMatchProfile.user_id, !activeMatchControls.blocked);
                }}
                onReport={() => {
                  const reportNote = window.prompt("Describe what happened. This report is saved on this device for now.");
                  if (reportNote === null) return;
                  void saveReportControl(activeMatchProfile.user_id, reportNote.trim());
                }}
              />
            ) : chatMatches.length ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-white/65">
                  Active chats: {activeChatMatches.length}/{activeChatLimit}. Close a chat to make room for a new one.
                </div>
                {chatMatches.filter((match) => {
                  const partnerId = match.user_a === player?.id ? match.user_b : match.user_a;
                  return !userControls[partnerId]?.deletedChat && !userControls[partnerId]?.unmatched;
                }).map((match) => {
                  const profile = profileMap[match.user_a === player?.id ? match.user_b : match.user_a];
                  const partnerId = match.user_a === player?.id ? match.user_b : match.user_a;
                  return (
                    <ChatListButton
                      key={match.id}
                      match={match}
                      profile={profile}
                      distanceLabel={distanceForProfile(profile)}
                      unreadCount={unreadCounts[match.id] || 0}
                      presence={profile ? presenceMap[profile.user_id] : undefined}
                      blocked={Boolean(userControls[partnerId]?.blocked)}
                      blockedBy={Boolean(userControls[partnerId]?.blockedBy)}
                      onOpen={() => openMatchChat(match)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[1.8rem] border border-white/10 bg-white/5 p-5 text-sm text-white/70">Your mutual matches will appear here. Once you both like each other, you can chat in this inbox.</div>
            )}
          </section>
        ) : null}

        {activeTab === "profile" ? (
          <section className="rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-xl backdrop-blur">
            <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(2,6,23,0.72))] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.28)]">
              <div className="flex items-center gap-3">
                <GameLogo className="h-12 w-12" />
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-sky-200/60">Partner Finder</p>
                  <h1 className="text-4xl font-black tracking-tight">Relationship Profile</h1>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/80">
                <span className="rounded-full bg-white/10 px-3 py-2">Age {player?.age ?? 18}</span>
                <span className="rounded-full bg-white/10 px-3 py-2">{isProfileVerified(profileMap[player?.id || ""]) ? "Verified profile" : "Verification pending"}</span>
                <span className="rounded-full bg-white/10 px-3 py-2">{visibleMatches.length} Match{visibleMatches.length === 1 ? "" : "es"}</span>
                {officialPartnerLabel(profileMap[player?.id || ""]) ? <span className="rounded-full bg-emerald-400/15 px-3 py-2 text-emerald-100">{officialPartnerLabel(profileMap[player?.id || ""])}</span> : null}
              </div>
              <p className="mt-4 text-sm leading-7 text-white/70">{status}</p>
            </div>
            <p className="mt-5 text-sm uppercase tracking-[0.3em] text-white/50">Profile</p>
            <h2 className="mt-2 text-3xl font-bold">Your dating profile</h2>
            <OwnProfileCard profile={profileMap[player?.id || ""]} fallbackName={player?.name || "Player"} fallbackAge={player?.age || 18} fallbackCountry={player?.country || "Unknown"} />
            <div className="mt-5 grid gap-3">
              <button onClick={() => { window.location.href = "/setup"; }} className="w-full rounded-full bg-white px-5 py-4 font-semibold text-stone-950">Edit Profile</button>
              <button onClick={() => void logout()} disabled={saving} className="w-full rounded-full border border-rose-300/30 bg-rose-500/10 px-5 py-4 font-semibold text-rose-100 disabled:opacity-60">
                Logout
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowProfileSettings(true)}
              className="mt-5 flex w-full items-center justify-between gap-3 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-4 py-4 text-left shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
              aria-expanded={showProfileSettings}
            >
              <span>
                <span className="block text-sm uppercase tracking-[0.28em] text-white/45">Settings</span>
                <span className="mt-1 block text-base font-black text-white">Discovery, privacy, and app controls</span>
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white">
                &gt;
              </span>
            </button>
          </section>
        ) : null}
      </div>

      {callState ? (
        <CallOverlay
          callState={callState}
          callDurationSeconds={callDurationSeconds}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localCallStream}
          remoteStream={remoteCallStream}
          onAccept={() => void acceptCall()}
          onReject={rejectCall}
          onEnd={() => endCall(true)}
        />
      ) : null}

      {!activeMatch && !hasExploreOverlay ? <nav className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-w-md items-center justify-between rounded-t-[2rem] border border-white/10 bg-[#0b0d11]/96 px-4 py-3 text-xs text-white/65 shadow-[0_-18px_45px_rgba(0,0,0,0.45)] backdrop-blur">
        {[
          { id: "swipe", label: "Swipe", icon: "S" },
          { id: "explore", label: "Explore", icon: "E" },
          { id: "likes", label: "Likes", icon: "L" },
          { id: "chat", label: "Chat", icon: "C" },
          { id: "profile", label: "Profile", icon: "P" },
        ].map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id as AppTab)} className="flex min-w-[3.8rem] flex-col items-center gap-1 rounded-2xl px-2 py-1.5">
            <span className={`relative flex h-12 w-12 items-center justify-center rounded-full border text-sm font-black shadow-lg transition ${
              activeTab === item.id
                ? item.id === "swipe"
                  ? "border-white/10 bg-white text-slate-950"
                  : item.id === "likes"
                    ? "border-amber-300/20 bg-amber-400 text-slate-950"
                    : item.id === "chat"
                      ? "border-pink-300/20 bg-pink-500 text-white"
                      : item.id === "profile"
                        ? "border-white/10 bg-[#181b20] text-white"
                        : "border-blue-300/20 bg-sky-500 text-white"
                : "border-white/10 bg-[#17191f] text-white/76"
            }`}>
              {item.icon}
              {item.id === "chat" && totalUnreadCount ? (
                <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-rose-500 px-1 text-[10px] font-black leading-5 text-white">
                  {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                </span>
              ) : null}
            </span>
            <span className={activeTab === item.id ? "text-white" : "text-white/52"}>{item.label}</span>
          </button>
        ))}
      </nav> : null}

      {matchCelebrationProfile ? (
        <MatchCelebration
          ownProfile={profileMap[player?.id || ""]}
          profile={matchCelebrationProfile}
          distanceLabel={distanceForProfile(matchCelebrationProfile)}
          onKeepSwiping={() => setMatchCelebrationProfile(null)}
          onOpenChat={(draft) => {
            setMatchCelebrationProfile(null);
            const match = matchForProfile(matchCelebrationProfile);
            if (match) {
              openMatchChat(match);
              setChatDraft(draft);
            } else {
              setActiveTab("chat");
              setChatDraft(draft);
            }
          }}
        />
      ) : null}
      {showProfileSettings ? (
        <PartnerSettingsSheet
          profile={profileMap[player?.id || ""]}
          safetySettings={safetySettings}
          appSettings={appSettings}
          onClose={() => setShowProfileSettings(false)}
          onSafetyChange={updateSafetySettings}
          onAppSettingsChange={updateAppSettings}
          onEditProfile={() => { window.location.href = "/setup"; }}
          onRequestPermissions={() => {
            void requestNotificationPermission();
            setStatus("Notification permission request opened.");
          }}
          onAction={(message) => setStatus(message)}
          onLogout={() => void logout()}
        />
      ) : null}
    </main>
  );
}
function MatchCelebration({
  ownProfile,
  profile,
  distanceLabel,
  onKeepSwiping,
  onOpenChat,
}: {
  ownProfile?: DatingProfile;
  profile: DatingProfile;
  distanceLabel: string | null;
  onKeepSwiping: () => void;
  onOpenChat: (draft: string) => void;
}) {
  const [introDraft, setIntroDraft] = useState("");
  const hearts = [
    { left: "8%", top: "14%", size: "1.8rem", delay: "0s", duration: "6.5s", color: "#ff4d6d" },
    { left: "18%", top: "72%", size: "1.25rem", delay: "0.6s", duration: "7.2s", color: "#ff758f" },
    { left: "27%", top: "26%", size: "1.4rem", delay: "1.1s", duration: "6.9s", color: "#ff5c8a" },
    { left: "39%", top: "84%", size: "1.9rem", delay: "1.8s", duration: "7.8s", color: "#ff8fab" },
    { left: "54%", top: "18%", size: "1.15rem", delay: "2.2s", duration: "6.3s", color: "#ff477e" },
    { left: "62%", top: "68%", size: "1.6rem", delay: "0.9s", duration: "7.4s", color: "#ff6b9a" },
    { left: "74%", top: "34%", size: "1.95rem", delay: "1.5s", duration: "8.1s", color: "#ff4f87" },
    { left: "86%", top: "79%", size: "1.3rem", delay: "2.8s", duration: "7s", color: "#ffa3c4" },
    { left: "91%", top: "11%", size: "1.7rem", delay: "0.4s", duration: "6.7s", color: "#ff5d8f" },
  ];
  const quickReactions = ["Hi", "Cute", "Love", "Wow"];

  return (
    <div className="fixed inset-0 z-[95] overflow-hidden bg-[radial-gradient(circle_at_top,#26c766_0%,#10ad55_24%,#0a7a39_54%,#04421f_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.14),transparent_24%),radial-gradient(circle_at_24%_80%,rgba(255,255,255,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_28%,rgba(0,0,0,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[4.8rem] flex justify-center">
        <div className="match-heart-stack match-heart-stack-lg" />
      </div>
      {hearts.map((heart, index) => (
        <span
          key={`${heart.left}-${heart.top}-${index}`}
          className="match-floating-heart pointer-events-none"
          style={{
            left: heart.left,
            top: heart.top,
            fontSize: heart.size,
            color: heart.color,
            animationDelay: heart.delay,
            animationDuration: heart.duration,
          }}
        >
          &#10084;
        </span>
      ))}

      <div className="relative flex min-h-screen flex-col px-4 pb-8 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onKeepSwiping}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/18 bg-black/10 text-3xl font-light text-white backdrop-blur"
            aria-label="Close match celebration"
          >
            x
          </button>
          <div className="rounded-full border border-white/18 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-white/85 backdrop-blur">
            New match
          </div>
        </div>

        <div className="relative mx-auto mt-10 flex w-full max-w-md flex-1 flex-col">
          <div className="relative mx-auto h-64 w-full max-w-[19rem]">
            <div className="absolute left-0 top-6 h-40 w-40 overflow-hidden rounded-full border-[5px] border-white bg-white shadow-[0_20px_45px_rgba(0,0,0,0.34)]">
              {ownProfile?.photo_url ? (
                <img src={ownProfile.photo_url} alt={ownProfile.display_name || "Your profile"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/18 text-sm font-bold text-white/82">You</div>
              )}
            </div>
            <div className="absolute right-0 top-6 h-40 w-40 overflow-hidden rounded-full border-[5px] border-white bg-white shadow-[0_20px_45px_rgba(0,0,0,0.34)]">
              {profile.photo_url ? (
                <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/18 text-sm font-bold text-white/82">Match</div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 text-center">
              <p className="text-lg font-black uppercase italic tracking-tight text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]">Its a</p>
              <h2 className="text-[clamp(4rem,18vw,5.6rem)] font-black italic leading-[0.88] tracking-[-0.08em] text-white [text-shadow:0_8px_0_rgba(0,0,0,0.55)]">
                Match
              </h2>
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xl font-bold text-white/96">You matched with {profile.display_name}</p>
            <p className="mt-2 text-sm text-white/78">
              {profile.location_label || profile.city}
              {distanceLabel ? ` - ${distanceLabel}` : ""}
            </p>
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-white/12 bg-[#12151c]/82 p-2 shadow-[0_22px_45px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="flex items-center gap-3 rounded-[1.1rem] bg-black/25 px-3 py-3">
              <input
                value={introDraft}
                onChange={(event) => setIntroDraft(event.target.value)}
                placeholder="Say something nice"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/40"
              />
              <button
                type="button"
                onClick={() => onOpenChat(introDraft.trim())}
                className="rounded-full px-3 py-2 text-sm font-black text-white/82 transition hover:text-white"
              >
                Send
              </button>
            </div>
          </div>

          <div className="mt-auto pt-8">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {quickReactions.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  onClick={() => onOpenChat(reaction)}
                  className="min-w-[5.25rem] rounded-full border border-white/24 bg-black/16 px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(0,0,0,0.2)] backdrop-blur"
                >
                  {reaction}
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => onOpenChat(introDraft.trim())} className="rounded-full bg-white px-5 py-4 font-black text-slate-950 shadow-xl transition hover:bg-stone-100">
                Start chat
              </button>
              <button onClick={onKeepSwiping} className="rounded-full border border-white/24 bg-black/16 px-5 py-4 font-black text-white backdrop-blur transition hover:bg-black/22">
                Keep swiping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SwipeCard({
  profile,
  distanceLabel,
  saving,
  onPass,
  onLike,
  onSuperLike,
}: {
  profile: DatingProfile;
  distanceLabel: string | null;
  saving: boolean;
  onPass: () => void;
  onLike: () => void;
  onSuperLike: () => void;
}) {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const swipeThreshold = 78;
  const firstInterest = profile.interests?.[0] || profile.relationship_goal || "Open to meeting someone genuine";
  const secondInterest = profile.interests?.[1] || "Looking for real chemistry";

  const finishSwipe = () => {
    if (!saving && Math.abs(dragOffsetX) > swipeThreshold) {
      onPass();
    }

    setDragStartX(null);
    setDragOffsetX(0);
  };

  return (
    <div
      className="mt-4 touch-pan-y"
      style={{
        transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX / 28}deg)`, 
        transition: dragStartX === null ? "transform 180ms ease" : "none",
      }}
      onPointerDown={(event) => {
        if (saving) return;
        setDragStartX(event.clientX);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragStartX === null || saving) return;
        setDragOffsetX(Math.max(-130, Math.min(130, event.clientX - dragStartX)));
      }}
      onPointerUp={finishSwipe}
      onPointerCancel={() => {
        setDragStartX(null);
        setDragOffsetX(0);
      }}
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-[#111318] shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
        {dragOffsetX > 24 ? <div className="absolute left-4 top-4 z-20 rotate-[-9deg] rounded-xl border-2 border-emerald-300 bg-emerald-400/15 px-3 py-2 text-sm font-black uppercase text-emerald-100">Like</div> : null}
        {dragOffsetX < -24 ? <div className="absolute right-4 top-4 z-20 rotate-[9deg] rounded-xl border-2 border-rose-300 bg-rose-400/15 px-3 py-2 text-sm font-black uppercase text-rose-100">Pass</div> : null}
        <div className="relative h-[min(65vh,37rem)] min-h-[32rem]">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover object-center" draggable={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#1a1d24] text-center text-white/55">
              <div>
                <p className="text-sm uppercase tracking-[0.3em]">No Photo</p>
                <p className="mt-3 text-lg">This user still needs to upload a dating photo.</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.2)_42%,rgba(0,0,0,0.82)_100%)]" />
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="rounded-full bg-[#eaf8ea] px-3 py-1 text-xs font-black text-emerald-800">Recently Active</span>
            {isProfileVerified(profile) ? <span className="rounded-full bg-sky-500 px-2.5 py-1 text-[11px] font-black text-white">Verified</span> : null}
          </div>
          <button type="button" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-black/30 text-lg text-white backdrop-blur">
            ^
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[clamp(2rem,8vw,3rem)] font-black leading-none text-white">
                    {profile.display_name} {profile.age}
                  </h3>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-sm font-black text-white">+</span>
                </div>
                <p className="mt-3 text-base font-medium text-white/88">{profile.bio}</p>
                <div className="mt-3 space-y-2 text-sm text-white/88">
                  <p>{profile.location_label || profile.city}</p>
                  {distanceLabel ? <p>{distanceLabel}</p> : null}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[firstInterest, secondInterest].filter(Boolean).map((interest) => (
                <span key={interest} className="rounded-full border border-white/16 bg-black/26 px-3 py-2 text-xs font-semibold text-white/88 backdrop-blur">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 px-4 py-4">
          <button onClick={onPass} className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-[#22252c] text-xl font-black text-amber-400 shadow-xl">
            O
          </button>
          <button onClick={onPass} className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-[#22252c] text-3xl font-black text-pink-500 shadow-xl">
            X
          </button>
          <button onClick={onSuperLike} disabled={saving} className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-[#22252c] text-3xl font-black text-sky-400 shadow-xl disabled:opacity-60">
            *
          </button>
          <button onClick={onLike} disabled={saving} className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-[#c7f464] text-3xl font-black text-emerald-950 shadow-xl disabled:opacity-60">
            H
          </button>
          <button onClick={onSuperLike} disabled={saving} className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-[#22252c] text-3xl font-black text-sky-500 shadow-xl disabled:opacity-60">
            Go
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptySwipeState() {
  return <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-6"><p className="text-sm uppercase tracking-[0.3em] text-white/50">No More Profiles</p><h3 className="mt-3 text-2xl font-bold">The deck is empty right now</h3><p className="mt-3 text-sm leading-7 text-white/75">As more real players create verified profiles, they will appear here under Swipe.</p></div>;
}

function DiscoveryControls({
  activeLounge,
  onLoungeChange,
  filtersOpen,
  onToggleFilters,
  kidsFilter,
  onKidsFilterChange,
  smokesFilter,
  onSmokesFilterChange,
  drinksFilter,
  onDrinksFilterChange,
  soberDatesOnly,
  onSoberDatesOnlyChange,
}: {
  activeLounge: string;
  onLoungeChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  kidsFilter: string;
  onKidsFilterChange: (value: string) => void;
  smokesFilter: string;
  onSmokesFilterChange: (value: string) => void;
  drinksFilter: string;
  onDrinksFilterChange: (value: string) => void;
  soberDatesOnly: boolean;
  onSoberDatesOnlyChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {intentLounges.map((lounge) => (
          <button key={lounge} type="button" onClick={() => onLoungeChange(lounge)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${activeLounge === lounge ? "bg-sky-400 text-slate-950" : "bg-white/10 text-white/75"}`}>
            {lounge}
          </button>
        ))}
      </div>
      <button type="button" onClick={onToggleFilters} className="mt-3 w-full rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white">
        {filtersOpen ? "Hide filters" : "Meaningful filters"}
      </button>
      {filtersOpen ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select value={kidsFilter} onChange={(event) => onKidsFilterChange(event.target.value)} className="rounded-2xl bg-[#101827] px-3 py-3 text-sm font-semibold text-white outline-none">
            {kidsFilters.map((value) => <option key={value} value={value}>Wants kids: {value}</option>)}
          </select>
          <select value={smokesFilter} onChange={(event) => onSmokesFilterChange(event.target.value)} className="rounded-2xl bg-[#101827] px-3 py-3 text-sm font-semibold text-white outline-none">
            {habitFilters.map((value) => <option key={value} value={value}>Smokes: {value}</option>)}
          </select>
          <select value={drinksFilter} onChange={(event) => onDrinksFilterChange(event.target.value)} className="rounded-2xl bg-[#101827] px-3 py-3 text-sm font-semibold text-white outline-none">
            {habitFilters.map((value) => <option key={value} value={value}>Drinks: {value}</option>)}
          </select>
          <label className="flex items-center gap-3 rounded-2xl bg-[#101827] px-3 py-3 text-sm font-semibold text-white">
            <input type="checkbox" checked={soberDatesOnly} onChange={(event) => onSoberDatesOnlyChange(event.target.checked)} />
            <span>Sober first dates</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function DefaultExploreEmpty() {
  return (
    <>
      <div className="col-span-2 min-h-44 rounded-[1.8rem] bg-gradient-to-br from-rose-500/80 to-orange-400/80 p-4"><h3 className="mt-16 text-3xl font-black">Serious Daters</h3><p className="mt-2 text-sm text-white/85">As soon as players complete real profiles, categories will fill up here.</p></div>
      <div className="min-h-36 rounded-[1.8rem] bg-gradient-to-br from-fuchsia-700/80 to-purple-500/80 p-4"><h3 className="mt-10 text-2xl font-black">Long-term</h3></div>
      <div className="min-h-36 rounded-[1.8rem] bg-gradient-to-br from-amber-400/80 to-yellow-500/80 p-4"><h3 className="mt-10 text-2xl font-black">Short-term</h3></div>
    </>
  );
}

function ExploreCategoryCard({
  title,
  subtitle,
  countLabel,
  themeClass,
  featured,
  onOpen,
}: {
  title: string;
  subtitle: string;
  countLabel: string;
  themeClass: string;
  featured: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative w-full overflow-hidden rounded-[1.8rem] border border-white/10 text-left shadow-[0_18px_55px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:border-white/20 ${featured ? "min-h-[15rem]" : "min-h-[12rem]"}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${themeClass}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.12),transparent_24%),linear-gradient(135deg,transparent_0%,rgba(0,0,0,0.12)_42%,rgba(0,0,0,0.45)_100%)]" />
      <div className="absolute -bottom-8 left-5 h-24 w-24 rounded-full border border-white/12 bg-white/8 blur-[1px]" />
      <div className="absolute -right-6 top-8 h-20 w-20 rounded-full border border-white/10 bg-black/10" />
      <div className={`relative flex h-full flex-col justify-between p-4 ${featured ? "min-h-[15rem]" : "min-h-[12rem]"}`}>
        <div className="flex justify-end">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-black text-white">{countLabel}</span>
        </div>
        <div>
          <h3 className={`max-w-[12rem] font-black leading-tight text-white ${featured ? "text-[2rem]" : "text-[1.9rem]"}`}>{title}</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/88">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

function ExploreSectionSheet({
  section,
  distanceForProfile,
  onClose,
  onOpenProfile,
}: {
  section: ExploreSection;
  distanceForProfile: (profile?: DatingProfile | null) => string | null;
  onClose: () => void;
  onOpenProfile: (profile: DatingProfile) => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] bg-black/82 backdrop-blur sm:flex sm:items-center sm:justify-center sm:p-6">
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#111318] shadow-[0_32px_100px_rgba(0,0,0,0.55)] sm:h-auto sm:max-h-[46rem] sm:max-w-2xl sm:rounded-[2rem] sm:border sm:border-white/10">
        <div className={`bg-gradient-to-br ${section.themeClass} px-4 pb-4 pt-3 sm:p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-white/65">Explore</p>
              <h3 className="mt-1 text-[2.1rem] font-black leading-[0.95] text-white sm:text-3xl">{section.title}</h3>
              <p className="mt-2 max-w-[15rem] text-sm leading-6 text-white/82">{section.subtitle}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-black/35 px-4 py-2 text-sm font-black text-white">
              Back
            </button>
          </div>
          <p className="mt-3 inline-flex rounded-full bg-black/35 px-3 py-1 text-xs font-black text-white">{section.countLabel}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-2 sm:p-4">
          <div className="grid gap-2.5">
            {section.profiles.map((profile) => (
              <button
                key={profile.user_id}
                type="button"
                onClick={() => onOpenProfile(profile)}
                className="flex w-full items-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
              >
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/10">
                  {profile.photo_url ? <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h4 className="truncate text-lg font-bold text-white">{profile.display_name}, {profile.age}</h4>
                    {isProfileVerified(profile) ? <span className="shrink-0 rounded-full bg-sky-400 px-2 py-1 text-[10px] font-bold text-slate-950">Verified</span> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-white/65">{fullProfileLocation(profile)}{distanceForProfile(profile) ? ` - ${distanceForProfile(profile)}` : ""}</p>
                  <p className="mt-1 truncate text-sm text-white/65">{profile.relationship_goal || "Still figuring it out"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExploreProfileSheet({
  profile,
  distanceLabel,
  matched,
  liked,
  saving,
  vouchCount,
  positionLabel,
  onClose,
  onLike,
  onOpenChat,
  onPrevious,
  onNext,
}: {
  profile: DatingProfile;
  distanceLabel: string | null;
  matched: boolean;
  liked: boolean;
  saving: boolean;
  vouchCount: number;
  positionLabel: string;
  onClose: () => void;
  onLike: () => void;
  onOpenChat: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const partnerLabel = officialPartnerLabel(profile);
  const locationChip = [fullProfileLocation(profile), distanceLabel].filter(Boolean).join("  ");
  const detailChips = [
    locationChip,
    profile.wants_kids ? `Kids: ${profile.wants_kids}` : null,
    profile.smokes ? `Smokes: ${profile.smokes}` : null,
    profile.drinks ? `Drinks: ${profile.drinks}` : null,
    profile.sober_dates ? "Sober dates" : null,
    `Trust points: ${vouchCount}`,
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[115] bg-black/84 backdrop-blur sm:flex sm:items-center sm:justify-center sm:p-6">
      <div
        className="flex h-dvh w-full flex-col overflow-hidden bg-[#111318] shadow-[0_32px_100px_rgba(0,0,0,0.55)] sm:h-auto sm:max-h-[46rem] sm:max-w-xl sm:rounded-[2rem] sm:border sm:border-white/10"
        onPointerDown={(event) => setDragStartX(event.clientX)}
        onPointerUp={(event) => {
          if (dragStartX === null) return;
          const delta = event.clientX - dragStartX;
          if (delta > 50) onPrevious();
          if (delta < -50) onNext();
          setDragStartX(null);
        }}
        onPointerCancel={() => setDragStartX(null)}
      >
        <div className="relative h-52 shrink-0 bg-[#171a20] sm:h-72">
          {profile.photo_url ? <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111318] via-[#111318]/18 to-transparent" />
          <button type="button" onClick={onClose} className="absolute left-4 top-4 rounded-full bg-black/55 px-4 py-2 text-sm font-black text-white backdrop-blur">
            Back
          </button>
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {positionLabel ? <span className="rounded-full bg-black/55 px-3 py-2 text-xs font-black text-white/85">{positionLabel}</span> : null}
          </div>
          <button type="button" onClick={onPrevious} className="absolute right-14 top-[5.1rem] flex h-9 w-9 items-center justify-center rounded-full bg-black/48 text-xl font-black text-white backdrop-blur">
            ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹
          </button>
          <button type="button" onClick={onNext} className="absolute right-4 top-[5.1rem] flex h-9 w-9 items-center justify-center rounded-full bg-black/48 text-xl font-black text-white backdrop-blur">
            ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº
          </button>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-black text-white/85">{profile.intent_lounge || "Explore"}</span>
              {isProfileVerified(profile) ? <span className="rounded-full bg-sky-400 px-3 py-1 text-[11px] font-black text-slate-950">Verified</span> : null}
              {partnerLabel ? <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-black text-emerald-100">{partnerLabel}</span> : null}
            </div>
            <h3 className="mt-3 max-w-[85%] text-[2.2rem] font-black leading-[0.92] text-white sm:text-4xl">{profile.display_name}, {profile.age}</h3>
            <p className="mt-2 text-base text-white/82">{profile.relationship_goal || "Open to seeing where this goes."}</p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {detailChips.map((chip) => (
              <span key={chip} className="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold text-white/76">{chip}</span>
            ))}
          </div>
          <p className="mt-4 text-[15px] leading-6 text-white/80">{profile.bio}</p>
          {profile.interests?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.interests.slice(0, 8).map((interest) => (
                <span key={interest} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/72">{interest}</span>
              ))}
            </div>
          ) : null}
          <div className="mt-auto grid gap-3 pt-5">
            <button
              type="button"
              onClick={matched ? onOpenChat : onLike}
              disabled={saving || liked || Boolean(partnerLabel && !matched)}
              className="rounded-full bg-blue-600 px-5 py-4 text-sm font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {matched ? "Open Chat" : liked ? "Liked" : "Like Profile"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/12 bg-white/5 px-5 py-4 text-sm font-black text-white transition hover:bg-white/10"
            >
              Keep Exploring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-4"><p className="text-sm uppercase tracking-[0.25em] text-white/50">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}

function PartnerSettingsSheet({
  profile,
  safetySettings,
  appSettings,
  onClose,
  onSafetyChange,
  onAppSettingsChange,
  onEditProfile,
  onRequestPermissions,
  onAction,
  onLogout,
}: {
  profile?: DatingProfile;
  safetySettings: PartnerSafetySettings;
  appSettings: PartnerAppSettings;
  onClose: () => void;
  onSafetyChange: (changes: Partial<PartnerSafetySettings>) => void;
  onAppSettingsChange: (changes: Partial<PartnerAppSettings>) => void;
  onEditProfile: () => void;
  onRequestPermissions: () => void;
  onAction: (message: string) => void;
  onLogout: () => void;
}) {
  const preferenceChoices = ["Music", "Gym", "Travel", "Cooking", "Business", "Faith", "Gaming", "Movies"];
  const locationLabel = profile?.location_label || profile?.city || appSettings.locationName;
  const toggleInterest = (value: string) => {
    const next = appSettings.interestsSelection.includes(value)
      ? appSettings.interestsSelection.filter((item) => item !== value)
      : [...appSettings.interestsSelection, value];
    onAppSettingsChange({ interestsSelection: next });
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/86 backdrop-blur">
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-[#0b0c10] text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-4">
          <button type="button" onClick={onClose} className="text-2xl font-light text-rose-400">x</button>
          <div>
            <p className="text-sm font-semibold text-white/65">Settings</p>
            <h2 className="text-xl font-black">Profile & Discovery</h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-4">
          <div className="space-y-4">
            <div className="grid gap-3">
              {[
                { tier: "platinum" as const, title: "tinder platinum", subtitle: "Priority Likes, See who likes you & more", accent: "text-stone-100" },
                { tier: "gold" as const, title: "tinder gold", subtitle: "See who likes you & more", accent: "text-amber-300" },
                { tier: "plus" as const, title: "tinder+", subtitle: "Unlimited Likes & more", accent: "text-rose-400" },
              ].map((tier) => (
                <button
                  key={tier.tier}
                  type="button"
                  onClick={() => {
                    onAppSettingsChange({ premiumTier: tier.tier });
                    onAction(`${tier.title} selected. Premium preview updated.`);
                  }}
                  className={`rounded-[1.8rem] border px-4 py-5 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)] transition ${
                    appSettings.premiumTier === tier.tier ? "border-amber-300/45 bg-[#17191f]" : "border-white/8 bg-[#121419]"
                  }`}
                >
                  <p className={`text-[2rem] font-black leading-none ${tier.accent}`}>{tier.title}</p>
                  <p className="mt-2 text-sm text-white/72">{tier.subtitle}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FeaturePromoCard title="Get Super Likes" accent="text-sky-400" active={appSettings.premiumTier === "platinum"} onClick={() => onAction("Super Likes are ready for premium profiles.")} />
              <FeaturePromoCard title="Get Boosts" accent="text-violet-400" active={appSettings.premiumTier !== "plus"} onClick={() => onAction("Boost controls are available in your premium center.")} />
              <FeaturePromoCard title="Go Incognito" accent="text-white/82" active={appSettings.visibilityMode === "incognito"} onClick={() => onAppSettingsChange({ visibilityMode: "incognito" })} />
              <FeaturePromoCard title="Passport Mode" accent="text-rose-400" active={appSettings.globalMode} onClick={() => onAppSettingsChange({ globalMode: !appSettings.globalMode })} />
            </div>

            <SettingsSection title="Account Settings">
              <InfoRow label="Phone Number" value={appSettings.phoneNumber} onClick={() => onAction("Phone number controls are available from account security.")} />
              <p className="px-1 pb-1 text-xs leading-5 text-white/48">Verify a phone number to help secure your account.</p>
            </SettingsSection>

            <SettingsSection title="Discovery Settings">
              <div className="rounded-[1.8rem] bg-[#15171d] p-4">
                <p className="text-sm font-bold">Location</p>
                <p className="mt-3 text-lg font-semibold text-white/90">{locationLabel}</p>
                <button
                  type="button"
                  onClick={() => {
                    const nextLocation = appSettings.globalMode ? "Cape Town, South Africa" : "Johannesburg, South Africa";
                    onAppSettingsChange({ locationName: nextLocation, globalMode: !appSettings.globalMode });
                    onAction(`Location updated to ${nextLocation}.`);
                  }}
                  className="mt-3 text-sm font-black text-rose-400"
                >
                  Add a new location
                </button>
              </div>
              <ToggleRow label="Global" description="Going global will allow you to see people nearby and from around the world." checked={appSettings.globalMode} onChange={(value) => onAppSettingsChange({ globalMode: value })} />
              <RangeCard
                title="Maximum Distance"
                valueLabel={`${appSettings.distanceUnit === "km" ? appSettings.maxDistanceKm : Math.round(appSettings.maxDistanceKm * 0.621371)}${appSettings.distanceUnit}.`}
                min={2}
                max={120}
                value={appSettings.maxDistanceKm}
                onChange={(value) => onAppSettingsChange({ maxDistanceKm: value })}
              >
                <ToggleRow label="Show people further away if I run out of profiles to see" checked={appSettings.allowOutsideRange} onChange={(value) => onAppSettingsChange({ allowOutsideRange: value })} compact />
              </RangeCard>
              <InfoRow label="Interested In" value={appSettings.interestedIn} onClick={() => onAppSettingsChange({ interestedIn: appSettings.interestedIn === "Women" ? "Men" : appSettings.interestedIn === "Men" ? "Everyone" : "Women" })} />
              <div className="rounded-[1.8rem] bg-[#15171d] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">Age Range</p>
                  <p className="text-lg text-white/70">{appSettings.ageMin} - {appSettings.ageMax}</p>
                </div>
                <div className="mt-4 grid gap-3">
                  <input type="range" min={18} max={appSettings.ageMax} value={appSettings.ageMin} onChange={(event) => onAppSettingsChange({ ageMin: Number(event.target.value) })} className="accent-rose-500" />
                  <input type="range" min={appSettings.ageMin} max={60} value={appSettings.ageMax} onChange={(event) => onAppSettingsChange({ ageMax: Number(event.target.value) })} className="accent-rose-500" />
                </div>
                <div className="mt-4">
                  <ToggleRow label="Show people slightly out of my preferred range if I run out of profiles to see" checked={appSettings.allowOutsideRange} onChange={(value) => onAppSettingsChange({ allowOutsideRange: value })} compact />
                </div>
              </div>
              <div className="rounded-[1.8rem] border border-amber-300/10 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),#17140f] p-4">
                <p className="text-4xl font-black leading-none text-amber-300">Unlock more Preferences...</p>
                <p className="mt-3 max-w-xs text-sm leading-6 text-white/75">Want more personalization? Set your Premium Preferences to see profiles that match your vibe without missing out on others.</p>
                <button type="button" onClick={() => onAction("Premium preferences preview opened.")} className="mt-5 rounded-full bg-amber-300 px-5 py-3 font-black text-slate-950">Unlock</button>
              </div>
              <RangeCard title="Minimum Number of Photos" valueLabel={`${appSettings.minimumPhotos}`} min={1} max={6} value={appSettings.minimumPhotos} onChange={(value) => onAppSettingsChange({ minimumPhotos: value })}>
                <ToggleRow label="Has a bio" checked={appSettings.requireBio} onChange={(value) => onAppSettingsChange({ requireBio: value })} compact />
              </RangeCard>
              <div className="rounded-[1.8rem] bg-[#15171d] p-4">
                <p className="text-sm font-bold">Interests</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preferenceChoices.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInterest(item)}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition ${appSettings.interestsSelection.includes(item) ? "bg-rose-500 text-white" : "bg-white/7 text-white/72"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              {[
                ["Looking for", "lookingFor"],
                ["Add languages", "languages"],
                ["Zodiac", "zodiac"],
                ["Education", "educationLevel"],
                ["Family Plans", "familyPlans"],
                ["Communication Style", "communicationStyle"],
                ["Love Style", "loveStyle"],
                ["Pets", "pets"],
                ["Drinking", "drinkingPreference"],
                ["Smoking", "smokingPreference"],
                ["Workout", "workoutHabit"],
                ["Social Media", "socialMediaHandle"],
              ].map(([label, key]) => (
                <InfoRow
                  key={label}
                  label={label}
                  value={Array.isArray(appSettings[key as keyof PartnerAppSettings]) ? "Selected" : String(appSettings[key as keyof PartnerAppSettings] || "Select")}
                  onClick={() => {
                    const nextValue = label === "Add languages" ? ["English", "Xitsonga"] : label === "Looking for" ? "Long-term partner" : "Selected";
                    onAppSettingsChange({ [key]: nextValue } as Partial<PartnerAppSettings>);
                  }}
                />
              ))}
            </SettingsSection>

            <SettingsSection title="Control Who You See">
              <ChoiceCard label="Balanced Recommendations" description="See the most relevant people to you." active={appSettings.recommendationMode === "balanced"} onClick={() => onAppSettingsChange({ recommendationMode: "balanced" })} />
              <ChoiceCard label="Recently Active" description="See the most recently active people first." active={appSettings.recommendationMode === "recent"} onClick={() => onAppSettingsChange({ recommendationMode: "recent" })} />
            </SettingsSection>

            <SettingsSection title="Control My Visibility">
              <ChoiceCard label="Standard" description="You will be discoverable in the card stack." active={appSettings.visibilityMode === "standard"} onClick={() => onAppSettingsChange({ visibilityMode: "standard" })} />
              <ChoiceCard label="Incognito" description="You will be discoverable only by people you like." active={appSettings.visibilityMode === "incognito"} onClick={() => onAppSettingsChange({ visibilityMode: "incognito" })} />
            </SettingsSection>

            <SettingsSection title="Enable Discovery">
              <ToggleRow label="Enable Discovery" description="When turned off, your profile will be hidden from the card stack and Discovery will be disabled." checked={appSettings.enableDiscovery} onChange={(value) => onAppSettingsChange({ enableDiscovery: value })} />
            </SettingsSection>

            <SettingsSection title="Control Who Messages You">
              <ToggleRow label="Photo Verified Chat" description="Only receive messages from photo-verified profiles." checked={appSettings.photoVerifiedChat} onChange={(value) => onAppSettingsChange({ photoVerifiedChat: value })} />
              <InfoRow label="Block Contacts" value="Manage" onClick={() => onAction("Contact blocking tools are ready to review.")} />
            </SettingsSection>

            <SettingsSection title="Safety & Attention">
              <ToggleRow label="Message notifications" description="Show system alerts for new partner messages." checked={safetySettings.messageNotifications} onChange={(value) => onSafetyChange({ messageNotifications: value })} />
              <ToggleRow label="Quiet mode" description="Pause likes, matches, reminders, and message notifications." checked={safetySettings.quietMode} onChange={(value) => onSafetyChange({ quietMode: value })} />
              <ToggleRow label="Scam warnings" description="Warn before risky requests for codes, money, passwords, or banking details." checked={safetySettings.scamWarnings} onChange={(value) => onSafetyChange({ scamWarnings: value })} />
              <ToggleRow label="Chat search" description="Show a search box inside open chats." checked={safetySettings.chatSearch} onChange={(value) => onSafetyChange({ chatSearch: value })} />
              <ToggleRow label="Hide my distance" description="Do not show KM distance on cards, match rows, or chat headers." checked={safetySettings.hideDistance} onChange={(value) => onSafetyChange({ hideDistance: value })} />
              <ToggleRow label="Hide online status" description="Appear offline and stop sending live presence while enabled." checked={safetySettings.hideOnlineStatus} onChange={(value) => onSafetyChange({ hideOnlineStatus: value })} />
              <ToggleRow label="Send read receipts" description="Let matches see when you have opened their messages." checked={safetySettings.sendReadReceipts} onChange={(value) => onSafetyChange({ sendReadReceipts: value })} />
            </SettingsSection>

            <SettingsSection title="Appearance">
              <SegmentedButtons
                value={appSettings.appearance}
                options={[
                  { label: "System", value: "system" },
                  { label: "Light", value: "light" },
                  { label: "Dark", value: "dark" },
                ]}
                onChange={(value) => onAppSettingsChange({ appearance: value as AppearanceMode })}
              />
            </SettingsSection>

            <SettingsSection title="Data Usage">
              <ToggleRow label="Autoplay Videos" checked={appSettings.autoplayVideos} onChange={(value) => onAppSettingsChange({ autoplayVideos: value })} />
            </SettingsSection>

            <SettingsSection title="App Settings">
              <ToggleRow label="Notifications" checked={appSettings.notificationsEnabled} onChange={(value) => onAppSettingsChange({ notificationsEnabled: value })} />
              <ToggleRow label="Email" checked={appSettings.emailUpdates} onChange={(value) => onAppSettingsChange({ emailUpdates: value })} />
              <ToggleRow label="Push Notifications" checked={appSettings.pushNotifications} onChange={(value) => onAppSettingsChange({ pushNotifications: value })} />
              <ToggleRow label="SMS" checked={appSettings.smsUpdates} onChange={(value) => onAppSettingsChange({ smsUpdates: value })} />
              <ToggleRow label="Team Tinder" checked={appSettings.teamPartnerUpdates} onChange={(value) => onAppSettingsChange({ teamPartnerUpdates: value })} />
              <button type="button" onClick={onRequestPermissions} className="rounded-[1.4rem] bg-[#15171d] px-4 py-4 text-left text-sm font-bold">Request browser notification permission</button>
            </SettingsSection>

            <SettingsSection title="Show Distances In">
              <SegmentedButtons
                value={appSettings.distanceUnit}
                options={[
                  { label: "Km.", value: "km" },
                  { label: "Mi.", value: "mi" },
                ]}
                onChange={(value) => onAppSettingsChange({ distanceUnit: value as DistanceUnit })}
              />
            </SettingsSection>

            <SettingsSection title="Account & Help">
              <button type="button" onClick={onEditProfile} className="rounded-[1.4rem] bg-[#15171d] px-4 py-4 text-left font-semibold">Edit profile</button>
              <button type="button" onClick={() => onAction("Help & Support is available from your support center.")} className="rounded-[1.4rem] bg-[#15171d] px-4 py-4 text-left font-semibold">Help & Support</button>
              <button type="button" onClick={() => onAction("Problem reporting is ready. Add the issue details from the next screen.")} className="rounded-[1.4rem] bg-[#15171d] px-4 py-4 text-left font-semibold">Report a problem</button>
              <button type="button" onClick={onLogout} className="rounded-[1.4rem] bg-[#15171d] px-4 py-4 text-left font-semibold text-rose-300">Logout</button>
            </SettingsSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 px-1 text-[1.05rem] font-black text-white">{title}</h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  compact,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-[1.6rem] bg-[#15171d] ${compact ? "p-0" : "p-4"}`}>
      <div className={`flex items-center justify-between gap-4 ${compact ? "px-0 py-0" : ""}`}>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-white">{label}</p>
          {description ? <p className="mt-2 text-sm leading-6 text-white/62">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-8 w-14 shrink-0 rounded-full border transition ${checked ? "border-rose-400 bg-rose-500" : "border-white/14 bg-white/10"}`}
          aria-pressed={checked}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${checked ? "left-7" : "left-1"}`} />
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between rounded-[1.6rem] bg-[#15171d] px-4 py-4 text-left">
      <span className="text-lg font-medium text-white">{label}</span>
      <span className="text-base text-white/56">{value} &gt;</span>
    </button>
  );
}

function RangeCard({
  title,
  valueLabel,
  min,
  max,
  value,
  onChange,
  children,
}: {
  title: string;
  valueLabel: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[1.8rem] bg-[#15171d] p-4">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-lg text-white/68">{valueLabel}</p>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-5 w-full accent-rose-500" />
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function ChoiceCard({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[1.6rem] border px-4 py-4 text-left ${active ? "border-rose-400/45 bg-[#191117]" : "border-white/8 bg-[#15171d]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{label}</p>
          <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
        </div>
        <span className={`text-2xl font-black ${active ? "text-rose-400" : "text-white/20"}`}>✓</span>
      </div>
    </button>
  );
}

function SegmentedButtons({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-[1.8rem] bg-[#15171d] p-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-[1rem] px-3 py-3 text-sm font-black transition ${value === option.value ? "bg-rose-500 text-white" : "bg-black/10 text-white/66"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FeaturePromoCard({
  title,
  accent,
  active,
  onClick,
}: {
  title: string;
  accent: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[1.8rem] border px-4 py-5 text-left ${active ? "border-white/18 bg-[#17191f]" : "border-white/8 bg-[#121419]"}`}>
      <div className={`text-2xl font-black ${accent}`}>★</div>
      <p className={`mt-4 text-lg font-semibold ${active ? "text-white" : "text-white/84"}`}>{title}</p>
    </button>
  );
}

function MatchRowButton({ profile, distanceLabel, onOpen }: { match: MatchRow; playerId: string; profile?: DatingProfile; distanceLabel: string | null; onOpen: () => void }) {
  if (!profile) return null;
  const partnerLabel = officialPartnerLabel(profile);
  return <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/5 p-3 text-left"><div className="h-20 w-16 overflow-hidden rounded-2xl bg-white/10">{profile.photo_url ? <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover" /> : null}</div><div className="flex-1"><div className="flex items-center gap-2"><h3 className="text-lg font-bold">{profile.display_name}</h3>{isProfileVerified(profile) ? <span className="rounded-full bg-sky-400 px-2 py-1 text-[10px] font-bold text-slate-950">Verified</span> : null}{partnerLabel ? <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-100">Taken</span> : null}</div><p className="mt-1 text-sm text-white/65">{distanceLabel || profile.location_label || profile.city}</p><p className="mt-1 text-sm text-white/65">{partnerLabel || profile.relationship_goal || "Still figuring it out"}</p></div></button>;
}

function ChatListButton({
  profile,
  distanceLabel,
  unreadCount,
  presence,
  blocked,
  blockedBy,
  onOpen,
}: {
  match: MatchRow;
  profile?: DatingProfile;
  distanceLabel: string | null;
  unreadCount: number;
  presence?: PlayerPresence;
  blocked: boolean;
  blockedBy: boolean;
  onOpen: () => void;
}) {
  if (!profile) return null;
  const isOnline = Boolean(presence?.is_online);
  const presenceLabel = isOnline ? "Online" : formatLastSeen(presence?.last_seen_at);
  const partnerLabel = officialPartnerLabel(profile);

  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10">
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/10">
        {profile.photo_url ? <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover" /> : null}
        <span className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-[#181a21] ${isOnline ? "bg-emerald-400" : "bg-red-500"}`}></span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-xl font-black">{profile.display_name}, {profile.age}</h3>
          {isProfileVerified(profile) ? <span className="shrink-0 rounded-full bg-sky-400 px-2 py-1 text-[10px] font-bold text-slate-950">Verified</span> : null}
          {partnerLabel ? <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-100">Taken</span> : null}
        </div>
        <p className="mt-1 text-sm text-white/65">
          {blocked ? "Blocked - tap to unblock" : blockedBy ? "Messaging unavailable" : `${presenceLabel} - ${partnerLabel || distanceLabel || profile.location_label || profile.city}`}
        </p>
      </div>
      {blocked || blockedBy ? (
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase text-white/70">
          {blocked ? "Blocked" : "Closed"}
        </span>
      ) : unreadCount ? (
        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 px-2 text-xs font-black text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function PhoneIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M6.6 10.8c1.6 3.1 3.5 5 6.6 6.6l2.2-2.2c.3-.3.8-.4 1.2-.3 1.3.4 2.6.6 4 .6.7 0 1.2.5 1.2 1.2v3.5c0 .7-.5 1.2-1.2 1.2C10.5 21.9 2.1 13.5 2.1 3.4c0-.7.5-1.2 1.2-1.2h3.5c.7 0 1.2.5 1.2 1.2 0 1.4.2 2.7.6 4 .1.4 0 .9-.3 1.2l-1.7 2.2z" /></svg>;
}

function VideoIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M4 6.5C4 5.1 5.1 4 6.5 4h7C14.9 4 16 5.1 16 6.5v1.7l3.5-2.1c.9-.5 2 .1 2 1.1v9.6c0 1-1.1 1.6-2 1.1L16 15.8v1.7c0 1.4-1.1 2.5-2.5 2.5h-7C5.1 20 4 18.9 4 17.5v-11z" /></svg>;
}

function MicIcon({ className = "h-6 w-6" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M12 14.5c1.7 0 3-1.3 3-3V5c0-1.7-1.3-3-3-3S9 3.3 9 5v6.5c0 1.7 1.3 3 3 3z" /><path d="M18.5 11.5c0 3.2-2.4 5.8-5.5 6.2V21h3v2H8v-2h3v-3.3c-3.1-.5-5.5-3.1-5.5-6.2h2c0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5h2z" /></svg>;
}

function PhotoIcon({ className = "h-6 w-6" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M5 4h14c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H5c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3zm3 6.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.5 6.2c.1.7.7 1.3 1.5 1.3h12c.7 0 1.3-.5 1.5-1.2l-4.1-4.4c-.5-.5-1.3-.5-1.8 0L11 15l-1.4-1.4c-.5-.5-1.3-.5-1.8.1l-3.3 3z" /></svg>;
}

function SmileIcon({ className = "h-6 w-6" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.2 8.1c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2S10 8.2 10 8.9s-.5 1.2-1.2 1.2zm6.4 0c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2zM12 17.4c-2.3 0-4.2-1.3-5.1-3.2h2.2c.7.8 1.7 1.2 2.9 1.2s2.2-.4 2.9-1.2h2.2c-.9 1.9-2.8 3.2-5.1 3.2z" /></svg>;
}

function ThumbIcon({ className = "h-6 w-6" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M2 10.5C2 9.7 2.7 9 3.5 9H6v12H3.5C2.7 21 2 20.3 2 19.5v-9zM8 21V8.7l4.6-5.1c.8-.9 2.4-.4 2.4.9V9h4.7c1.5 0 2.6 1.4 2.2 2.8l-1.8 6.8c-.4 1.4-1.6 2.4-3.1 2.4H8z" /></svg>;
}

function ReplyQuote({ reply, own }: { reply: ChatReplyReference; own: boolean }) {
  return (
    <div className={`mb-2 rounded-xl border-l-4 px-3 py-2 text-left text-xs leading-5 ${own ? "border-sky-200 bg-white/12" : "border-sky-300 bg-white/10"}`}>
      <span className="block font-black text-sky-100">{reply.senderName}</span>
      <span className="line-clamp-2 opacity-80">{reply.preview}</span>
    </div>
  );
}

function ChatPanel({
  activeMatchProfile,
  activeMessages,
  activePlayerId,
  chatDraft,
  setChatDraft,
  saving,
  onSend,
  onQuickSend,
  onCommit,
  officialButtonLabel,
  onBack,
  presence,
  distanceLabel,
  safetySettings,
  userControls,
  isTyping,
  onImageSend,
  onAttachmentSend,
  onVoiceSend,
  onStartCall,
  onPlanSafeDate,
  onSuggestMeetupSpot,
  onVouch,
  vouchCount,
  hasVouched,
  onToggleMute,
  onToggleFavourite,
  onToggleListed,
  onToggleDisappearing,
  onClearChat,
  onCloseChat,
  onDeleteChat,
  onBlock,
  onReport,
}: {
  activeMatchProfile: DatingProfile;
  activeMessages: MessageRow[];
  activePlayerId: string;
  chatDraft: string;
  setChatDraft: (value: string) => void;
  saving: boolean;
  onSend: (body?: string, clearDraft?: boolean) => void;
  onQuickSend: (body: string) => void;
  onCommit: () => void;
  officialButtonLabel: string;
  onBack: () => void;
  presence?: PlayerPresence;
  distanceLabel: string | null;
  safetySettings: PartnerSafetySettings;
  userControls: PartnerUserControls;
  isTyping: boolean;
  onImageSend: (file: File) => void;
  onAttachmentSend: (file: File, kind: "document" | "media" | "camera" | "audio") => void;
  onVoiceSend: (blob: Blob) => void;
  onStartCall: (kind: "voice" | "video") => void;
  onPlanSafeDate: () => void;
  onSuggestMeetupSpot: () => void;
  onVouch: () => void;
  vouchCount: number;
  hasVouched: boolean;
  onToggleMute: () => void;
  onToggleFavourite: () => void;
  onToggleListed: () => void;
  onToggleDisappearing: () => void;
  onClearChat: () => void;
  onCloseChat: () => void;
  onDeleteChat: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  const isOnline = Boolean(presence?.is_online);
  const isBlocked = Boolean(userControls.blocked);
  const isBlockedBy = Boolean(userControls.blockedBy);
  const communicationBlocked = isBlocked || isBlockedBy;
  const partnerLabel = officialPartnerLabel(activeMatchProfile);
  const presenceLabel = isTyping ? "Typing..." : isOnline ? "Online" : formatLastSeen(presence?.last_seen_at);
  const dividerLabel = formatChatDivider(activeMessages[0]?.created_at);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [openImageUrl, setOpenImageUrl] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatReplyReference | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [messageMenuPosition, setMessageMenuPosition] = useState<{ top: number; left: number; side: "left" | "right" } | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [forceSearchOpen, setForceSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [menuNotice, setMenuNotice] = useState("");
  const [deletedMessageIds, setDeletedMessageIds] = useState<string[]>([]);
  const [voiceRecorderState, setVoiceRecorderState] = useState<"idle" | "recording" | "paused" | "preview">("idle");
  const [voiceElapsedSeconds, setVoiceElapsedSeconds] = useState(0);
  const [voicePreviewBlob, setVoicePreviewBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [videoNoteState, setVideoNoteState] = useState<"idle" | "recording" | "preview">("idle");
  const [videoNoteElapsedSeconds, setVideoNoteElapsedSeconds] = useState(0);
  const [videoNotePreviewBlob, setVideoNotePreviewBlob] = useState<Blob | null>(null);
  const [videoNotePreviewUrl, setVideoNotePreviewUrl] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const discardingVoiceRef = useRef(false);
  const voiceTimerRef = useRef<number | null>(null);
  const videoNoteRecorderRef = useRef<MediaRecorder | null>(null);
  const videoNoteChunksRef = useRef<Blob[]>([]);
  const videoNoteTimerRef = useRef<number | null>(null);
  const videoNotePreviewRef = useRef<HTMLVideoElement | null>(null);
  const discardingVideoNoteRef = useRef(false);
  const messageOpenedByLongPressRef = useRef(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const messageLongPressTimerRef = useRef<number | null>(null);
  const messagesScrollerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const latestMessageKey = activeMessages.map((message) => `${message.id}:${message.read_at || ""}`).join("|");
  const normalizedSearch = messageSearch.trim().toLowerCase();
  const clearedAtMs = userControls.chatClearedAt ? new Date(userControls.chatClearedAt).getTime() : 0;
  const visibleMessages = clearedAtMs
    ? activeMessages.filter((message) => new Date(message.created_at).getTime() > clearedAtMs)
    : activeMessages;
  const availableMessages = visibleMessages.filter((message) => !deletedMessageIds.includes(message.id));
  const searchMatchIds = normalizedSearch
    ? availableMessages
        .filter((message) => {
          const text = chatMessageText(message.body).toLowerCase();
          return text.includes(normalizedSearch);
        })
        .map((message) => message.id)
    : [];
  const safeActiveSearchIndex = searchMatchIds.length ? Math.min(activeSearchIndex, searchMatchIds.length - 1) : 0;
  const activeSearchMessageId = searchMatchIds[safeActiveSearchIndex] || "";
  const shownMessages = availableMessages;
  const draftWarning = safetySettings.scamWarnings ? riskyMessageWarning(chatDraft) : "";
  const composerRows = Math.min(
    6,
    Math.max(
      1,
      chatDraft.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 34)), 0),
    ),
  );
  const replyReferenceFor = (message: MessageRow): ChatReplyReference => {
    const text = chatMessageText(message.body);
    const preview = isChatImageMessage(text)
      ? "Photo"
      : isChatAudioMessage(text)
        ? "Voice note"
        : isChatVideoMessage(text)
          ? "Video"
          : isChatDocumentMessage(text)
            ? chatDocumentPayload(text).name
            : isChatContactMessage(text)
              ? `Contact: ${chatContactPayload(text).name}`
              : isChatPollMessage(text)
                ? `Poll: ${chatPollPayload(text).question}`
                : isChatEventMessage(text)
                  ? `Event: ${chatEventPayload(text).title}`
                  : isChatStickerMessage(text)
                    ? `Sticker: ${chatStickerValue(text)}`
                    : isChatLocationMessage(text)
                      ? `Location: ${chatLocationPayload(text).label}`
                      : isChatDatePlanMessage(text)
                        ? `Date plan: ${chatDatePlanPayload(text).title}`
                    : text;
    return {
      id: message.id,
      senderName: message.sender_id === activePlayerId ? "You" : activeMatchProfile.display_name,
      preview: preview.length > 90 ? `${preview.slice(0, 90)}...` : preview || "Message",
    };
  };

  const sendCurrentMessage = () => {
    const trimmedDraft = chatDraft.trim();
    if (!trimmedDraft) return;
    onSend(replyingTo ? encodeChatReply(replyingTo, trimmedDraft) : trimmedDraft, true);
    setReplyingTo(null);
    setOpenActionsFor(null);
    setMessageMenuPosition(null);
  };

  const closeMenuWithNotice = (notice: string) => {
    setMenuNotice(notice);
    setShowConversationMenu(false);
    setSelectedMessageId(null);
    setOpenActionsFor(null);
    setMessageMenuPosition(null);
  };

  const positionMessageMenu = (messageId: string, ownMessage: boolean) => {
    const rect = messageRefs.current[messageId]?.getBoundingClientRect();
    const menuWidth = 256;
    const menuHeight = Math.min(384, Math.max(280, window.innerHeight - 120));
    const viewportPadding = 12;
    const headerPadding = 84;
    const fallbackTop = Math.max(headerPadding, window.innerHeight / 2 - menuHeight / 2);
    const preferredLeft = rect ? (ownMessage ? rect.right - menuWidth : rect.left) : viewportPadding;
    const preferredTop = rect ? rect.top + Math.min(rect.height / 2, 18) : fallbackTop;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
    const maxTop = Math.max(headerPadding, window.innerHeight - menuHeight - viewportPadding);

    return {
      top: Math.min(Math.max(headerPadding, preferredTop), maxTop),
      left: Math.min(Math.max(viewportPadding, preferredLeft), maxLeft),
      side: ownMessage ? "right" as const : "left" as const,
    };
  };

  const openMessageActions = (messageId: string, ownMessage: boolean) => {
    setSelectedMessageId(messageId);
    setMessageMenuPosition(positionMessageMenu(messageId, ownMessage));
    setOpenActionsFor(messageId);
  };
  const openMessageActionsByLongPress = (messageId: string, ownMessage: boolean) => {
    messageOpenedByLongPressRef.current = true;
    openMessageActions(messageId, ownMessage);
  };
  const clearMessageLongPress = () => {
    if (messageLongPressTimerRef.current !== null) {
      window.clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
  };
  const closeMessageActions = () => {
    setSelectedMessageId(null);
    setOpenActionsFor(null);
    setMessageMenuPosition(null);
  };
  const moveSearch = (direction: 1 | -1) => {
    if (!searchMatchIds.length) return;
    setActiveSearchIndex((current) => {
      const next = (current + direction + searchMatchIds.length) % searchMatchIds.length;
      requestAnimationFrame(() => {
        messageRefs.current[searchMatchIds[next]]?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return next;
    });
  };
  const sendStructuredAttachment = (body: string) => {
    onQuickSend(body);
    setShowAttachMenu(false);
  };
  const sendContactAttachment = () => {
    sendStructuredAttachment(`${chatContactPrefix}${encodeChatPayload({ name: activeMatchProfile.display_name, detail: distanceLabel || activeMatchProfile.location_label || activeMatchProfile.city || "Partner contact" })}`);
  };
  const sendPollAttachment = () => {
    const question = window.prompt("Poll question");
    if (!question?.trim()) return;
    const rawOptions = window.prompt("Options separated by commas", "Yes, No");
    const options = (rawOptions || "Yes, No").split(",").map((option) => option.trim()).filter(Boolean).slice(0, 6);
    sendStructuredAttachment(`${chatPollPrefix}${encodeChatPayload({ question: question.trim(), options: options.length ? options : ["Yes", "No"] })}`);
  };
  const sendEventAttachment = () => {
    const title = window.prompt("Event title");
    if (!title?.trim()) return;
    const detail = window.prompt("Event details or date", "Today");
    sendStructuredAttachment(`${chatEventPrefix}${encodeChatPayload({ title: title.trim(), detail: detail?.trim() || "No details added" })}`);
  };
  const sendStickerAttachment = () => {
    const sticker = window.prompt("Choose sticker emoji", "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â");
    if (!sticker?.trim()) return;
    sendStructuredAttachment(`${chatStickerPrefix}${encodeURIComponent(sticker.trim())}`);
  };
  const sendLocationAttachment = () => {
    setShowAttachMenu(false);
    if (!navigator.geolocation) {
      closeMenuWithNotice("Location is not available in this browser.");
      return;
    }
    const allowed = window.confirm("Share your current live location in this chat?");
    if (!allowed) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        sendStructuredAttachment(`${chatLocationPrefix}${encodeChatPayload({ latitude, longitude, label: `Live location ${latitude}, ${longitude}` })}`);
      },
      () => closeMenuWithNotice("Could not read your location. Check GPS/location permission and try again."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };
  const sendDatePlanAttachment = () => {
    const title = window.prompt("Date plan title", "Coffee date");
    if (!title?.trim()) return;
    const when = window.prompt("When?", "This weekend") || "This weekend";
    const place = window.prompt("Where?", "A public place nearby") || "A public place nearby";
    const note = window.prompt("Note", "Let us confirm the time first.") || "";
    sendStructuredAttachment(`${chatDatePlanPrefix}${encodeChatPayload({ title: title.trim(), when: when.trim(), place: place.trim(), note: note.trim() })}`);
  };
  const handleAttachmentInput = (event: ChangeEvent<HTMLInputElement>, kind: "document" | "media" | "camera" | "audio") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setShowAttachMenu(false);
    if (file) onAttachmentSend(file, kind);
  };

  const voiceDurationLabel = `${Math.floor(voiceElapsedSeconds / 60)}:${String(voiceElapsedSeconds % 60).padStart(2, "0")}`;
  const videoNoteDurationLabel = `${Math.floor(videoNoteElapsedSeconds / 60)}:${String(videoNoteElapsedSeconds % 60).padStart(2, "0")}`;
  const stopVoiceTimer = () => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };
  const stopVideoNoteTimer = () => {
    if (videoNoteTimerRef.current !== null) {
      window.clearInterval(videoNoteTimerRef.current);
      videoNoteTimerRef.current = null;
    }
  };
  const startVoiceTimer = () => {
    stopVoiceTimer();
    voiceTimerRef.current = window.setInterval(() => {
      setVoiceElapsedSeconds((current) => current + 1);
    }, 1000);
  };
  const startVideoNoteTimer = () => {
    stopVideoNoteTimer();
    videoNoteTimerRef.current = window.setInterval(() => {
      setVideoNoteElapsedSeconds((current) => current + 1);
    }, 1000);
  };
  const resetVoiceDraft = () => {
    stopVoiceTimer();
    discardingVoiceRef.current = true;
    const recorder = recorderRef.current;
    const waitingForStop = Boolean(recorder && recorder.state !== "inactive");
    recorder?.stream.getTracks().forEach((track) => track.stop());
    if (waitingForStop) {
      recorder?.stop();
    }
    recorderRef.current = null;
    recordedChunksRef.current = [];
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    setVoicePreviewUrl("");
    setVoicePreviewBlob(null);
    setVoiceElapsedSeconds(0);
    setVoiceRecorderState("idle");
    setIsRecordingVoice(false);
    if (!waitingForStop) discardingVoiceRef.current = false;
  };
  const resetVideoNoteDraft = () => {
    stopVideoNoteTimer();
    discardingVideoNoteRef.current = true;
    const recorder = videoNoteRecorderRef.current;
    const waitingForStop = Boolean(recorder && recorder.state !== "inactive");
    recorder?.stream.getTracks().forEach((track) => track.stop());
    if (waitingForStop) recorder?.stop();
    videoNoteRecorderRef.current = null;
    videoNoteChunksRef.current = [];
    if (videoNotePreviewUrl) URL.revokeObjectURL(videoNotePreviewUrl);
    setVideoNotePreviewUrl("");
    setVideoNotePreviewBlob(null);
    setVideoNoteElapsedSeconds(0);
    setVideoNoteState("idle");
    if (videoNotePreviewRef.current) videoNotePreviewRef.current.srcObject = null;
    if (!waitingForStop) discardingVideoNoteRef.current = false;
  };

  const jumpToLatestMessage = () => {
    const scroller = messagesScrollerRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  };

  const scrollToLatestMessage = () => {
    requestAnimationFrame(() => {
      jumpToLatestMessage();
    });
  };

  const startVoiceRecording = async () => {
    try {
      resetVideoNoteDraft();
      resetVoiceDraft();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: voiceAudioConstraints });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopVoiceTimer();
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingVoice(false);
        if (discardingVoiceRef.current) {
          discardingVoiceRef.current = false;
          return;
        }
        const voiceBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!voiceBlob.size) {
          setVoiceRecorderState("idle");
          return;
        }
        const previewUrl = URL.createObjectURL(voiceBlob);
        setVoicePreviewBlob(voiceBlob);
        setVoicePreviewUrl(previewUrl);
        setVoiceRecorderState("preview");
      };

      recorder.start();
      setIsRecordingVoice(true);
      setVoiceRecorderState("recording");
      setVoiceElapsedSeconds(0);
      startVoiceTimer();
    } catch (recordError) {
      console.error("Could not record voice note", recordError);
      setIsRecordingVoice(false);
      setVoiceRecorderState("idle");
    }
  };

  const startVideoNoteRecording = async () => {
    try {
      resetVoiceDraft();
      resetVideoNoteDraft();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: voiceAudioConstraints,
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
      });
      const videoMimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, videoMimeType ? { mimeType: videoMimeType } : undefined);
      videoNoteChunksRef.current = [];
      videoNoteRecorderRef.current = recorder;

      if (videoNotePreviewRef.current) {
        videoNotePreviewRef.current.srcObject = stream;
        void videoNotePreviewRef.current.play();
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size) videoNoteChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopVideoNoteTimer();
        stream.getTracks().forEach((track) => track.stop());
        if (videoNotePreviewRef.current) videoNotePreviewRef.current.srcObject = null;
        if (discardingVideoNoteRef.current) {
          discardingVideoNoteRef.current = false;
          return;
        }
        const videoBlob = new Blob(videoNoteChunksRef.current, { type: recorder.mimeType || "video/webm" });
        if (!videoBlob.size) {
          setVideoNoteState("idle");
          return;
        }
        const previewUrl = URL.createObjectURL(videoBlob);
        setVideoNotePreviewBlob(videoBlob);
        setVideoNotePreviewUrl(previewUrl);
        setVideoNoteState("preview");
      };

      recorder.start();
      setVideoNoteElapsedSeconds(0);
      setVideoNoteState("recording");
      startVideoNoteTimer();
    } catch (recordError) {
      console.error("Could not record video note", recordError);
      resetVideoNoteDraft();
      closeMenuWithNotice("Could not start video note. Allow camera and microphone permission, then try again.");
    }
  };

  const pauseVoiceRecording = () => {
    if (recorderRef.current?.state !== "recording") return;
    recorderRef.current.pause();
    setVoiceRecorderState("paused");
    stopVoiceTimer();
  };

  const resumeVoiceRecording = () => {
    if (recorderRef.current?.state !== "paused") return;
    recorderRef.current.resume();
    setVoiceRecorderState("recording");
    startVoiceTimer();
  };

  const finishVoicePreview = () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    recorderRef.current.stop();
  };

  const sendVoicePreview = () => {
    if (!voicePreviewBlob) return;
    onVoiceSend(voicePreviewBlob);
    resetVoiceDraft();
  };

  const finishVideoNotePreview = () => {
    if (!videoNoteRecorderRef.current || videoNoteRecorderRef.current.state === "inactive") return;
    videoNoteRecorderRef.current.stop();
  };

  const sendVideoNotePreview = () => {
    if (!videoNotePreviewBlob) return;
    const videoFile = new File([videoNotePreviewBlob], `video-note-${Date.now()}.webm`, { type: videoNotePreviewBlob.type || "video/webm" });
    onAttachmentSend(videoFile, "media");
    resetVideoNoteDraft();
  };

  useEffect(() => {
    return () => {
      clearMessageLongPress();
      stopVoiceTimer();
      stopVideoNoteTimer();
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      videoNoteRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
      if (videoNotePreviewUrl) URL.revokeObjectURL(videoNotePreviewUrl);
    };
  }, [voicePreviewUrl, videoNotePreviewUrl]);

  useLayoutEffect(() => {
    jumpToLatestMessage();
  }, [activeMatchProfile.user_id]);

  useEffect(() => {
    scrollToLatestMessage();
  }, [latestMessageKey, isTyping]);

  useEffect(() => {
    if (!forceSearchOpen || !activeSearchMessageId) return;
    messageRefs.current[activeSearchMessageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSearchMessageId, forceSearchOpen]);

  useEffect(() => {
    if (!openActionsFor) return;
    const scroller = messagesScrollerRef.current;
    const dismissFloatingMenu = () => {
      setSelectedMessageId(null);
      setOpenActionsFor(null);
      setMessageMenuPosition(null);
    };

    window.addEventListener("resize", dismissFloatingMenu);
    scroller?.addEventListener("scroll", dismissFloatingMenu, { passive: true });
    return () => {
      window.removeEventListener("resize", dismissFloatingMenu);
      scroller?.removeEventListener("scroll", dismissFloatingMenu);
    };
  }, [openActionsFor]);

  return (
    <div className="flex h-dvh min-h-0 w-full flex-col bg-[#071323] text-white lg:h-[calc(100dvh-3rem)] lg:max-w-6xl lg:overflow-hidden lg:rounded-[1.5rem] lg:border lg:border-white/10 lg:shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
      <div className="relative shrink-0 flex items-center gap-3 border-b border-white/10 bg-[#0b1728] px-4 py-3 shadow-sm">
        <button onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white transition hover:bg-white/15" aria-label="Back to chats">
          &lt;
        </button>

        <div className="relative h-12 w-12 shrink-0">
          <div className="h-full w-full overflow-hidden rounded-full bg-white/10">
            {activeMatchProfile.photo_url ? <img src={activeMatchProfile.photo_url} alt={activeMatchProfile.display_name} className="h-full w-full object-cover" /> : null}
          </div>
          <span className={`absolute bottom-0 right-0 z-10 h-4 w-4 rounded-full border-[3px] border-[#0b1728] ${isOnline ? "bg-emerald-500" : "bg-red-500"}`}></span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <h3 className="truncate text-xl font-bold leading-tight text-white">{activeMatchProfile.display_name}</h3>
            {isProfileVerified(activeMatchProfile) ? <span className="shrink-0 rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">Verified</span> : null}
            <span className="text-sm font-black text-sky-300">v</span>
          </div>
          <p className="truncate text-sm font-medium text-white/55">{distanceLabel ? `${presenceLabel} - ${distanceLabel}` : presenceLabel}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-sky-300">
          <button onClick={() => onStartCall("voice")} disabled={communicationBlocked} className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-40" aria-label="Start voice call">
            <PhoneIcon />
          </button>
          <button onClick={() => onStartCall("video")} disabled={communicationBlocked} className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-40" aria-label="Start video call">
            <VideoIcon />
          </button>
          <button
            type="button"
            onClick={() => setShowConversationMenu((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl font-black leading-none text-white transition hover:bg-white/10"
            aria-label="Conversation options"
          >
            ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â®
          </button>
        </div>

        {showConversationMenu ? (
          <div className="absolute right-3 top-16 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#101827] py-2 text-sm font-medium text-white shadow-[0_22px_70px_rgba(0,0,0,0.5)]">
            <button type="button" onClick={() => { setShowConversationMenu(false); onStartCall("voice"); }} disabled={communicationBlocked} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10 disabled:opacity-45">
              <PhoneIcon className="h-4 w-4" />
              <span>Call</span>
            </button>
            <button type="button" onClick={() => closeMenuWithNotice(`${activeMatchProfile.display_name}, ${activeMatchProfile.age} - ${distanceLabel || activeMatchProfile.location_label || activeMatchProfile.city}. ${officialPartnerLabel(activeMatchProfile) || activeMatchProfile.relationship_goal || "Available to connect."}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">i</span>
              <span>Contact info</span>
            </button>
            <button type="button" onClick={() => safetySettings.chatSearch ? (setForceSearchOpen(true), setShowConversationMenu(false)) : closeMenuWithNotice("Chat search is turned off in profile settings.")} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢</span>
              <span>Search</span>
            </button>
            <button type="button" onClick={() => { setSelectionMode((current) => !current); setShowConversationMenu(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</span>
              <span>{selectionMode ? "Cancel selection" : "Select messages"}</span>
            </button>
            <button type="button" onClick={() => { onToggleMute(); setShowConversationMenu(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â</span>
              <span>{userControls.muted ? "Unmute notifications" : "Mute notifications"}</span>
            </button>
            <button type="button" onClick={() => { onToggleDisappearing(); closeMenuWithNotice(userControls.disappearingMessages ? "Disappearing messages off." : "Disappearing messages on for this chat."); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢</span>
              <span>{userControls.disappearingMessages ? "Turn off disappearing" : "Disappearing messages"}</span>
            </button>
            <button type="button" onClick={() => { onToggleFavourite(); closeMenuWithNotice(userControls.favourite ? `${activeMatchProfile.display_name} removed from favourites.` : `${activeMatchProfile.display_name} added to favourites.`); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡</span>
              <span>{userControls.favourite ? "Remove favourite" : "Add to favourites"}</span>
            </button>
            <button type="button" onClick={() => { onToggleListed(); closeMenuWithNotice(userControls.listed ? `${activeMatchProfile.display_name} removed from your list.` : `${activeMatchProfile.display_name} added to your list.`); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£</span>
              <span>{userControls.listed ? "Remove from list" : "Add to list"}</span>
            </button>
            <button type="button" onClick={() => { setShowConversationMenu(false); onPlanSafeDate(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“</span>
              <span>Plan safe date</span>
            </button>
            <button type="button" onClick={() => { setShowConversationMenu(false); onSuggestMeetupSpot(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</span>
              <span>Public meet-up spots</span>
            </button>
            <button type="button" onClick={() => { setShowConversationMenu(false); onVouch(); }} disabled={hasVouched} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10 disabled:opacity-50">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</span>
              <span>{hasVouched ? `Vouched (${vouchCount})` : `Vouch (${vouchCount})`}</span>
            </button>
            <button type="button" onClick={() => { setShowConversationMenu(false); onCloseChat(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â</span>
              <span>Close chat</span>
            </button>
            <div className="my-1 border-t border-white/10"></div>
            <button type="button" onClick={() => { onReport(); setShowConversationMenu(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">!</span>
              <span>{userControls.reported ? "Reported" : "Report"}</span>
            </button>
            <button type="button" onClick={() => { onBlock(); setShowConversationMenu(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-rose-200 hover:bg-rose-500/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“</span>
              <span>{isBlocked ? "Unblock" : "Block"}</span>
            </button>
            <button type="button" onClick={() => { setMessageSearch(""); onClearChat(); closeMenuWithNotice("Chat cleared on this device. New messages will still arrive."); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢</span>
              <span>Clear chat</span>
            </button>
            <button type="button" onClick={() => { onDeleteChat(); setShowConversationMenu(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/10">
              <span className="w-4 text-center">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§</span>
              <span>Delete chat</span>
            </button>
          </div>
        ) : null}
      </div>

      {forceSearchOpen && safetySettings.chatSearch ? (
        <div className="shrink-0 border-b border-white/10 bg-[#0b1728] px-3 py-2">
          <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.25)]">
            <button
              type="button"
              onClick={() => {
                setForceSearchOpen(false);
                setMessageSearch("");
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-white/80 hover:bg-white/10"
              aria-label="Close search"
            >
              &lt;
            </button>
            <input
              value={messageSearch}
              onChange={(event) => {
                setMessageSearch(event.target.value);
                setActiveSearchIndex(0);
              }}
              autoFocus
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-white outline-none placeholder:text-white/45"
            />
            {normalizedSearch ? <span className="shrink-0 text-xs font-bold text-white/45">{searchMatchIds.length ? `${safeActiveSearchIndex + 1}/${searchMatchIds.length}` : "0/0"}</span> : null}
            <button type="button" onClick={() => moveSearch(-1)} disabled={!searchMatchIds.length} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-white hover:bg-white/10 disabled:opacity-35" aria-label="Previous result">
              ^
            </button>
            <button type="button" onClick={() => moveSearch(1)} disabled={!searchMatchIds.length} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-white hover:bg-white/10 disabled:opacity-35" aria-label="Next result">
              v
            </button>
          </div>
        </div>
      ) : null}

      {menuNotice ? (
        <div className="shrink-0 border-b border-white/10 bg-[#0b1728] px-4 py-2">
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/76">
            <span className="min-w-0 flex-1">{menuNotice}</span>
            <button type="button" onClick={() => setMenuNotice("")} className="font-black text-white/70">x</button>
          </div>
        </div>
      ) : null}

      <div ref={messagesScrollerRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain bg-[#071323] px-4 py-5">
        <p className="text-center text-sm font-bold text-white/45">{dividerLabel}</p>
        {shownMessages.length ? (
          shownMessages.map((message) => {
            const isOwnMessage = message.sender_id === activePlayerId;
            const { reply, text: messageBody } = decodeChatReply(message.body);
            const messageWarning = safetySettings.scamWarnings && !isOwnMessage ? riskyMessageWarning(messageBody) : "";
            const messageActionOpen = openActionsFor === message.id;

            return (
              <div
                key={message.id}
                ref={(node) => {
                  messageRefs.current[message.id] = node;
                }}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openMessageActions(message.id, isOwnMessage);
                }}
              >
                <div className={`max-w-[78%] ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    className={`group relative flex items-start gap-2 rounded-3xl transition ${selectedMessageId === message.id || activeSearchMessageId === message.id ? "bg-sky-400/10 p-1 ring-1 ring-sky-300/30" : ""} ${isOwnMessage ? "flex-row-reverse" : ""}`}
                    onPointerDown={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button,a,input,audio,video")) return;
                      clearMessageLongPress();
                      messageLongPressTimerRef.current = window.setTimeout(() => openMessageActionsByLongPress(message.id, isOwnMessage), 430);
                    }}
                    onPointerUp={clearMessageLongPress}
                    onPointerCancel={clearMessageLongPress}
                    onPointerLeave={clearMessageLongPress}
                    onClick={() => {
                      if (messageOpenedByLongPressRef.current) {
                        messageOpenedByLongPressRef.current = false;
                        return;
                      }
                      if (messageActionOpen) closeMessageActions();
                    }}
                    onDoubleClick={() => openMessageActions(message.id, isOwnMessage)}
                  >
                  <div className={`${isOwnMessage ? "items-end" : "items-start"} flex min-w-0 flex-col`}>
                  {isChatImageMessage(messageBody) ? (
                    <button
                      type="button"
                      onClick={() => setOpenImageUrl(chatImageUrl(messageBody))}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-left shadow-sm"
                      aria-label="Open chat picture"
                    >
                      <img src={chatImageUrl(messageBody)} alt="Chat picture" className="max-h-80 w-full object-cover" onLoad={scrollToLatestMessage} />
                    </button>
                  ) : isChatAudioMessage(messageBody) ? (
                    <div className={`rounded-[1.35rem] px-4 py-3 shadow-sm ${isOwnMessage ? "bg-blue-600" : "bg-[#152238]"}`}>
                      <audio controls src={chatAudioUrl(messageBody)} className="h-10 max-w-full" onLoadedMetadata={scrollToLatestMessage} />
                    </div>
                  ) : isChatVideoMessage(messageBody) ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-sm">
                      <video controls src={chatVideoPayload(messageBody).url} className="max-h-80 w-full" onLoadedMetadata={scrollToLatestMessage} />
                    </div>
                  ) : isChatDocumentMessage(messageBody) ? (
                    <a href={chatDocumentPayload(messageBody).url} target="_blank" rel="noreferrer" className={`flex max-w-xs items-center gap-3 rounded-[1.35rem] px-4 py-3 text-sm shadow-sm ${isOwnMessage ? "bg-blue-600 text-white" : "bg-[#152238] text-white/90"}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¾</span>
                      <span className="min-w-0">
                        <span className="block truncate font-black">{chatDocumentPayload(messageBody).name}</span>
                        <span className="text-xs opacity-70">Tap to open document</span>
                      </span>
                    </a>
                  ) : isChatContactMessage(messageBody) ? (
                    <div className={`max-w-xs rounded-[1.35rem] px-4 py-3 shadow-sm ${isOwnMessage ? "bg-blue-600 text-white" : "bg-[#152238] text-white/90"}`}>
                      <p className="text-xs font-black uppercase opacity-70">Contact</p>
                      <p className="mt-1 font-black">{chatContactPayload(messageBody).name}</p>
                      <p className="mt-1 text-xs opacity-75">{chatContactPayload(messageBody).detail}</p>
                    </div>
                  ) : isChatPollMessage(messageBody) ? (
                    <div className={`max-w-xs rounded-[1.35rem] px-4 py-3 shadow-sm ${isOwnMessage ? "bg-blue-600 text-white" : "bg-[#152238] text-white/90"}`}>
                      <p className="font-black">{chatPollPayload(messageBody).question}</p>
                      <div className="mt-3 grid gap-2">
                        {chatPollPayload(messageBody).options.map((option) => <span key={option} className="rounded-full border border-white/20 px-3 py-2 text-xs font-bold">{option}</span>)}
                      </div>
                    </div>
                  ) : isChatEventMessage(messageBody) ? (
                    <div className={`max-w-xs rounded-[1.35rem] px-4 py-3 shadow-sm ${isOwnMessage ? "bg-blue-600 text-white" : "bg-[#152238] text-white/90"}`}>
                      <p className="text-xs font-black uppercase opacity-70">Event</p>
                      <p className="mt-1 font-black">{chatEventPayload(messageBody).title}</p>
                      <p className="mt-1 text-xs opacity-75">{chatEventPayload(messageBody).detail}</p>
                    </div>
                  ) : isChatStickerMessage(messageBody) ? (
                    <div className="text-6xl leading-none drop-shadow-lg">{chatStickerValue(messageBody)}</div>
                  ) : isChatLocationMessage(messageBody) ? (
                    <a
                      href={`https://www.google.com/maps?q=${chatLocationPayload(messageBody).latitude},${chatLocationPayload(messageBody).longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`block max-w-xs rounded-[1.35rem] px-4 py-3 shadow-sm ${isOwnMessage ? "bg-blue-600 text-white" : "bg-[#152238] text-white/90"}`}
                    >
                      <p className="text-xs font-black uppercase opacity-70">Location</p>
                      <div className="mt-2 h-24 overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgba(14,165,233,0.35),rgba(34,197,94,0.22),rgba(15,23,42,0.4))]">
                        <div className="relative h-full">
                          <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300 shadow-[0_0_0_8px_rgba(125,211,252,0.2)]"></span>
                          <span className="absolute left-0 top-1/2 h-px w-full bg-white/25"></span>
                          <span className="absolute left-1/2 top-0 h-full w-px bg-white/25"></span>
                        </div>
                      </div>
                      <p className="mt-2 text-sm font-black">{chatLocationPayload(messageBody).label}</p>
                      <p className="mt-1 text-xs opacity-75">Tap to open map</p>
                    </a>
                  ) : isChatDatePlanMessage(messageBody) ? (
                    <div className={`max-w-xs rounded-[1.35rem] px-4 py-3 shadow-sm ${isOwnMessage ? "bg-blue-600 text-white" : "bg-[#152238] text-white/90"}`}>
                      <p className="text-xs font-black uppercase opacity-70">Date plan</p>
                      <p className="mt-1 text-lg font-black">{chatDatePlanPayload(messageBody).title}</p>
                      <div className="mt-3 grid gap-2 text-xs">
                        <p className="rounded-2xl bg-white/10 px-3 py-2"><span className="font-black">When:</span> {chatDatePlanPayload(messageBody).when}</p>
                        <p className="rounded-2xl bg-white/10 px-3 py-2"><span className="font-black">Where:</span> {chatDatePlanPayload(messageBody).place}</p>
                        {chatDatePlanPayload(messageBody).note ? <p className="rounded-2xl bg-white/10 px-3 py-2">{chatDatePlanPayload(messageBody).note}</p> : null}
                      </div>
                    </div>
                  ) : (
                    <div className={`break-words rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-sm ${isOwnMessage ? "bg-blue-600 text-white" : "bg-[#152238] text-white/90"}`}>
                      {reply ? <ReplyQuote reply={reply} own={isOwnMessage} /> : null}
                      {messageBody}
                    </div>
                  )}
                  </div>
                  <div className="relative">
                    {messageActionOpen && messageMenuPosition ? (
                      <div
                        className="fixed z-[120] w-64"
                        style={{ top: messageMenuPosition.top, left: messageMenuPosition.left }}
                        onClick={(event) => event.stopPropagation()}
                      >
                      <div className="relative max-h-[min(24rem,calc(100dvh-7rem))] overflow-y-auto rounded-[1.35rem] border border-white/12 bg-[linear-gradient(180deg,#162236,#0b1220)] p-2 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_18px_55px_rgba(37,99,235,0.28),0_24px_70px_rgba(0,0,0,0.58)]">
                        <span
                          className={`absolute top-5 h-3 w-3 rotate-45 border border-white/12 bg-[#162236] ${messageMenuPosition.side === "right" ? "-right-1" : "-left-1"}`}
                          aria-hidden="true"
                        />
                        <div className="mb-1 flex items-center justify-between border-b border-white/10 px-2 pb-2">
                          <button type="button" onClick={closeMessageActions} className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15">
                            Back
                          </button>
                          <span className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Message</span>
                        </div>
                        <button type="button" onClick={() => closeMenuWithNotice(`Sent ${formatSentAt(message.created_at)}${message.read_at ? `, seen ${formatSentAt(message.read_at)}` : ""}`)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10"><span className="w-5 text-center">i</span><span>Message info</span></button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(replyReferenceFor(message));
                            closeMessageActions();
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10"
                        >
                          <span>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©</span>
                          <span>Reply</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(messageBody);
                            closeMessageActions();
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10"
                        >
                          <span>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡</span>
                          <span>Copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setChatDraft(`Forwarded: ${messageBody}`);
                            closeMessageActions();
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10"
                        >
                          <span>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·</span>
                          <span>Forward</span>
                        </button>
                        <button type="button" onClick={() => closeMenuWithNotice("Pinned messages will be added to the social profile timeline soon.")} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10">
                          <span className="w-5 text-center">Pin</span>
                          <span>Pin</span>
                        </button>
                        <button type="button" onClick={() => closeMenuWithNotice("Ask AI will help summarize or suggest replies in a future upgrade.")} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10">
                          <span className="w-5 text-center">AI</span>
                          <span>Ask AI</span>
                        </button>
                        <button type="button" onClick={() => closeMenuWithNotice("Message starred.")} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10">
                          <span className="w-5 text-center">*</span>
                          <span>Star</span>
                        </button>
                        <div className="my-1 border-t border-white/10" />
                        <button type="button" onClick={() => { setSelectionMode(true); closeMessageActions(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10">
                          <span className="w-5 text-center">Sel</span>
                          <span>Select</span>
                        </button>
                        <button type="button" onClick={() => { setChatDraft(`${chatDraft} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â`); closeMessageActions(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10">
                          <span className="w-5 text-center">+</span>
                          <span>React</span>
                        </button>
                        <button type="button" onClick={() => closeMenuWithNotice("Saved to memories. We can make this permanent with a saved_messages table later.")} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/10">
                          <span className="w-5 text-center">Save</span>
                          <span>Save</span>
                        </button>
                        <div className="my-1 border-t border-white/10" />
                        <button type="button" onClick={() => { onReport(); closeMessageActions(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-amber-100 hover:bg-amber-400/10">
                          <span className="w-5 text-center">!</span>
                          <span>Report message</span>
                        </button>
                        <button type="button" onClick={() => { setDeletedMessageIds((current) => [...new Set([...current, message.id])]); closeMessageActions(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-rose-200 hover:bg-rose-500/10">
                          <span className="w-5 text-center">Del</span>
                          <span>Delete</span>
                        </button>
                      </div>
                      </div>
                    ) : null}
                  </div>
                  </div>
                  {messageWarning ? (
                    <p className="mt-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-100">
                      {messageWarning}
                    </p>
                  ) : null}
                  <p className={`mt-1 flex items-center gap-1 text-[12px] font-medium text-white/45 ${isOwnMessage ? "justify-end text-right" : "justify-start text-left"}`}>
                    {isOwnMessage ? (
                      <span className={message.read_at ? "text-emerald-400" : "text-white/45"} aria-label={message.read_at ? "Seen" : "Delivered"}>
                        &#10003;&#10003;
                      </span>
                    ) : null}
                    <span>Sent {formatSentAt(message.created_at)}</span>
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[1.5rem] bg-white/5 p-5 text-center text-sm leading-6 text-white/55">
            {activeMessages.length ? "No messages match your search." : "No messages yet. Start the conversation."}
          </div>
        )}
        {isTyping ? <p className="text-sm font-semibold text-sky-300">{activeMatchProfile.display_name} is typing...</p> : null}
        <div ref={messagesEndRef} className="h-1 shrink-0" aria-hidden="true" />
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#0b1728] px-3 py-3">
        {communicationBlocked ? (
          <div className="mb-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">
            {isBlocked
              ? `You blocked ${activeMatchProfile.display_name}. They cannot message you, call you, or see your profile in discovery. Tap Unblock above to chat again.`
              : `You cannot message ${activeMatchProfile.display_name} right now.`}
          </div>
        ) : null}
        {replyingTo ? (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border-l-4 border-sky-300 bg-white/10 px-3 py-2 text-left">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-sky-200">Replying to {replyingTo.senderName}</p>
              <p className="mt-0.5 truncate text-xs text-white/68">{replyingTo.preview}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white/70 transition hover:bg-white/15"
              aria-label="Cancel reply"
            >
              x
            </button>
          </div>
        ) : null}
        {showEmojiPicker ? (
          <div className="mb-3 grid grid-cols-8 gap-2 rounded-3xl border border-white/10 bg-[#101d31] p-3 shadow-xl">
            {chatEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setChatDraft(`${chatDraft}${emoji}`);
                  setShowEmojiPicker(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-white/10"
                aria-label={`Add ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {videoNoteState !== "idle" ? (
          <div className="rounded-[1.6rem] border border-emerald-300/25 bg-[#101827] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={resetVideoNoteDraft} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/15" aria-label="Delete video note">
                x
              </button>
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <span className={`h-2.5 w-2.5 rounded-full ${videoNoteState === "recording" ? "animate-pulse bg-rose-500" : "bg-emerald-400"}`}></span>
                <span>{videoNoteState === "recording" ? "Recording video note" : "Preview video note"}</span>
                <span className="text-white/55">{videoNoteDurationLabel}</span>
              </div>
              <button
                type="button"
                onClick={videoNoteState === "preview" ? sendVideoNotePreview : finishVideoNotePreview}
                disabled={saving}
                className="flex h-11 min-w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-60"
                aria-label={videoNoteState === "preview" ? "Send video note" : "Preview video note"}
              >
                {videoNoteState === "preview" ? "Send" : "Stop"}
              </button>
            </div>
            <div className="mx-auto mt-3 aspect-square max-h-[15rem] overflow-hidden rounded-full border border-white/15 bg-black shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
              {videoNoteState === "recording" ? (
                <video
                  ref={(node) => {
                    videoNotePreviewRef.current = node;
                    const stream = videoNoteRecorderRef.current?.stream;
                    if (node && stream && node.srcObject !== stream) {
                      node.srcObject = stream;
                      node.muted = true;
                      void node.play();
                    }
                  }}
                  muted
                  playsInline
                  className="h-full w-full scale-x-[-1] object-cover"
                />
              ) : (
                <video controls playsInline src={videoNotePreviewUrl} className="h-full w-full object-cover" />
              )}
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-white/60">
              {videoNoteState === "recording" ? "Show your face and talk. Stop to preview before sending." : "Watch it first, then send or delete."}
            </p>
          </div>
        ) : voiceRecorderState !== "idle" ? (
          <div className="flex items-center gap-3 rounded-full bg-white px-3 py-2 text-slate-950 shadow-[0_12px_35px_rgba(0,0,0,0.25)]">
            <button type="button" onClick={resetVoiceDraft} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-800 transition hover:bg-slate-100" aria-label="Delete voice note">
              ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ
            </button>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${voiceRecorderState === "recording" ? "animate-pulse bg-rose-600" : "bg-slate-400"}`}></span>
            <span className="w-11 shrink-0 text-base font-semibold tabular-nums">{voiceDurationLabel}</span>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden px-1">
              {voiceRecorderState === "preview" && voicePreviewUrl ? (
                <audio controls src={voicePreviewUrl} className="h-9 w-full min-w-40" />
              ) : (
                Array.from({ length: 28 }).map((_, index) => (
                  <span
                    key={index}
                    className={`w-1 rounded-full bg-slate-500 ${voiceRecorderState === "recording" ? "animate-pulse" : ""}`}
                    style={{ height: `${8 + ((index * 7) % 24)}px`, animationDelay: `${index * 45}ms` }}
                  />
                ))
              )}
            </div>
            {voiceRecorderState === "preview" ? null : (
              <button
                type="button"
                onClick={voiceRecorderState === "recording" ? pauseVoiceRecording : resumeVoiceRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black text-rose-700 transition hover:bg-rose-50"
                aria-label={voiceRecorderState === "recording" ? "Pause recording" : "Resume recording"}
              >
                {voiceRecorderState === "recording" ? "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡" : "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶"}
              </button>
            )}
            <button
              type="button"
              onClick={voiceRecorderState === "preview" ? sendVoicePreview : finishVoicePreview}
              disabled={saving}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl font-black text-white transition hover:bg-emerald-400 disabled:opacity-60"
              aria-label={voiceRecorderState === "preview" ? "Send voice note" : "Preview voice note"}
            >
              ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button onClick={() => setShowEmojiPicker((current) => !current)} className="mb-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-sky-300 transition hover:bg-white/10 sm:flex" aria-label="Choose emoji">
              <SmileIcon />
            </button>
            <div className="relative flex min-w-0 flex-1 items-end gap-2 rounded-[1.45rem] border border-white/10 bg-[#243041] px-3 py-2 shadow-inner focus-within:border-emerald-400/65 focus-within:ring-2 focus-within:ring-emerald-400/15">
              <button onClick={() => setShowEmojiPicker((current) => !current)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sky-300 transition hover:bg-white/10 sm:hidden" aria-label="Choose emoji">
                <SmileIcon />
              </button>
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                disabled={communicationBlocked}
                rows={composerRows}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendCurrentMessage();
                  }
                }}
                placeholder={communicationBlocked ? (isBlocked ? "Unblock to message" : "Messaging unavailable") : "Message"}
                className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 text-white outline-none placeholder:text-white/45 disabled:opacity-60"
              />
              <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowAttachMenu((current) => !current)}
                disabled={communicationBlocked || saving}
                className="flex h-9 w-9 items-center justify-center rounded-full text-2xl text-sky-300 transition hover:bg-white/10 disabled:opacity-40"
                aria-label="Attach"
              >
                +
              </button>
              {showAttachMenu ? (
                <div className="absolute bottom-12 left-0 z-40 w-56 overflow-hidden rounded-2xl bg-white py-2 text-sm font-semibold text-slate-800 shadow-[0_22px_70px_rgba(0,0,0,0.38)]">
                  <button type="button" onClick={() => documentInputRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-indigo-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£</span><span>Document</span></button>
                  <button type="button" onClick={() => mediaInputRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-blue-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£</span><span>Photos & videos</span></button>
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-pink-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£</span><span>Camera</span></button>
                  <button type="button" onClick={() => audioInputRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-orange-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£</span><span>Audio</span></button>
                  <button type="button" onClick={sendContactAttachment} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-sky-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â</span><span>Contact</span></button>
                  <button type="button" onClick={sendPollAttachment} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-amber-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡</span><span>Poll</span></button>
                  <button type="button" onClick={sendEventAttachment} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-rose-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</span><span>Event</span></button>
                  <button type="button" onClick={sendLocationAttachment} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-lime-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</span><span>Location</span></button>
                  <button type="button" onClick={sendDatePlanAttachment} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-fuchsia-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥</span><span>Date plan</span></button>
                  <button type="button" onClick={sendStickerAttachment} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"><span className="text-emerald-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡</span><span>New sticker</span></button>
                </div>
              ) : null}
              <input ref={documentInputRef} type="file" className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => handleAttachmentInput(event, "document")} />
              <input ref={mediaInputRef} type="file" className="sr-only" accept="image/*,video/*" onChange={(event) => handleAttachmentInput(event, "media")} />
              <input ref={cameraInputRef} type="file" className="sr-only" accept="image/*" capture="environment" onChange={(event) => handleAttachmentInput(event, "camera")} />
              <input ref={audioInputRef} type="file" className="sr-only" accept="audio/*" onChange={(event) => handleAttachmentInput(event, "audio")} />
            </div>
            <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-sky-300 transition hover:bg-white/10" aria-label="Send picture">
              <PhotoIcon />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={saving || communicationBlocked}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onImageSend(file);
                }}
              />
            </label>
            </div>
            <button
              onClick={() => void startVideoNoteRecording()}
              disabled={communicationBlocked}
              className={`${chatDraft.trim() ? "hidden" : "flex"} h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_12px_30px_rgba(14,165,233,0.28)] transition hover:bg-sky-400 disabled:opacity-40`}
              aria-label="Record video note"
            >
              <VideoIcon />
            </button>
            <button
              onClick={() => void startVoiceRecording()}
              disabled={communicationBlocked}
              className={`${chatDraft.trim() ? "hidden" : "flex"} h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_30px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:opacity-40`}
              aria-label="Record voice message"
            >
              <MicIcon />
            </button>
            <button onClick={chatDraft.trim() ? sendCurrentMessage : () => onQuickSend("\u{1F44D}")} disabled={saving || communicationBlocked} className={`${chatDraft.trim() ? "flex" : "hidden"} h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 disabled:opacity-60`} aria-label={chatDraft.trim() ? "Send message" : "Send like"}>
              Send
            </button>
          </div>
        )}
        {draftWarning ? <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-100">{draftWarning}</p> : null}
        {voiceRecorderState === "preview" ? <p className="mt-2 text-center text-xs font-semibold text-emerald-200">Listen first, then send or delete.</p> : null}
        <button onClick={onCommit} disabled={saving || communicationBlocked || Boolean(partnerLabel) || officialButtonLabel === "Official request sent"} className="mt-3 w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-60">
          {partnerLabel || officialButtonLabel}
        </button>
      </div>

      {openImageUrl ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/95 p-4" onClick={() => setOpenImageUrl("")}>
          <button
            type="button"
            onClick={() => setOpenImageUrl("")}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl font-black text-white backdrop-blur transition hover:bg-white/20"
            aria-label="Close picture"
          >
            x
          </button>
          <img
            src={openImageUrl}
            alt="Opened chat picture"
            className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-[0_28px_90px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

function CallOverlay({
  callState,
  callDurationSeconds,
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
}: {
  callState: CallState;
  callDurationSeconds: number;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
}) {
  const isVideo = callState.kind === "video";
  const isIncoming = callState.status === "incoming";
  const formatCallDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return hours
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
      : `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };
  const statusLabel =
    callState.status === "incoming"
      ? `Incoming ${isVideo ? "video" : "voice"} call`
      : callState.status === "calling"
        ? "Calling..."
        : callState.status === "ringing"
          ? "Ringing..."
        : callState.status === "connecting"
          ? "Connecting..."
          : callDurationSeconds > 0
            ? formatCallDuration(callDurationSeconds)
            : "Answered";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur">
      <div className="relative flex h-full max-h-[46rem] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#071323] text-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0b1728] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/70">{statusLabel}</p>
            <h2 className="mt-1 truncate text-2xl font-black">{callState.peerName}</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/75">{isVideo ? "Video" : "Voice"}</span>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#030b16]">
          {isVideo ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full bg-black object-cover" />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 h-32 w-24 rounded-2xl border border-white/20 bg-black object-cover shadow-xl"
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-blue-600 text-5xl font-black shadow-[0_0_60px_rgba(37,99,235,0.55)]">
                {callState.peerName.slice(0, 1).toUpperCase()}
              </div>
              <p className="mt-6 text-lg font-semibold text-white/80">{callState.status === "connected" ? (callDurationSeconds > 0 ? `Call time ${formatCallDuration(callDurationSeconds)}` : "Answered") : statusLabel}</p>
              <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
              <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#0b1728] px-5 py-5">
          {isIncoming ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onReject} className="rounded-full bg-rose-600 px-5 py-4 font-black text-white shadow-lg transition hover:bg-rose-500">
                Decline
              </button>
              <button onClick={onAccept} className="rounded-full bg-emerald-500 px-5 py-4 font-black text-slate-950 shadow-lg transition hover:bg-emerald-400">
                Answer
              </button>
            </div>
          ) : (
            <button onClick={onEnd} className="w-full rounded-full bg-rose-600 px-5 py-4 font-black text-white shadow-lg transition hover:bg-rose-500">
              End Call
            </button>
          )}
          {localStream ? <p className="mt-3 text-center text-xs font-semibold text-white/45">Mic {isVideo ? "and camera" : ""} are active</p> : null}
        </div>
      </div>
    </div>
  );
}
function OwnProfileCard({ profile, fallbackName, fallbackAge, fallbackCountry }: { profile?: DatingProfile; fallbackName: string; fallbackAge: number; fallbackCountry: string; }) {
  const partnerLabel = officialPartnerLabel(profile);
  return (
    <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#101827] shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
      <div className="border-b border-white/10 bg-white/[0.03] p-4">
        <div className="flex gap-4">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
            {profile?.photo_url ? <img src={profile.photo_url} alt="Your dating profile" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 text-2xl font-black leading-tight">{profile?.display_name || fallbackName}, {profile?.age || fallbackAge}</h3>
              {isProfileVerified(profile) ? <span className="rounded-full bg-sky-400 px-2 py-1 text-[10px] font-bold text-slate-950">Verified</span> : null}
            </div>
            <p className="mt-2 text-sm font-semibold text-white/65">{profile?.location_label || profile?.city || fallbackCountry}</p>
            <p className="mt-3 text-sm font-bold text-white/86">{profile?.relationship_goal || "Still figuring it out"}</p>
            {partnerLabel ? <p className="mt-3 rounded-2xl bg-emerald-400/12 px-3 py-2 text-xs font-black text-emerald-100">{partnerLabel}</p> : null}
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Profile summary</p>
        <p className="mt-3 text-sm leading-7 text-white/80">{profile?.bio || "Finish your profile setup to appear in Swipe and Explore."}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl bg-white/5 px-3 py-3">
            <p className="font-black text-white">Visibility</p>
            <p className="mt-1 text-white/60">{profile?.is_active ? "Discoverable" : "Paused"}</p>
          </div>
          <div className="rounded-2xl bg-white/5 px-3 py-3">
            <p className="font-black text-white">Status</p>
            <p className="mt-1 text-white/60">{partnerLabel ? "Taken" : "Available"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{(profile?.interests || []).map((interest) => <span key={interest} className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/75">{interest}</span>)}</div>
      </div>
    </div>
  );
}

