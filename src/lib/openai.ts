import OpenAI from 'openai';
import { supabase } from './supabase';

export interface OpenAIOptions {
  userId: string;
  prompt: string;
  fieldName: string;
  locationContext?: string;
  maxTokens?: number;
}

export interface TextToSpeechOptions {
  userId: string;
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
}

export interface ImageGenerationOptions {
  userId: string;
  prompt: string;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
}

export interface ProductSearchOptions {
  userId: string;
  query: string;
  maxResults?: number;
}

export async function generateWithOpenAI({ userId, prompt, fieldName, locationContext, maxTokens = 500 }: OpenAIOptions): Promise<string> {
  try {
    // Get the user's API key from the database
    const { data, error } = await supabase
      .from('api_keys')
      .select('key')
      .eq('user_id', userId)
      .eq('service', 'openai')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      throw new Error('No OpenAI API key found for this user. Please add your API key in settings.');
    }
    
    // Create OpenAI client with the user's API key
    const openai = new OpenAI({
      apiKey: data.key,
      dangerouslyAllowBrowser: true // Allow browser usage while acknowledging security implications
    });
    
    // Prepare base prompt with context based on the field
    let systemPrompt = "You are an expert in permaculture and sustainable design.";
    
    // Add location context if provided
    if (locationContext) {
      systemPrompt += ` Your advice should be specific and appropriate for ${locationContext}, considering its climate, typical soil conditions, rainfall patterns, and local ecosystem.`;
    }
    
    // Handle "all fields" requests differently
    if (fieldName === 'all') {
      systemPrompt += ` Create a comprehensive permaculture project plan for ${locationContext || 'a general location'}. Return ONLY a valid JSON object (no markdown, no explanations, no code blocks) with the following fields as string values (never return objects or nested structures):
        - title: A catchy, descriptive name for the project
        - valuesMissionGoals: Values and mission statement
        - zone0: Description of the house/main building design and features
        - zone1: Plants and elements for Zone 1 (frequent attention)
        - zone2: Plants and elements for Zone 2 (regular attention)
        - zone3: Plants and elements for Zone 3 (occasional attention)
        - zone4: Description of Zone 4 (semi-wild areas)
        - water: Water management systems
        - soil: Soil management approaches
        - power: Energy systems
        - guilds: An array of 3-6 appropriate plant/animal guilds as strings
        - structures: An array of 2-4 appropriate structures as strings

      IMPORTANT: All values must be simple strings, never objects. Arrays must only contain strings. The response must be parseable with JSON.parse().`;
      
      // Use more tokens for comprehensive response
      maxTokens = 1500;
    } else if (fieldName === 'businessPlan') {
      systemPrompt = "You are an expert in permaculture business planning and sustainable enterprise development. Create a detailed, professional business plan that appears to be written by a human expert, not AI. IMPORTANT FORMATTING INSTRUCTIONS: Do not use any markdown formatting - avoid using # symbols for headers, avoid using * for bullets or emphasis, and avoid any other special markdown characters. Use natural paragraph titles with descriptive text for section headers. Avoid excessive numbered lists. Use a conversational, professional style with varied sentence structures. Format content in a way that looks like a polished document created by a professional consultant without relying on special formatting characters. Include all essential business plan components but present them in a natural flow without obvious templated formatting.";
      
      // Increase tokens for business plan
      maxTokens = maxTokens || 3000;
    } else if (fieldName === 'productSearch') {
      systemPrompt = "You are a helpful assistant that provides information about products. When given a product name or description, provide details about the product including typical price range, key features, and where it might be purchased. If the product is related to permaculture or sustainable living, include information about its environmental impact and sustainability features. Format your response in a clear, concise manner with sections for Price Range, Key Features, Where to Buy, and Sustainability Considerations.";
      
      maxTokens = 800;
    } else if (fieldName === 'productDescription') {
      systemPrompt = "You are a product description expert specializing in permaculture and sustainable living products. Create a detailed, informative, and engaging product description for the given item. Include information about its features, benefits, uses in permaculture contexts, and sustainability aspects. The description should be professional and suitable for an e-commerce or inventory management system. Format the description in clear paragraphs without using markdown formatting.";
      
      maxTokens = 800;
    } else if (fieldName === 'imagePrompt') {
      systemPrompt = "You are an expert at creating detailed image generation prompts. When given a product name or description, create a detailed, specific prompt that would generate a realistic, professional product image. Focus on describing the product's appearance, setting, lighting, and perspective. The prompt should be detailed enough to generate a high-quality, realistic image of the product. Do not include any explanations or commentary - ONLY output the image generation prompt itself.";
      
      maxTokens = 300;
    } else {
      // Add specific context based on the field being completed
      switch (fieldName) {
        case 'title':
          systemPrompt += " Generate a creative, memorable title for a permaculture project. Keep it concise but descriptive.";
          break;
        case 'valuesMissionGoals':
          systemPrompt += " Create a mission statement and goals for a permaculture project that emphasizes sustainability, regeneration, and community.";
          break;
        case 'zone0':
          systemPrompt += " Describe Zone 0 (house/main building) in a permaculture design. Focus on sustainable features, energy efficiency, and integration with the landscape.";
          if (locationContext) {
            systemPrompt += ` Include specific building considerations appropriate for ${locationContext}'s climate conditions, such as insulation, heating/cooling needs, and appropriate architectural elements.`;
          }
          break;
        case 'zone1':
          systemPrompt += " Describe Zone 1 (frequently visited areas) in a permaculture design. Include suitable plants, design features, and sustainability elements.";
          if (locationContext) {
            systemPrompt += ` Recommend specific plants that thrive in ${locationContext}'s climate and are appropriate for Zone 1's frequent attention needs. Consider local growing conditions and seasons.`;
          }
          break;
        case 'zone2':
          systemPrompt += " Describe Zone 2 (semi-frequently visited areas) in a permaculture design. Include appropriate plantings, animal systems, and management strategies.";
          if (locationContext) {
            systemPrompt += ` Suggest specific fruit trees, perennials, and possibly small animal systems that are well-adapted to ${locationContext}'s climate and can thrive with moderate attention.`;
          }
          break;
        case 'zone3':
          systemPrompt += " Describe Zone 3 (occasionally visited areas) in a permaculture design. Include main crops, larger animals, and management approaches.";
          if (locationContext) {
            systemPrompt += ` Recommend specific field crops, grazing systems, or larger-scale food production methods that work well in ${locationContext}'s growing conditions with minimal intervention.`;
          }
          break;
        case 'zone4':
          systemPrompt += " Describe Zone 4 (rarely visited semi-wild areas) in a permaculture design. Include forestry, foraging, and wildlife habitat elements.";
          if (locationContext) {
            systemPrompt += ` Suggest appropriate native species, forest management techniques, and wildlife corridor designs specific to ${locationContext}'s native ecosystem and biodiversity.`;
          }
          break;
        case 'water':
          systemPrompt += " Describe sustainable water systems for a permaculture project. Include rain harvesting, storage, irrigation, and water conservation strategies.";
          if (locationContext) {
            systemPrompt += ` Provide specific water management techniques appropriate for ${locationContext}'s annual rainfall, seasonal patterns, and local regulations. Consider drought resilience if applicable.`;
          }
          break;
        case 'soil':
          systemPrompt += " Describe soil management strategies for a permaculture project. Include composting, mulching, cover cropping, and soil improvement techniques.";
          if (locationContext) {
            systemPrompt += ` Recommend specific soil amendments, pH adjustments, and improvement techniques based on ${locationContext}'s typical soil conditions. Consider local materials that might be available.`;
          }
          break;
        case 'power':
          systemPrompt += " Describe sustainable energy systems for a permaculture project. Include renewable sources, efficiency measures, and appropriate technology.";
          if (locationContext) {
            systemPrompt += ` Suggest optimal renewable energy sources based on ${locationContext}'s climate conditions (solar potential, wind patterns, hydro possibilities, etc.) and any local energy incentives or programs.`;
          }
          break;
        default:
          systemPrompt += " Provide helpful information on sustainable and regenerative design principles.";
      }
    }
    
    // Make the API call
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    
    // Return the generated text
    return response.choices[0]?.message?.content?.trim() || "Could not generate a response. Please try again.";
    
  } catch (error) {
    console.error('OpenAI API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate content with AI. Please try again later.');
  }
}

