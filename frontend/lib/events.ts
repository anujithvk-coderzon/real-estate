// Browser events that let separate parts of the page know something changed.

// Fired by Settings after the name is saved; the sidebar reloads the user.
export const PROFILE_UPDATED = "profile-updated";

// Fired after a thread is read or a message is sent; the sidebar refetches its
// unread total rather than guessing at the new number.
export const CHAT_UNREAD_CHANGED = "chat-unread-changed";
