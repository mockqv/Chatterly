import { useState } from 'react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export const MessageInput = ({ onSendMessage, disabled }: MessageInputProps) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="flex p-4 border-t border-gray-700 gap-3 flex-shrink-0">
      <input
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        className="flex-1 p-3 rounded-lg bg-[#333] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
        placeholder="Digite sua mensagem..."
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSendMessage();
          }
        }}
        disabled={disabled}
      />
      <button
        onClick={handleSendMessage}
        className="bg-pink-500 hover:bg-pink-600 px-6 py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!newMessage.trim() || disabled}
      >
        Enviar
      </button>
    </div>
  );
}; 