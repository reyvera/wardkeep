'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (userMessage: string) =>
      apiClient.post<ChatResponse>('/chat', {
        message: userMessage,
        history: messages.slice(-10),
      }),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message, verifiedData: data.verifiedData },
      ]);
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
      <h1 className="text-2xl font-bold mb-4">AI Chat</h1>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-white shadow-sm p-4 mb-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center mt-8">
            Ask me about your finances, budget, or spending patterns.
          </p>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.verifiedData && Object.keys(msg.verifiedData).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                    <p className="font-medium">Verified data:</p>
                    <pre className="mt-1 overflow-x-auto">
                      {JSON.stringify(msg.verifiedData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-500">
                Thinking...
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {chatMutation.isError && (
        <p className="mb-2 text-sm text-red-600">{chatMutation.error.message}</p>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={chatMutation.isPending}
        />
        <button
          type="submit"
          disabled={chatMutation.isPending || !input.trim()}
          className="rounded-md bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
