import { useState, useRef } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/utils/supabase';
import { UserMetadata } from '@/interfaces/IHome';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  currentUser: UserMetadata;
}

export const MessageInput = ({ onSendMessage, disabled, currentUser }: MessageInputProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const fileName = `${currentUser.id}/${uuidv4()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('files')
        .getPublicUrl(fileName);

      if (!data.publicUrl) {
          throw new Error("Could not get public URL for the file.");
      }
      
      const publicUrl = data.publicUrl;

      onSendMessage(publicUrl);

    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex p-4 border-t border-gray-700 gap-3 flex-shrink-0 items-center">
      {/* Botão de Anexo */}
      <button
        onClick={handleFileSelect}
        className="p-3 rounded-full hover:bg-[#333] transition duration-200 disabled:opacity-50 disabled:cursor-wait"
        disabled={isUploading || disabled}
        aria-label="Anexar arquivo"
      >
        <Paperclip className="text-gray-400" size={24} />
      </button>
      
      {/* Input de Arquivo Oculto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,application/pdf"
      />

      {/* Input de Texto */}
      <input
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        className="flex-1 p-3 rounded-lg bg-[#333] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
        placeholder={isUploading ? "Enviando arquivo..." : "Digite sua mensagem..."}
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !isUploading) {
            handleSendMessage();
          }
        }}
        disabled={disabled || isUploading}
      />

      {/* Botão de Enviar */}
      <button
        onClick={handleSendMessage}
        className="bg-pink-500 hover:bg-pink-600 px-6 py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!newMessage.trim() || disabled || isUploading}
      >
        {isUploading ? "Aguarde" : "Enviar"}
      </button>
    </div>
  );
};