export async function textToSpeech({ userId, text, voice = 'nova' }: TextToSpeechOptions): Promise<string> {
  try {
    // Get the user's API key from the database
    const { data, error } = await supabase
      .from('api_keys')
      .select('key')
      .eq('user_id', userId)
      .eq('service', 'openai')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      throw new Error('No OpenAI API key found for this user. Please add your API key in settings.');
    }
    
    // Create OpenAI client with the user's API key
    const openai = new OpenAI({
      apiKey: data.key,
      dangerouslyAllowBrowser: true // Allow browser usage while acknowledging security implications
    });
    
    // Limit text length to avoid excessive token usage
    const limitedText = text.length > 4000 ? text.substring(0, 4000) + "..." : text;
    
    // Make the API call to create speech
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: limitedText,
    });
    
    // Convert the response to a blob URL that can be played
    const blob = await mp3.blob();
    const url = URL.createObjectURL(blob);
    
    return url;
  } catch (error) {
    console.error('OpenAI TTS API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate speech. Please try again later.');
  }
}

export async function generateImage({ userId, prompt, size = '1024x1024', quality = 'standard', style = 'natural' }: ImageGenerationOptions): Promise<string> {
  try {
    // Get the user's API key from the database
    const { data, error } = await supabase
      .from('api_keys')
      .select('key')
      .eq('user_id', userId)
      .eq('service', 'openai')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      throw new Error('No OpenAI API key found for this user. Please add your API key in settings.');
    }
    
    // Create OpenAI client with the user's API key
    const openai = new OpenAI({
      apiKey: data.key,
      dangerouslyAllowBrowser: true // Allow browser usage while acknowledging security implications
    });
    
    // Generate the image
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
      style: style,
    });
    
    // Return the URL of the generated image
    return response.data[0].url || '';
    
  } catch (error) {
    console.error('OpenAI Image Generation API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate image. Please try again later.');
  }
}

