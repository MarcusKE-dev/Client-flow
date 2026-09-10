import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Save, 
  Check, 
  Clock, 
  Volume2
} from 'lucide-react';
import { db, queueMutation, generateId } from '../../db';
import type { Customer, CustomerFile, Interaction } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface VoiceNoteModalProps {
  customerId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export const VoiceNoteModal: React.FC<VoiceNoteModalProps> = ({
  customerId,
  onClose,
  onSaved
}) => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId || '');
  const [noteTitle, setNoteTitle] = useState('Voice note ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  
  // MediaRecorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      const all = await db.customers.toArray();
      setCustomers(all.filter(c => !c.isArchived));
      if (!selectedCustomerId && all.length > 0) {
        setSelectedCustomerId(all[0].id);
      }
    }
    loadCustomers();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      setErrorMsg('Microphone access unavailable. Please grant microphone permission in your browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSaveVoiceNote = async () => {
    if (!audioBlob || !selectedCustomerId || !user) return;
    setIsSaving(true);
    try {
      // Convert audioBlob to Base64 dataUrl
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const now = new Date();
        const fileId = generateId('file_voice');
        
        const customerFile: CustomerFile = {
          id: fileId,
          userId: user.id,
          customerId: selectedCustomerId,
          name: `${noteTitle.trim() || 'Voice Note'}.webm`,
          type: 'voice_note',
          mimeType: 'audio/webm',
          size: audioBlob.size,
          dataUrl: base64Data,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };

        await db.files.add(customerFile);
        await queueMutation('insert', 'files', fileId, customerFile);

        // Also add interaction log
        const intId = generateId('int_voice');
        const interaction: Interaction = {
          id: intId,
          userId: user.id,
          customerId: selectedCustomerId,
          type: 'note',
          date: now.toISOString().split('T')[0],
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          summary: `Voice note recorded (${formatDuration(recordingDuration)})`,
          outcome: noteTitle.trim(),
          voiceNoteUrl: base64Data,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };
        await db.interactions.add(interaction);
        await queueMutation('insert', 'interactions', intId, interaction);

        setIsSaving(false);
        if (onSaved) onSaved();
        onClose();
      };
    } catch (err) {
      console.error('Failed to save voice note:', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-[#E5E7EB] w-full max-w-md overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#1D70F5] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            <div>
              <h2 className="font-bold text-base tracking-tight leading-tight">Voice Note</h2>
              <p className="text-[11px] text-white/80">Record and store audio memo offline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-sm">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
              Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Note Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
              Note Title / Context
            </label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded focus:border-[#1D70F5] focus:outline-none"
              placeholder="e.g. Post-meeting debrief on family medical terms"
            />
          </div>

          {/* Recording / Playback Center */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-5 flex flex-col items-center justify-center text-center">
            {/* Audio Timer */}
            <div className="text-3xl font-mono font-bold text-[#111827] mb-3">
              {formatDuration(recordingDuration)}
            </div>

            {!audioBlob ? (
              // Recording controls
              <div className="flex flex-col items-center">
                {isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md animate-pulse cursor-pointer"
                  >
                    <Square className="w-6 h-6 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full bg-[#1D70F5] hover:bg-[#1B2CC1] text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  >
                    <Mic className="w-7 h-7" />
                  </button>
                )}
                <span className="text-xs text-[#6B7280] mt-3 font-medium">
                  {isRecording ? 'Recording... Tap square to stop' : 'Tap mic to start recording'}
                </span>
              </div>
            ) : (
              // Playback controls
              <div className="w-full flex flex-col items-center">
                <audio
                  ref={audioPlayerRef}
                  src={audioUrl || ''}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="w-12 h-12 rounded-full bg-[#1D70F5] hover:bg-[#1B2CC1] text-white flex items-center justify-center cursor-pointer shadow-sm"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
                  </button>
                  <button
                    type="button"
                    onClick={deleteRecording}
                    className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] hover:bg-red-50 text-red-600 flex items-center justify-center cursor-pointer transition-colors"
                    title="Delete and re-record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-emerald-700 font-medium mt-3 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Audio ready ({formatDuration(recordingDuration)})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#6B7280] hover:text-[#111827] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!audioBlob || isSaving || !selectedCustomerId}
            onClick={handleSaveVoiceNote}
            className="px-4 py-2 text-xs font-semibold bg-[#1D70F5] hover:bg-[#1B2CC1] text-white rounded cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Attach to Customer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
