'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Send, MessageSquare, Bot, User } from 'lucide-react';

type ReadinessPillar = 'protection' | 'provision' | 'preparation' | 'prosperity';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  verifiedData?: Record<string, unknown>;
  readinessReferences?: ReadinessPillar[];
}

interface ChatResponse {
  message: string;
  verifiedData?: Record<string, unknown>;
  readinessReferences?: ReadinessPillar[];
}

const QUICK_PROMPTS = [
  'Explain my readiness score.',
  'What should I prioritize next?',
  'What should I review if I lose my job?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (userMessage: string) => apiClient.post<ChatResponse>('/chat', { query: userMessage }),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.message,
        verifiedData: data.verifiedData,
        readinessReferences: data.readinessReferences,
      }]);
    },
  });

  const sendMessage = (message: string) => {
    const userMessage = message.trim();
    if (!userMessage) return;
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    chatMutation.mutate(userMessage);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-page-title text-content-primary">Advisor</h1>
        <p className="text-sm text-content-tertiary mt-1">Ask about your finances, readiness, budget, or spending patterns. Calculations remain verified against your records.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              className="btn-secondary text-xs"
              onClick={() => sendMessage(prompt)}
              disabled={chatMutation.isPending}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto card mb-4 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={40} className="text-content-tertiary mb-3" />
            <p className="text-content-secondary text-sm">No messages yet</p>
            <p className="text-content-tertiary text-xs mt-1">Try a prompt above or ask about your recorded finances.</p>
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
                {msg.readinessReferences && msg.readinessReferences.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-edge pt-2 text-xs">
                    <span className="text-content-tertiary">Related readiness:</span>
                    {msg.readinessReferences.map((pillar) => (
                      <Link
                        key={pillar}
                        href={`/dashboard/readiness/${pillar}`}
                        className="text-accent-blue hover:underline"
                      >
                        {pillar.charAt(0).toUpperCase() + pillar.slice(1)}
                      </Link>
                    ))}
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
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your Advisor..." className="input flex-1" disabled={chatMutation.isPending} />
        <button type="submit" disabled={chatMutation.isPending || !input.trim()} className="btn-primary"><Send size={16} /></button>
      </form>
    </div>
  );
}
