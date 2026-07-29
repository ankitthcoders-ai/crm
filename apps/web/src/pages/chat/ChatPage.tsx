import { useEffect, useState, useRef } from 'react';
import { Send, Users, Hash, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { 
  setRooms, 
  setActiveRoom, 
  setMessages, 
  addMessage, 
  updateMessage, 
  deleteMessage,
  setTyping 
} from '@/store/slices/chatSlice';
import { api, getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { getSocket } from '@/hooks/useSocket';

export function ChatPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { rooms, activeRoomId, messagesByRoom, typingUsersByRoom } = useAppSelector((s) => s.chat);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Rooms
  useEffect(() => {
    api.get('/chat/rooms')
      .then((res) => {
        dispatch(setRooms(res.data.data ?? []));
        if (res.data.data?.length > 0 && !activeRoomId) {
          dispatch(setActiveRoom(res.data.data[0].id));
        }
      })
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => setLoadingRooms(false));
  }, [dispatch, activeRoomId]);

  // Handle Socket Events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg: any) => {
      dispatch(addMessage({ roomId: msg.roomId, message: msg }));
    };
    const onUpdateMessage = (msg: any) => {
      dispatch(updateMessage({ roomId: msg.roomId, message: msg }));
    };
    const onDeleteMessage = (data: any) => {
      dispatch(deleteMessage({ roomId: data.roomId, messageId: data.messageId }));
    };
    const onTyping = (data: any) => {
      dispatch(setTyping(data));
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:updated', onUpdateMessage);
    socket.on('message:deleted', onDeleteMessage);
    socket.on('chat:typing', onTyping);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:updated', onUpdateMessage);
      socket.off('message:deleted', onDeleteMessage);
      socket.off('chat:typing', onTyping);
    };
  }, [dispatch]);

  // Load Messages for Active Room
  useEffect(() => {
    if (!activeRoomId) return;

    // Join room channel
    const socket = getSocket();
    socket?.emit('chat:join', activeRoomId);

    // Fetch message history
    if (!messagesByRoom[activeRoomId]) {
      api.get(`/chat/rooms/${activeRoomId}/messages`)
        .then((res) => {
          dispatch(setMessages({ roomId: activeRoomId, messages: res.data.data ?? [] }));
        })
        .catch((e) => toast.error(getApiErrorMessage(e)));
    }

    return () => {
      socket?.emit('chat:leave', activeRoomId);
    };
  }, [activeRoomId, dispatch, messagesByRoom]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByRoom, activeRoomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeRoomId) return;

    const text = messageText;
    setMessageText(''); // Optimistic clear
    
    // Stop typing indicator
    const socket = getSocket();
    socket?.emit('chat:typing', { roomId: activeRoomId, isTyping: false });

    try {
      await api.post(`/chat/rooms/${activeRoomId}/messages`, { content: text });
      // The backend broadcasts the new message via socket
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setMessageText(text); // Restore on error
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    const socket = getSocket();
    if (socket && activeRoomId) {
      socket.emit('chat:typing', { roomId: activeRoomId, isTyping: e.target.value.length > 0 });
    }
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const messages = activeRoomId ? (messagesByRoom[activeRoomId] || []) : [];
  const typingUsers = activeRoomId ? (typingUsersByRoom[activeRoomId] || []) : [];

  const getRoomName = (room: any) => {
    if (!room.isDirect) return room.name || 'Group Chat';
    const otherMember = room.members?.find((m: any) => m.user.id !== user?.id)?.user;
    return otherMember ? `${otherMember.firstName} ${otherMember.lastName}` : 'User';
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background border-t -m-4 sm:-m-6 lg:-m-8">
      {/* Sidebar - Rooms List */}
      <div className="w-80 border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Chats
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
          ) : rooms.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No chats available</div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => dispatch(setActiveRoom(room.id))}
                className={`w-full text-left p-4 flex items-center gap-3 hover:bg-muted transition-colors border-b last:border-b-0 ${
                  activeRoomId === room.id ? 'bg-muted border-l-4 border-l-primary' : ''
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={room.isDirect ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}>
                    {room.isDirect ? <UserIcon className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{getRoomName(room)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {room.messages?.[0]?.content || 'No messages yet'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRoom ? (
          <>
            <div className="p-4 border-b bg-card flex flex-col">
              <h2 className="font-semibold text-lg">{getRoomName(activeRoom)}</h2>
              <span className="text-xs text-muted-foreground">
                {activeRoom.isDirect ? 'Direct Message' : 'Project Channel'}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.sender.id === user?.id;
                const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender.id !== msg.sender.id);
                
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-2 max-w-[70%] ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && (
                        <div className="w-8 flex-shrink-0">
                          {showAvatar && (
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{msg.sender.firstName[0]}{msg.sender.lastName[0]}</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                      
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showAvatar && (
                          <span className="text-xs text-muted-foreground ml-1 mb-1">
                            {msg.sender.firstName} {msg.sender.lastName}
                          </span>
                        )}
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-muted text-foreground rounded-tl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {typingUsers.length > 0 && (
                <div className="flex items-center text-xs text-muted-foreground gap-2 pl-10">
                  <div className="flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                  </div>
                  Someone is typing...
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-card border-t">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  placeholder="Type your message..."
                  className="flex-1"
                  value={messageText}
                  onChange={handleTyping}
                />
                <Button type="submit" size="icon" disabled={!messageText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
