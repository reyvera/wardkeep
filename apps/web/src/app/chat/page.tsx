'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Send, MessageSquare, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  verifiedData?: Record<string, unknown>;
}

interface ChatResponse {
  message: string;
  verifiedData?: Record<string, unknown>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (userMessage: string) => apiClient.post<ChatResponse>('/chat', { query: userMessage }),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message, verifiedData: data.verifiedData }]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    chatMutation.mutate(userMessage);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-page-title text-content-primary">AI Chat</h1>
        <p className="text-sm text-content-tertiary mt-1">Ask about your finances, budget, or spending patterns</p>
      </div>

      <div className="flex-1 overflow-y-auto card mb-4 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={40} className="text-content-tertiary mb-3" />
            <p className="text-content-secondary text-sm">No messages yet</p>
            <p className="text-content-tertiary text-xs mt-1">Try asking &quot;What did I spend the most on this month?&quot;</p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-blue/10 flex items-center justify-center">
                  <Bot size={14} className="text-accent-blue" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-accent-blue text-white' : 'bg-surface-elevated text-content-primary'}`}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.verifiedData && Object.keys(msg.verifiedData).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-edge text-xs text-content-tertiary">
                    <p className="font-medium text-content-secondary">Verified data:</p>
                    <pre className="mt-1 overflow-x-auto">{JSON.stringify(msg.verifiedData, null, 2)}</pre>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-purple/10 flex items-center justify-center">
                  <User size={14} className="text-accent-purple" />
                </div>
              )}
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-blue/10 flex items-center justify-center">
                <Bot size={14} className="text-accent-blue" />
              </div>
              <div className="rounded-xl bg-surface-elevated px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-content-tertiary animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-content-tertiary animate-pulse [animation-delay:150ms]" />
                  <div className="w-2 h-2 rounded-full bg-content-tertiary animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {chatMutation.isError && (
        <div className="mb-2 rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-2">
          <p className="text-sm text-accent-red">{chatMutation.error.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question..." className="input flex-1" disabled={chatMutation.isPending} />
        <button type="submit" disabled={chatMutation.isPending || !input.trim()} className="btn-primary"><Send size={16} /></button>
      </form>
    </div>
  );
}
