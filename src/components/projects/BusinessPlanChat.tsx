import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { generateWithOpenAI, textToSpeech } from '../../lib/openai';
import { Mic, MicOff, Upload, Send, Loader2, X, FileUp, MessageSquare, Sparkles, Info, Volume2, VolumeX, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { BusinessPlanTemplate } from './BusinessPlanGenerator';

interface BusinessPlanChatProps {
  projectId: string;
  currentPlan: string | null;
  onUpdatePlan: (newContent: string) => Promise<void>;
  activeSection: string | null;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  audioUrl?: string;
}

interface StatusUpdate {
  timestamp: Date;
  section: string;
  field: string;
  content: string;
  saved: boolean;
}

// Approximate number of characters per token (English text)
const CHARS_PER_TOKEN = 4;
// Maximum tokens we want to use for the document content (reduced to stay well under the model's limit)
const MAX_DOCUMENT_TOKENS = 4000; // Reduced from 10000 to ensure we stay under limits
// Maximum characters to include from the document
const MAX_DOCUMENT_CHARS = MAX_DOCUMENT_TOKENS * CHARS_PER_TOKEN;

const BusinessPlanChat: React.FC<BusinessPlanChatProps> = ({
  projectId,
  currentPlan,
  onUpdatePlan,
  activeSection,
  onClose
}) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [businessPlanTemplate, setBusinessPlanTemplate] = useState<BusinessPlanTemplate | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [projectDetails, setProjectDetails] = useState<any>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentVoice, setCurrentVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('nova');
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [showStatusPanel, setShowStatusPanel] = useState(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      recognitionRef.current = new window.SpeechRecognition();
    }

    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setTranscript(transcript);
        
        if (event.results[current].isFinal) {
          setMessage(prev => prev + ' ' + transcript);
          recognition.stop();
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      chatHistory.forEach(msg => {
        if (msg.audioUrl) {
          URL.revokeObjectURL(msg.audioUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!projectId) return;
      
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
          
        if (error) throw error;
        setProjectDetails(data);
      } catch (err) {
        console.error('Error fetching project details:', err);
      }
    };
    
    fetchProjectDetails();
  }, [projectId]);

  useEffect(() => {
    if (currentPlan) {
      try {
        const parsed = JSON.parse(currentPlan) as BusinessPlanTemplate;
        setBusinessPlanTemplate(parsed);
        
        const initialMessages: ChatMessage[] = [
          {
            role: 'system',
            content: 'I am your business plan assistant. I will help you develop your permaculture business plan through conversation.'
          }
        ];
        
        let welcomeMessage = '';
        
        if (activeSection) {
          welcomeMessage = `I see you want to work on the ${formatSectionTitle(activeSection)} section of your business plan. What specific aspects would you like to develop or improve?`;
        } else {
          welcomeMessage = 'Welcome to the Business Plan Assistant! I can help you develop your permaculture business plan through conversation. What section would you like to work on today?';
        }
        
        initialMessages.push({
          role: 'assistant',
          content: welcomeMessage
        });
        
        setChatHistory(initialMessages);
        
        if (voiceEnabled && user) {
          generateAndPlayAudio(welcomeMessage);
        }
        
      } catch (e) {
        const welcomeMessage = 'Welcome to the Business Plan Assistant! I can help you develop your permaculture business plan through conversation. What would you like to work on today?';
        
        setChatHistory([
          {
            role: 'system',
            content: 'I am your business plan assistant. I will help you develop your permaculture business plan through conversation.'
          },
          {
            role: 'assistant',
            content: welcomeMessage
          }
        ]);
        
        if (voiceEnabled && user) {
          generateAndPlayAudio(welcomeMessage);
        }
      }
    }
  }, [currentPlan, activeSection, user, voiceEnabled]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const generateAndPlayAudio = async (text: string) => {
    if (!user || !voiceEnabled) return;
    
    setIsGeneratingAudio(true);
    
    try {
      const audioUrl = await textToSpeech({
        userId: user.id,
        text,
        voice: currentVoice
      });
      
      setChatHistory(prev => {
        const newHistory = [...prev];
        const lastAssistantIndex = [...newHistory].reverse().findIndex(msg => msg.role === 'assistant');
        
        if (lastAssistantIndex !== -1) {
          const actualIndex = newHistory.length - 1 - lastAssistantIndex;
          newHistory[actualIndex] = {
            ...newHistory[actualIndex],
            audioUrl
          };
        }
        
        return newHistory;
      });
      
      playAudio(audioUrl);
      
    } catch (err) {
      console.error('Error generating audio:', err);
      setError('Failed to generate audio. Please check your OpenAI API key.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => {
      setIsSpeaking(false);
      audioRef.current = null;
    };
    audio.onerror = () => {
      console.error('Error playing audio');
      setIsSpeaking(false);
      audioRef.current = null;
    };
    
    audio.play().catch(err => {
      console.error('Error playing audio:', err);
      setIsSpeaking(false);
    });
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      recognitionRef.current.start();
    }
  };

  const toggleVoiceOutput = () => {
    setVoiceEnabled(!voiceEnabled);
    stopAudio();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setProcessing(true);
    setError(null);

    try {
      const text = await readFileAsText(file);
      
      const truncatedText = text.length > MAX_DOCUMENT_CHARS 
        ? text.substring(0, MAX_DOCUMENT_CHARS) + '...'
        : text;
      
      const userMessage = `I'm uploading a document titled "${file.name}" for analysis.${
        text.length > MAX_DOCUMENT_CHARS 
          ? ` Note: The document has been truncated to ${Math.round(MAX_DOCUMENT_CHARS / 1000)}K characters to fit within AI processing limits. For best results, consider uploading a more concise document or breaking it into smaller sections.`
          : ''
      }`;
      
      setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
      
      const prompt = `I have uploaded a document that may contain information relevant to a business plan for my permaculture project. 
        Please analyze this content and provide a concise summary of the key points that could be used in my business plan.
        Focus on extracting the most relevant information for a permaculture business plan.

        Document content:
        ${truncatedText}

        Please provide a structured analysis:
        1. Key Points (3-5 main ideas)
        2. Relevant Business Plan Sections
        3. Specific Recommendations (max 3)`;

      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Analyzing your document...' }]);

      const response = await generateWithOpenAI({
        userId: user.id,
        prompt,
        fieldName: 'businessPlan',
        maxTokens: 1000 // Reduced from 2000 to ensure we stay under limits
      });

      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { role: 'assistant', content: response };
        return newHistory;
      });
      
      // Add status update for document analysis
      addStatusUpdate('Document Analysis', 'Key Points', 'Extracted key points from document', true);
      
      if (voiceEnabled) {
        generateAndPlayAudio(response);
      }

    } catch (err: any) {
      console.error('Error processing document:', err);
      const errorMessage = err.message.includes('maximum context length') 
        ? 'The document is too large to process. Please upload a shorter document or break it into smaller sections.'
        : 'Failed to process document. Please try again.';
      
      setError(errorMessage);
      
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage
      }]);
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsText(file);
    });
  };

  const addStatusUpdate = (section: string, field: string, content: string, saved: boolean) => {
    setStatusUpdates(prev => [
      ...prev,
      {
        timestamp: new Date(),
        section,
        field,
        content,
        saved
      }
    ]);
  };

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;

    setProcessing(true);
    setError(null);

    try {
      const userMessage = message;
      setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
      setMessage('');
      setTranscript('');
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Thinking...' }]);

      let prompt = '';
      
      if (activeSection && businessPlanTemplate) {
        prompt = `I'm working on the ${formatSectionTitle(activeSection)} section of my permaculture business plan. Here is my input: ${userMessage}

        Current content for this section:
        ${JSON.stringify(businessPlanTemplate[activeSection as keyof BusinessPlanTemplate], null, 2)}
        
        Project details:
        Title: ${projectDetails?.title || 'Not specified'}
        Location: ${projectDetails?.location || 'Not specified'}
        Property Status: ${projectDetails?.property_status === 'owned_land' ? 'Owned Land' : 'Potential Property'}
        Values, Mission & Goals: ${projectDetails?.values_mission_goals || 'Not specified'}
        
        Please provide a helpful response that helps me improve this section. If appropriate, suggest specific content that could be added to the business plan.`;
      } else {
        const contextHistory = chatHistory
          .filter(msg => msg.role !== 'system')
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        
        prompt = `I'm working on my permaculture business plan for a project called "${projectDetails?.title || projectId}". Here is our conversation so far:

        ${contextHistory}
        
        User: ${userMessage}
        
        Project details:
        Title: ${projectDetails?.title || 'Not specified'}
        Location: ${projectDetails?.location || 'Not specified'}
        Property Status: ${projectDetails?.property_status === 'owned_land' ? 'Owned Land' : 'Potential Property'}
        Values, Mission & Goals: ${projectDetails?.values_mission_goals || 'Not specified'}
        
        Please provide a helpful response that helps me develop my business plan. If appropriate, suggest specific content that could be added.`;
      }

      // Add status update for processing
      addStatusUpdate('Chat', 'Processing', 'Analyzing your input...', false);

      const response = await generateWithOpenAI({
        userId: user.id,
        prompt,
        fieldName: 'businessPlan',
        maxTokens: 1500
      });

      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { role: 'assistant', content: response };
        return newHistory;
      });
      
      // Add status update for response
      addStatusUpdate('Chat', 'Response', 'Generated AI response', true);
      
      if (voiceEnabled) {
        generateAndPlayAudio(response);
      }

      if (response.includes("I suggest adding this to your business plan:") || 
          response.includes("Here's content you can add to your business plan:") ||
          response.includes("You could add the following to your business plan:")) {
        
        const contentMatch = response.match(/```([\s\S]*?)```/);
        if (contentMatch && contentMatch[1]) {
          const suggestedContent = contentMatch[1].trim();
          
          if (businessPlanTemplate && activeSection) {
            const updatedTemplate = { ...businessPlanTemplate };
            const section = updatedTemplate[activeSection as keyof BusinessPlanTemplate];
            
            if (typeof section === 'object') {
              const keys = Object.keys(section).filter(k => k !== 'completed');
              const targetKey = keys.find(k => !section[k as keyof typeof section]) || keys[0];
              
              if (targetKey) {
                if (Array.isArray(section[targetKey as keyof typeof section])) {
                  (section[targetKey as keyof typeof section] as any).push(suggestedContent);
                } else {
                  const currentContent = section[targetKey as keyof typeof section] as string;
                  section[targetKey as keyof typeof section] = currentContent 
                    ? `${currentContent}\n\n${suggestedContent}` 
                    : suggestedContent;
                }
                
                section.completed = true;
                
                // Add status update for content addition
                addStatusUpdate(
                  formatSectionTitle(activeSection), 
                  formatSectionTitle(targetKey), 
                  suggestedContent.substring(0, 50) + '...', 
                  false
                );
                
                await onUpdatePlan(JSON.stringify(updatedTemplate, null, 2));
                
                // Update status to saved
                addStatusUpdate(
                  formatSectionTitle(activeSection), 
                  'Business Plan', 
                  'Updated and saved to database', 
                  true
                );
              }
            }
          }
        }
      }

    } catch (err) {
      console.error('Error updating business plan:', err);
      setError('Failed to update business plan. Please try again.');
      
      // Add status update for error
      addStatusUpdate('Error', 'Processing', 'Failed to update business plan', false);
      
      setChatHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[newHistory.length - 1].content === 'Thinking...') {
          newHistory[newHistory.length - 1] = { 
            role: 'assistant', 
            content: 'I encountered an error while processing your request. Please try again.' 
          };
        } else {
          newHistory.push({ 
            role: 'assistant', 
            content: 'I encountered an error while processing your request. Please try again.' 
          });
        }
        return newHistory;
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatSectionTitle = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const getSuggestions = () => {
    if (!activeSection) return [];
    
    switch (activeSection) {
      case 'executiveSummary':
        return [
          "What's the core mission of your permaculture project?",
          "What are your key objectives for the next 1-3 years?",
          "How would you describe your project's vision in one sentence?"
        ];
      case 'projectDescription':
        return [
          "What permaculture principles are most important to your project?",
          "What makes your site unique or special?",
          "How will you implement zone design in your project?"
        ];
      case 'marketAnalysis':
        return [
          "Who is your target market or community?",
          "What trends are you seeing in sustainable agriculture?",
          "Who are your main competitors and what makes you different?"
        ];
      case 'financialPlan':
        return [
          "What are your main startup costs?",
          "What are your expected revenue streams?",
          "How much funding do you need and what will it be used for?"
        ];
      default:
        return [
          "Tell me more about your permaculture project",
          "What aspects of your business plan need the most help?",
          "What's your timeline for implementing this project?"
        ];
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-orange-600" />
            Business Plan Assistant
            {activeSection && (
              <span className="ml-2 text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded">
                {formatSectionTitle(activeSection)}
              </span>
            )}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleVoiceOutput}
              className={`p-2 rounded-full ${voiceEnabled ? 'bg-green-600' : 'bg-gray-400'} text-white`}
              title={voiceEnabled ? 'Voice output enabled' : 'Voice output disabled'}
            >
              {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Status Panel */}
        <div className="mb-4">
          <div 
            className="flex items-center justify-between bg-gray-100 p-2 rounded cursor-pointer"
            onClick={() => setShowStatusPanel(!showStatusPanel)}
          >
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${processing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-sm font-medium">
                {processing ? 'Processing...' : 'Status: Ready'}
              </span>
            </div>
            {showStatusPanel ? 
              <ChevronUp className="h-4 w-4 text-gray-500" /> : 
              <ChevronDown className="h-4 w-4 text-gray-500" />
            }
          </div>
          
          {showStatusPanel && (
            <div className="mt-2 border border-gray-200 rounded max-h-40 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Time</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Section</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Field</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Content</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statusUpdates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-center text-gray-500">
                        No updates yet. Start chatting to see status updates.
                      </td>
                    </tr>
                  ) : (
                    statusUpdates.slice().reverse().map((update, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1 text-gray-500">{formatTimestamp(update.timestamp)}</td>
                        <td className="px-2 py-1">{update.section}</td>
                        <td className="px-2 py-1">{update.field}</td>
                        <td className="px-2 py-1 truncate max-w-[200px]">{update.content}</td>
                        <td className="px-2 py-1">
                          {update.saved ? (
                            <span className="flex items-center text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Saved
                            </span>
                          ) : (
                            <span className="text-yellow-600">Processing</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {voiceEnabled && (
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <label className="text-sm font-medium text-gray-700 mr-2">Voice:</label>
              <select 
                value={currentVoice}
                onChange={(e) => setCurrentVoice(e.target.value as any)}
                className="text-sm border rounded p-1"
              >
                <option value="nova">Nova (Female)</option>
                <option value="alloy">Alloy (Neutral)</option>
                <option value="echo">Echo (Male)</option>
                <option value="fable">Fable (Male)</option>
                <option value="onyx">Onyx (Male)</option>
                <option value="shimmer">Shimmer (Female)</option>
              </select>
              
              {isGeneratingAudio && (
                <div className="ml-2 flex items-center text-sm text-gray-500">
                  <Loader2 className="animate-spin h-4 w-4 mr-1" />
                  Generating audio...
                </div>
              )}
              
              {isSpeaking && (
                <button
                  onClick={stopAudio}
                  className="ml-2 text-sm text-red-600 hover:text-red-800 flex items-center"
                >
                  <VolumeX className="h-4 w-4 mr-1" />
                  Stop
                </button>
              )}
            </div>
          </div>
        )}

        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
        >
          {chatHistory.filter(msg => msg.role !== 'system').map((msg, index) => (
            <div 
              key={index} 
              className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <div 
                className={`inline-block max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-gray-200 text-gray-800 rounded-tl-none'
                }`}
              >
                {msg.content === 'Thinking...' ? (
                  <div className="flex items-center">
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Thinking...
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
                
                {msg.role === 'assistant' && msg.audioUrl && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => playAudio(msg.audioUrl!)}
                      className="text-xs text-gray-600 hover:text-gray-800 flex items-center"
                    >
                      <Volume2 className="h-3 w-3 mr-1" />
                      Play audio
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {showSuggestions && getSuggestions().length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-700 flex items-center">
                <Sparkles className="h-4 w-4 mr-1 text-purple-500" />
                Suggested Questions
              </h3>
              <button 
                onClick={() => setShowSuggestions(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Hide
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {getSuggestions().map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setMessage(suggestion);
                    setShowSuggestions(false);
                  }}
                  className="bg-purple-50 text-purple-700 text-sm px-3 py-1.5 rounded-full hover:bg-purple-100 border border-purple-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={toggleVoiceInput}
            className={`p-2 rounded-full ${
              isListening ? 'bg-red-600' : 'bg-blue-600'
            } text-white hover:opacity-90`}
            title={isListening ? 'Stop recording' : 'Start recording'}
          >
            {isListening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>

          <div className="relative group">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".txt,.doc,.docx,.pdf,.md"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700"
              title="Upload document"
            >
              <FileUp className="h-5 w-5" />
            </button>
            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Max size: {Math.round(MAX_DOCUMENT_CHARS / 1000)}K characters
            </div>
          </div>
          
          <div className="relative ml-auto">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300"
              title="Show suggestions"
            >
              <Info className="h-5 w-5" />
            </button>
          </div>
        </div>

        {transcript && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-gray-700">{transcript}</p>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type or speak to add content to your business plan..."
            className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || processing}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-orange-300 flex items-center self-end"
          >
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessPlanChat;