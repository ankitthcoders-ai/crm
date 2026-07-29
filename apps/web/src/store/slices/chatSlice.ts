import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: ChatUser;
}

export interface ChatRoom {
  id: string;
  name?: string;
  isDirect: boolean;
  projectId?: string;
  members: { user: ChatUser }[];
  project?: { name: string };
  messages: ChatMessage[]; // latest message
  _count: { messages: number };
}

interface ChatState {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  messagesByRoom: Record<string, ChatMessage[]>;
  typingUsersByRoom: Record<string, string[]>;
}

const initialState: ChatState = {
  rooms: [],
  activeRoomId: null,
  messagesByRoom: {},
  typingUsersByRoom: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setRooms: (state, action: PayloadAction<ChatRoom[]>) => {
      state.rooms = action.payload;
    },
    setActiveRoom: (state, action: PayloadAction<string | null>) => {
      state.activeRoomId = action.payload;
    },
    setMessages: (state, action: PayloadAction<{ roomId: string; messages: ChatMessage[] }>) => {
      state.messagesByRoom[action.payload.roomId] = action.payload.messages;
    },
    addMessage: (state, action: PayloadAction<{ roomId: string; message: ChatMessage }>) => {
      const { roomId, message } = action.payload;
      if (!state.messagesByRoom[roomId]) {
        state.messagesByRoom[roomId] = [];
      }
      // Ensure we don't duplicate
      if (!state.messagesByRoom[roomId].some((m) => m.id === message.id)) {
        state.messagesByRoom[roomId].push(message);
      }
      
      // Update latest message in rooms list
      const roomIndex = state.rooms.findIndex((r) => r.id === roomId);
      if (roomIndex >= 0) {
        state.rooms[roomIndex].messages = [message];
        // Move room to top
        const [room] = state.rooms.splice(roomIndex, 1);
        state.rooms.unshift(room);
      }
    },
    updateMessage: (state, action: PayloadAction<{ roomId: string; message: ChatMessage }>) => {
      const { roomId, message } = action.payload;
      if (state.messagesByRoom[roomId]) {
        const idx = state.messagesByRoom[roomId].findIndex((m) => m.id === message.id);
        if (idx >= 0) {
          state.messagesByRoom[roomId][idx] = message;
        }
      }
    },
    deleteMessage: (state, action: PayloadAction<{ roomId: string; messageId: string }>) => {
      const { roomId, messageId } = action.payload;
      if (state.messagesByRoom[roomId]) {
        state.messagesByRoom[roomId] = state.messagesByRoom[roomId].filter((m) => m.id !== messageId);
      }
    },
    setTyping: (state, action: PayloadAction<{ roomId: string; userId: string; isTyping: boolean }>) => {
      const { roomId, userId, isTyping } = action.payload;
      if (!state.typingUsersByRoom[roomId]) {
        state.typingUsersByRoom[roomId] = [];
      }
      const typingSet = new Set(state.typingUsersByRoom[roomId]);
      if (isTyping) {
        typingSet.add(userId);
      } else {
        typingSet.delete(userId);
      }
      state.typingUsersByRoom[roomId] = Array.from(typingSet);
    },
  },
});

export const {
  setRooms,
  setActiveRoom,
  setMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  setTyping,
} = chatSlice.actions;

export default chatSlice.reducer;
