import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, Loader2, Folder, FileText, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { textToSpeech } from '../../lib/openai';
import { cleanItemTitle } from '../../lib/titleFilter';

interface UniversalVoiceInputProps {
  onClose?: () => void;
  currentProject?: { id: string; title: string } | null;
}

const UniversalVoiceInput: React.FC<UniversalVoiceInputProps> = ({ 
  onClose,
  currentProject 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentVoice, setCurrentVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('nova');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [autoSubmitTimer, setAutoSubmitTimer] = useState<NodeJS.Timeout | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      recognitionRef.current = new window.SpeechRecognition();
    } else {
      setError('Speech recognition is not supported in your browser.');
      return;
    }

    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setTranscript(transcript);
      
      if (event.results[current].isFinal) {
        // Clear any existing timer
        if (autoSubmitTimer) {
          clearTimeout(autoSubmitTimer);
        }
        
        // Set a new timer for 3 seconds (increased from default)
        const timer = setTimeout(() => {
          recognition.stop();
          handleSubmit(transcript);
        }, 3000); // Increased from default to give more time
        
        setAutoSubmitTimer(timer);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError('Error with speech recognition. Please try again.');
      setIsListening(false);
    };

    return () => {
      if (recognition) {
        recognition.stop();
      }
      
      // Clean up any audio elements
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Clear any timers
      if (autoSubmitTimer) {
        clearTimeout(autoSubmitTimer);
      }
    };
  }, []);

  const parseVoiceInput = async (input: string) => {
    const lowerInput = input.toLowerCase();
    
    // Business plan related keywords
    const businessPlanKeywords = [
      'business plan', 'business', 'plan', 'executive summary', 'market analysis', 
      'financial plan', 'marketing strategy', 'operations', 'management', 'timeline',
      'risk analysis', 'sustainability'
    ];
    
    // Check if input contains business plan keywords
    const isBusinessPlanRelated = businessPlanKeywords.some(keyword => lowerInput.includes(keyword));
    
    // If we're in a project context and it's business plan related, navigate to the project
    if (currentProject && isBusinessPlanRelated) {
      return {
        type: 'businessPlan',
        data: {
          projectId: currentProject.id,
          query: input
        }
      };
    }
    
    // Infrastructure-related keywords
    const infrastructureKeywords = {
      electricity: ['electricity', 'power', 'electrical', 'wiring', 'solar'],
      water: ['water', 'plumbing', 'irrigation', 'well', 'pump'],
      buildings: ['barn', 'shed', 'greenhouse', 'structure', 'building'],
      soil: ['soil', 'compost', 'garden bed', 'mulch'],
    };

    // Check if input contains infrastructure keywords
    const isInfrastructure = Object.values(infrastructureKeywords)
      .flat()
      .some(keyword => lowerInput.includes(keyword));

    // Inventory item detection - IMPROVED
    const inventoryKeywords = [
      'inventory', 'item', 'supply', 'supplies', 'equipment', 'tool', 'tools',
      'material', 'materials', 'resource', 'resources', 'product', 'products',
      'add to inventory', 'need', 'buy', 'purchase', 'order', 'acquire', 'get',
      'stock', 'store', 'warehouse', 'storage', 'catalog', 'catalogue'
    ];
    
    // Check if input contains inventory keywords
    const isInventoryRelated = inventoryKeywords.some(keyword => lowerInput.includes(keyword));
    
    // Task-specific keywords
    const taskKeywords = [
      'task', 'todo', 'to-do', 'to do', 'remind me to', 'remember to', 'don\'t forget to',
      'schedule', 'plan', 'action item', 'assignment', 'job', 'chore', 'errand',
      'add a task', 'create a task', 'make a task', 'set a task'
    ];
    
    // Check if input contains task keywords
    const isTaskRelated = taskKeywords.some(keyword => lowerInput.includes(keyword));

    // If explicitly inventory related, process as inventory
    if (isInventoryRelated && !isTaskRelated) {
      const quantity = parseInt(input.match(/\d+/)?.[0] || '1');
      
      const tagMatch = input.match(/tag(?:ged)? (?:as|it) ([\w\s,]+)/i);
      const tags = tagMatch ? tagMatch[1].split(',').map(t => t.trim()) : null;
      
      const isFundraiser = lowerInput.includes('fundraiser') || lowerInput.includes('fund raise') || 
                          lowerInput.includes('need funding') || lowerInput.includes('raise money');

      // Determine item type based on keywords
      let itemType: 'needed_supply' | 'owned_resource' | 'borrowed_or_rental' = 'needed_supply';
      
      // Check for owned resource keywords
      const ownedKeywords = [
        'owned', 'own', 'have', 'possess', 'acquired', 'purchased', 'bought', 
        'in stock', 'in inventory', 'already have', 'already own', 'already purchased',
        'already bought', 'already acquired', 'in possession', 'in my possession'
      ];
      
      // Check for borrowed/rental keywords
      const borrowedKeywords = [
        'borrowed', 'rented', 'leased', 'loaned', 'temporary', 'rental', 'lease',
        'on loan', 'borrowing', 'renting', 'leasing'
      ];
      
      // Determine item type based on keywords
      if (ownedKeywords.some(keyword => lowerInput.includes(keyword))) {
        itemType = 'owned_resource';
      } else if (borrowedKeywords.some(keyword => lowerInput.includes(keyword))) {
        itemType = 'borrowed_or_rental';
      }
      
      // Extract the item title using specific patterns
      let itemTitle = '';
      
      // Pattern 1: "add X to inventory" - extract X
      const addToInventoryMatch = input.match(/add\s+(.+?)\s+to\s+inventory/i);
      if (addToInventoryMatch && addToInventoryMatch[1]) {
        itemTitle = addToInventoryMatch[1].trim();
      } 
      // Pattern 2: "add X to my inventory" - extract X
      else if (input.match(/add\s+(.+?)\s+to\s+my\s+inventory/i)) {
        const match = input.match(/add\s+(.+?)\s+to\s+my\s+inventory/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 3: "add to inventory X" - extract X
      else if (input.match(/add\s+to\s+inventory\s+(.+)/i)) {
        const match = input.match(/add\s+to\s+inventory\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 4: "need to buy X" - extract X
      else if (input.match(/need\s+to\s+buy\s+(.+)/i)) {
        const match = input.match(/need\s+to\s+buy\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 5: "buy X" - extract X
      else if (input.match(/buy\s+(.+)/i)) {
        const match = input.match(/buy\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 6: "get X" - extract X
      else if (input.match(/get\s+(.+)/i)) {
        const match = input.match(/get\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 7: "add item X" - extract X
      else if (input.match(/add\s+item\s+(.+)/i)) {
        const match = input.match(/add\s+item\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 8: "I have X" - extract X (for owned resources)
      else if (input.match(/i\s+have\s+(.+)/i)) {
        const match = input.match(/i\s+have\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
        itemType = 'owned_resource'; // Override to owned resource
      }
      // Pattern 9: "I own X" - extract X (for owned resources)
      else if (input.match(/i\s+own\s+(.+)/i)) {
        const match = input.match(/i\s+own\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
        itemType = 'owned_resource'; // Override to owned resource
      }
      // Pattern 10: "add X as owned" - extract X (for owned resources)
      else if (input.match(/add\s+(.+?)\s+as\s+owned/i)) {
        const match = input.match(/add\s+(.+?)\s+as\s+owned/i);
        itemTitle = match ? match[1].trim() : '';
        itemType = 'owned_resource'; // Override to owned resource
      }
      // Pattern 11: "X is owned" - extract X (for owned resources)
      else if (input.match(/(.+?)\s+is\s+owned/i)) {
        const match = input.match(/(.+?)\s+is\s+owned/i);
        itemTitle = match ? match[1].trim() : '';
        itemType = 'owned_resource'; // Override to owned resource
      }
      // Pattern 12: "add X" - extract X (lowest priority pattern)
      else if (input.match(/add\s+(.+)/i)) {
        const match = input.match(/add\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Fallback: use the whole input with cleanup
      else {
        // Clean up the title
        itemTitle = input
          .replace(/(need|buy|get|purchase|item|add to inventory|inventory|supply|supplies|equipment|tool|tools|material|materials|resource|resources|product|products|stock|store|warehouse|storage|catalog|catalogue)\s*\d*\s*/gi, '')
          .replace(/tag(?:ged)? (?:as|it) [\w\s,]+/i, '')
          .replace(/(fundraiser|fund raise|need funding|raise money)/gi, '')
          .trim();
      }
      
      // Remove quantity if it appears at the beginning
      itemTitle = itemTitle.replace(/^\d+\s+/, '');
      
      // Remove any trailing "to inventory" or similar phrases
      itemTitle = itemTitle.replace(/\s+to\s+(my\s+)?inventory.*$/i, '');
      
      // Remove any trailing prepositions or articles
      itemTitle = itemTitle.replace(/\s+(to|for|in|on|at|by|with|the|a|an)$/i, '');

      // Clean the title to remove leading "I" if needed
      itemTitle = cleanItemTitle(itemTitle);

      // Determine which quantity field to use based on item type
      let quantityField = {};
      if (itemType === 'needed_supply') {
        quantityField = { quantity_needed: quantity };
      } else if (itemType === 'owned_resource') {
        quantityField = { quantity_owned: quantity };
      } else if (itemType === 'borrowed_or_rental') {
        quantityField = { quantity_borrowed: quantity };
      }

      const data: any = {
        title: itemTitle,
        item_type: itemType,
        ...quantityField,
        tags,
        fundraiser: isFundraiser,
        added_by: user?.id
      };

      // If we're in a project context, associate the item with the project
      if (currentProject) {
        data.project_id = currentProject.id;
        console.log('Adding item to project:', currentProject.title);
      }

      return {
        type: 'inventory',
        data
      };
    }
    
    // Task detection with improved infrastructure recognition
    if (isTaskRelated || 
        isInfrastructure ||
        (currentProject && !isInventoryRelated)) { // If we're in a project context, default to task unless inventory is specified
      
      let priority = 'medium';
      if (lowerInput.includes('urgent') || lowerInput.includes('asap') || lowerInput.includes('emergency')) {
        priority = 'urgent';
      } else if (lowerInput.includes('high priority') || lowerInput.includes('important')) {
        priority = 'high';
      } else if (lowerInput.includes('low priority') || lowerInput.includes('whenever')) {
        priority = 'low';
      } else if (isInfrastructure) {
        priority = 'high';
      }

      let dueDate = null;
      const dateMatches = input.match(/by (next|this) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)/i);
      if (dateMatches) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          .indexOf(dateMatches[2].toLowerCase());
        
        if (targetDay !== -1) {
          const daysToAdd = (targetDay + 7 - dayOfWeek) % 7;
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + daysToAdd);
          dueDate = targetDate.toISOString();
        } else if (dateMatches[2].toLowerCase() === 'week') {
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + 7);
          dueDate = targetDate.toISOString();
        } else if (dateMatches[2].toLowerCase() === 'month') {
          const targetDate = new Date(now);
          targetDate.setMonth(now.getMonth() + 1);
          dueDate = targetDate.toISOString();
        }
      }

      // Clean up the title by removing command words and keeping the actual task
      let title = input;

      // If the input starts with "add a task" or similar, remove it
      title = title.replace(/^add\s+a?\s*(task|todo)?\s*/i, '');
      
      // Remove other command phrases
      title = title
        .replace(/^create\s+a?\s*(task|todo)?\s*/i, '')
        .replace(/^make\s+a?\s*(task|todo)?\s*/i, '')
        .replace(/^set\s+a?\s*(task|todo)?\s*/i, '')
        .replace(/remind me to\s*/i, '')
        .replace(/by (next|this) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)/i, '')
        .replace(/(urgent|high priority|low priority|asap|emergency|important|whenever)/gi, '')
        .trim();

      // For infrastructure tasks, clean up and standardize the title
      if (isInfrastructure) {
        // Remove "get" and similar verbs from the beginning
        title = title.replace(/^(get|add|create|make|set up|setup|install)\s+/i, '');
        
        // If it's about electricity/power
        if (infrastructureKeywords.electricity.some(word => lowerInput.includes(word))) {
          title = `Install electrical system for ${title.split(/to|for|in/).pop()?.trim() || title}`;
        }
        
        // If it's about water
        if (infrastructureKeywords.water.some(word => lowerInput.includes(word))) {
          title = `Install water system for ${title.split(/to|for|in/).pop()?.trim() || title}`;
        }
      }

      // Create task data with project association if in project context
      const taskData: any = {
        title,
        description: isInfrastructure ? `Infrastructure task for ${title.toLowerCase()}` : null,
        status: 'todo',
        priority,
        due_date: dueDate,
        created_by: user?.id,
      };

      // ALWAYS set project association when in project context
      if (currentProject) {
        taskData.is_project_task = true;
        taskData.project_id = currentProject.id;
        console.log('Adding task to project:', currentProject.title);
      }

      return {
        type: 'task',
        data: taskData
      };
    }
    
    // Project detection (only if not in a project context)
    if (!currentProject && (lowerInput.includes('project') || lowerInput.includes('create project'))) {
      const locationMatch = input.match(/(?:in|at|for|located in|based in) ([\w\s,]+)$/i);
      const location = locationMatch ? locationMatch[1].trim() : null;

      return {
        type: 'project',
        data: {
          title: input
            .replace(/(project|create project)/gi, '')
            .replace(/(?:in|at|for|located in|based in) [\w\s,]+$/i, '')
            .trim(),
          location,
          property_status: 'potential_property',
          created_by: user?.id
        }
      };
    }

    // If no specific type is detected, try to make a best guess
    // If it contains words like "buy", "purchase", "need", etc. without task keywords, treat as inventory
    if (lowerInput.includes('buy') || lowerInput.includes('purchase') || 
        lowerInput.includes('need') || lowerInput.includes('get') ||
        lowerInput.includes('order')) {
      
      const quantity = parseInt(input.match(/\d+/)?.[0] || '1');
      
      // Determine item type based on keywords
      let itemType: 'needed_supply' | 'owned_resource' | 'borrowed_or_rental' = 'needed_supply';
      
      // Check for owned resource keywords
      const ownedKeywords = [
        'owned', 'own', 'have', 'possess', 'acquired', 'purchased', 'bought', 
        'in stock', 'in inventory', 'already have', 'already own', 'already purchased',
        'already bought', 'already acquired', 'in possession', 'in my possession'
      ];
      
      // Check for borrowed/rental keywords
      const borrowedKeywords = [
        'borrowed', 'rented', 'leased', 'loaned', 'temporary', 'rental', 'lease',
        'on loan', 'borrowing', 'renting', 'leasing'
      ];
      
      // Determine item type based on keywords
      if (ownedKeywords.some(keyword => lowerInput.includes(keyword))) {
        itemType = 'owned_resource';
      } else if (borrowedKeywords.some(keyword => lowerInput.includes(keyword))) {
        itemType = 'borrowed_or_rental';
      }
      
      // Extract the item title using specific patterns
      let itemTitle = '';
      
      // Pattern 1: "need to buy X" - extract X
      if (input.match(/need\s+to\s+buy\s+(.+)/i)) {
        const match = input.match(/need\s+to\s+buy\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 2: "buy X" - extract X
      else if (input.match(/buy\s+(.+)/i)) {
        const match = input.match(/buy\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 3: "get X" - extract X
      else if (input.match(/get\s+(.+)/i)) {
        const match = input.match(/get\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 4: "order X" - extract X
      else if (input.match(/order\s+(.+)/i)) {
        const match = input.match(/order\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
      }
      // Pattern 5: "I have X" - extract X (for owned resources)
      else if (input.match(/i\s+have\s+(.+)/i)) {
        const match = input.match(/i\s+have\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
        itemType = 'owned_resource'; // Override to owned resource
      }
      // Pattern 6: "I own X" - extract X (for owned resources)
      else if (input.match(/i\s+own\s+(.+)/i)) {
        const match = input.match(/i\s+own\s+(.+)/i);
        itemTitle = match ? match[1].trim() : '';
        itemType = 'owned_resource'; // Override to owned resource
      }
      // Fallback: use the whole input with cleanup
      else {
        // Clean up the title
        itemTitle = input
          .replace(/(need|buy|get|purchase|order)\s*\d*\s*/gi, '')
          .trim();
      }
      
      // Remove quantity if it appears at the beginning
      itemTitle = itemTitle.replace(/^\d+\s+/, '');
      
      // Remove any trailing prepositions or articles
      itemTitle = itemTitle.replace(/\s+(to|for|in|on|at|by|with|the|a|an)$/i, '');

      // Clean the title to remove leading "I" if needed
      itemTitle = cleanItemTitle(itemTitle);

      // Determine which quantity field to use based on item type
      let quantityField = {};
      if (itemType === 'needed_supply') {
        quantityField = { quantity_needed: quantity };
      } else if (itemType === 'owned_resource') {
        quantityField = { quantity_owned: quantity };
      } else if (itemType === 'borrowed_or_rental') {
        quantityField = { quantity_borrowed: quantity };
      }

      const data: any = {
        title: itemTitle,
        item_type: itemType,
        ...quantityField,
        added_by: user?.id
      };

      // If we're in a project context, associate the item with the project
      if (currentProject) {
        data.project_id = currentProject.id;
      }

      return {
        type: 'inventory',
        data
      };
    }

    // Default to task if in project context, otherwise try to guess
    const data: any = {
      title: input.trim(),
      status: 'todo',
      priority: 'medium',
      created_by: user?.id
    };

    // If we're in a project context, ALWAYS make it a project task
    if (currentProject) {
      data.is_project_task = true;
      data.project_id = currentProject.id;
    }

    return {
      type: 'task',
      data
    };
  };

  const generateAndPlayAudio = async (text: string) => {
    if (!user || !voiceEnabled) return;
    
    setIsGeneratingAudio(true);
    
    try {
      const audioUrl = await textToSpeech({
        userId: user.id,
        text,
        voice: currentVoice
      });
      
      // Play the audio
      playAudio(audioUrl);
      
    } catch (err) {
      console.error('Error generating audio:', err);
      setError('Failed to generate audio. Please check your OpenAI API key.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playAudio = (url: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Create a new audio element
    const audio = new Audio(url);
    audioRef.current = audio;
    
    // Set up event handlers
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
    
    // Play the audio
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

  const handleSubmit = async (finalTranscript?: string) => {
    const inputText = finalTranscript || transcript;
    if (!inputText || !user) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      const parsed = await parseVoiceInput(inputText);
      console.log('Parsed voice input:', parsed);
      
      let responseText = '';
      
      switch (parsed.type) {
        case 'task': {
          console.log('Creating task with data:', parsed.data);
          const { data, error } = await supabase
            .from('tasks')
            .insert(parsed.data)
            .select('id, title')
            .single();
            
          if (error) throw error;
          
          responseText = `I've created a new task: "${data.title}". `;
          
          // If it's a project task, navigate to project tasks view
          if (currentProject) {
            responseText += `This task has been added to your project "${currentProject.title}".`;
            navigate(`/projects/${currentProject.id}/tasks`);
          } else {
            responseText += `You can view it in your tasks list.`;
            navigate(`/tasks/${data.id}`);
          }
          break;
        }
        
        case 'inventory': {
          const { data, error } = await supabase
            .from('items')
            .insert(parsed.data)
            .select('id, title, item_type')
            .single();
            
          if (error) throw error;
          
          // Customize response based on item type
          let itemTypeText = '';
          if (data.item_type === 'owned_resource') {
            itemTypeText = 'as an owned resource';
          } else if (data.item_type === 'borrowed_or_rental') {
            itemTypeText = 'as a borrowed or rental item';
          } else {
            itemTypeText = 'as a needed supply';
          }
          
          responseText = `I've added "${data.title}" to your inventory ${itemTypeText}. `;
          
          // If it's a project item, navigate to project inventory
          if (currentProject) {
            responseText += `This item has been associated with your project "${currentProject.title}".`;
            navigate(`/projects/${currentProject.id}/inventory`);
          } else {
            responseText += `You can view it in your inventory list.`;
            navigate(`/inventory/${data.id}`);
          }
          break;
        }
        
        case 'project': {
          const { data, error } = await supabase
            .from('projects')
            .insert(parsed.data)
            .select('id, title')
            .single();
            
          if (error) throw error;
          
          responseText = `I've created a new project called "${data.title}". You can now add more details to it.`;
          navigate(`/projects/${data.id}`);
          break;
        }
        
        case 'businessPlan': {
          responseText = `Opening the business plan assistant for your project. Let's work on developing your business plan together.`;
          navigate(`/projects/${parsed.data.projectId}`);
          break;
        }
      }
      
      // Generate and play audio response
      if (voiceEnabled && responseText) {
        generateAndPlayAudio(responseText);
      }
      
      if (onClose) {
        // Wait a moment before closing to allow the audio to start playing
        setTimeout(() => {
          onClose();
        }, 500);
      }
      
    } catch (err) {
      console.error('Error processing voice input:', err);
      setError('Failed to process voice input. Please try again.');
      
      // Generate error audio
      if (voiceEnabled) {
        generateAndPlayAudio('I encountered an error processing your request. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser.');
      return;
    }

    if (!isListening) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
        setError('Error starting voice recognition. Please try again.');
      }
    } else {
      recognitionRef.current.stop();
      
      // Clear any auto-submit timer
      if (autoSubmitTimer) {
        clearTimeout(autoSubmitTimer);
        setAutoSubmitTimer(null);
      }
    }
  };

  const toggleVoiceOutput = () => {
    setVoiceEnabled(!voiceEnabled);
    
    // Stop any currently playing audio
    stopAudio();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Voice Input</h3>
          {currentProject && (
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <Folder className="h-4 w-4" />
              <p className="text-sm">Adding to project: {currentProject.title}</p>
            </div>
          )}
          <p className="text-gray-600 text-sm">
            Speak to add a task, inventory item, project, or work on your business plan. Include keywords like "task", "need", "project", or "business plan" to specify the type.
            {currentProject ? " Items will be associated with the current project." : ""}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="mb-4">
          <div className="flex justify-center gap-4 mb-4">
            <button
              onClick={toggleListening}
              disabled={processing}
              className={`p-4 rounded-full ${
                isListening 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition-colors`}
            >
              {processing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isListening ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>
            
            <button
              onClick={toggleVoiceOutput}
              className={`p-4 rounded-full ${
                voiceEnabled 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-400 hover:bg-gray-500'
              } text-white transition-colors`}
              title={voiceEnabled ? 'Voice output enabled' : 'Voice output disabled'}
            >
              {voiceEnabled ? (
                <Volume2 className="h-6 w-6" />
              ) : (
                <VolumeX className="h-6 w-6" />
              )}
            </button>
          </div>

          {voiceEnabled && (
            <div className="flex justify-center mb-4">
              <select 
                value={currentVoice}
                onChange={(e) => setCurrentVoice(e.target.value as any)}
                className="text-sm border rounded p-2"
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
          )}

          <div className="bg-gray-50 p-4 rounded-lg min-h-[100px]">
            <p className="text-gray-700 whitespace-pre-wrap">
              {transcript || 'Start speaking...'}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
          >
            {showExamples ? 'Hide Examples' : 'Show Example Phrases'}
          </button>
          
          {showExamples && (
            <div className="mt-2 bg-blue-50 p-3 rounded-lg text-sm">
              <h4 className="font-medium text-blue-800 mb-2">Example Phrases:</h4>
              
              <div className="mb-2">
                <p className="font-medium text-blue-700">For Tasks:</p>
                <ul className="list-disc list-inside text-gray-700 ml-2">
                  <li>"Add a task to build a compost bin"</li>
                  <li>"Create a high priority task to install irrigation system"</li>
                  <li>"Remind me to order seeds by next week"</li>
                  <li>"Task: Research solar panel options"</li>
                </ul>
              </div>
              
              <div className="mb-2">
                <p className="font-medium text-blue-700">For Inventory:</p>
                <ul className="list-disc list-inside text-gray-700 ml-2">
                  <li>"Add 5 shovels to inventory"</li>
                  <li>"Add rainwater collection barrels to inventory"</li>
                  <li>"Need to buy 20 bags of compost"</li>
                  <li>"I have 3 solar panels" (adds as owned resource)</li>
                  <li>"Add item: solar panels as owned"</li>
                </ul>
              </div>
              
              <div>
                <p className="font-medium text-blue-700">For Projects:</p>
                <ul className="list-disc list-inside text-gray-700 ml-2">
                  <li>"Create project Backyard Garden in Portland"</li>
                  <li>"New project: Community Orchard located in Seattle"</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={!transcript || processing}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
          >
            {processing ? 'Processing...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UniversalVoiceInput;