export async function searchProduct({ userId, query, maxResults = 3 }: ProductSearchOptions): Promise<string> {
  try {
    // Get the user's API key from the database
    const { data, error } = await supabase
      .from('api_keys')
      .select('key')
      .eq('user_id', userId)
      .eq('service', 'openai')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      throw new Error('No OpenAI API key found for this user. Please add your API key in settings.');
    }
    
    // Create OpenAI client with the user's API key
    const openai = new OpenAI({
      apiKey: data.key,
      dangerouslyAllowBrowser: true
    });
    
    // Create a prompt for product search
    const prompt = `I'm looking for information about "${query}". Please provide:
    1. A brief description of the product
    2. Typical price range
    3. Key features
    4. Where to buy it
    5. A link to purchase it online (if available)
    
    Format the response as JSON with the following structure:
    {
      "description": "Brief description of the product",
      "priceRange": "Typical price range (e.g., $10-$50)",
      "features": ["Feature 1", "Feature 2", "Feature 3"],
      "whereToBuy": ["Store/Website 1", "Store/Website 2"],
      "purchaseLink": "https://example.com/product"
    }
    
    If you're unsure about any specific details, provide your best estimate and indicate uncertainty.`;
    
    // Make the API call
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a product information assistant that provides accurate information about products, including descriptions, prices, features, and where to buy them. Always format your response as valid JSON."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.5,
    });
    
    // Return the generated text
    return response.choices[0]?.message?.content?.trim() || "{}";
    
  } catch (error) {
    console.error('OpenAI Product Search API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search for product information. Please try again later.');
  }
}

export async function generateProductDescription({ userId, prompt }: { userId: string, prompt: string }): Promise<string> {
  return generateWithOpenAI({
    userId,
    prompt,
    fieldName: 'productDescription',
    maxTokens: 800
  });
}

export async function generateImagePrompt({ userId, prompt }: { userId: string, prompt: string }): Promise<string> {
  return generateWithOpenAI({
    userId,
    prompt,
    fieldName: 'imagePrompt',
    maxTokens: 300
  });
}